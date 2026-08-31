const ROOM_NAME = "lobby";
const TECHNOCORE_BASE_URL = "https://technocore.chat";
const MAX_MESSAGES = 200;

type CollectorPosition = {
  roomId: string | null;
  epochId: string | null;
  lastSavedSeq: string;
  archiveEnabled: boolean;
};

type TechnocoreMessage = {
  seq: string;
  ts: string;
  from: string;
  text: string;
  nonce?: string;
};

type TechnocoreResponse = {
  room: string;
  count: number;
  first_seq: string | null;
  last_seq: string;
  messages: TechnocoreMessage[];
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function quoteLargeIntegers(json: string): string {
  return json.replace(
    /("(?:seq|first_seq|last_seq|nonce)"\s*:\s*)(\d+)/g,
    '$1"$2"',
  );
}

function parseDatabaseJson<T>(raw: string): T {
  const safe = raw.replace(
    /("(?:id|room_id|epoch_id|current_epoch_id|last_saved_seq)"\s*:\s*)(\d+)/g,
    '$1"$2"',
  );
  return JSON.parse(safe) as T;
}

function parseTechnocoreResponse(raw: string): TechnocoreResponse {
  const value = JSON.parse(quoteLargeIntegers(raw)) as Partial<TechnocoreResponse>;

  if (value.room !== ROOM_NAME) {
    throw new Error("Technocore returned an unexpected room");
  }

  if (!Array.isArray(value.messages) || value.messages.length > MAX_MESSAGES) {
    throw new Error("Technocore returned an invalid message collection");
  }

  if (!Number.isInteger(value.count) || value.count !== value.messages.length) {
    throw new Error("Technocore returned an invalid message count");
  }

  if (typeof value.last_seq !== "string" || !/^\d+$/.test(value.last_seq)) {
    throw new Error("Technocore returned an invalid last_seq");
  }

  if (
    value.first_seq !== null &&
    (typeof value.first_seq !== "string" || !/^\d+$/.test(value.first_seq))
  ) {
    throw new Error("Technocore returned an invalid first_seq");
  }

  const messages = value.messages as TechnocoreMessage[];
  let expectedSeq = value.first_seq === null ? null : BigInt(value.first_seq);

  for (const message of messages) {
    if (
      typeof message !== "object" ||
      message === null ||
      typeof message.seq !== "string" ||
      !/^\d+$/.test(message.seq) ||
      typeof message.ts !== "string" ||
      Number.isNaN(Date.parse(message.ts)) ||
      typeof message.from !== "string" ||
      message.from.length === 0 ||
      typeof message.text !== "string" ||
      Array.from(message.text).length < 1 ||
      Array.from(message.text).length > 4096
    ) {
      throw new Error("Technocore returned an invalid message");
    }

    if (expectedSeq === null || BigInt(message.seq) !== expectedSeq) {
      throw new Error("Technocore returned non-contiguous message sequences");
    }
    expectedSeq += 1n;

    if (
      message.nonce !== undefined &&
      (!/^\d{1,19}$/.test(message.nonce) || BigInt(message.nonce) <= 0n)
    ) {
      throw new Error("Technocore returned an invalid nonce");
    }
  }

  if (messages.length === 0) {
    if (value.first_seq !== null) {
      throw new Error("An empty Technocore response has a first_seq");
    }
  } else if (
    value.first_seq === null ||
    messages[0].seq !== value.first_seq ||
    messages[messages.length - 1].seq !== value.last_seq
  ) {
    throw new Error("Technocore response boundaries do not match its messages");
  }

  return value as TechnocoreResponse;
}

async function supabaseRequest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("authorization", `Bearer ${serviceRoleKey}`);
  if (init.body) {
    headers.set("content-type", "application/json");
  }

  return await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
}

async function readCollectorPosition(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<CollectorPosition> {
  const roomResponse = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/rest/v1/rooms?name=eq.${ROOM_NAME}&select=id,archive_enabled`,
  );

  if (!roomResponse.ok) {
    throw new Error(`Could not read room configuration (${roomResponse.status})`);
  }

  const rooms = parseDatabaseJson<Array<{
    id: string;
    archive_enabled: boolean;
  }>>(await roomResponse.text());

  if (rooms.length === 0) {
    return {
      roomId: null,
      epochId: null,
      lastSavedSeq: "0",
      archiveEnabled: true,
    };
  }

  if (rooms.length !== 1) {
    throw new Error("Multiple lobby room records exist");
  }

  const roomId = String(rooms[0].id);
  if (!rooms[0].archive_enabled) {
    return {
      roomId,
      epochId: null,
      lastSavedSeq: "0",
      archiveEnabled: false,
    };
  }

  const stateResponse = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    `/rest/v1/collector_state?room_id=eq.${roomId}&select=current_epoch_id,last_saved_seq`,
  );

  if (!stateResponse.ok) {
    throw new Error(`Could not read collector state (${stateResponse.status})`);
  }

  const states = parseDatabaseJson<Array<{
    current_epoch_id: string;
    last_saved_seq: string;
  }>>(await stateResponse.text());

  if (states.length === 0) {
    return {
      roomId,
      epochId: null,
      lastSavedSeq: "0",
      archiveEnabled: true,
    };
  }

  if (states.length !== 1) {
    throw new Error("Multiple lobby collector-state records exist");
  }

  return {
    roomId,
    epochId: String(states[0].current_epoch_id),
    lastSavedSeq: String(states[0].last_saved_seq),
    archiveEnabled: true,
  };
}

async function recordPollError(
  supabaseUrl: string,
  serviceRoleKey: string,
  position: CollectorPosition,
  error: unknown,
): Promise<void> {
  if (position.roomId === null || position.epochId === null) {
    return;
  }

  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : "Unknown collector error";
  const path =
    `/rest/v1/collector_state?room_id=eq.${position.roomId}` +
    `&current_epoch_id=eq.${position.epochId}` +
    `&last_saved_seq=eq.${position.lastSavedSeq}`;

  const response = await supabaseRequest(supabaseUrl, serviceRoleKey, path, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      last_attempted_poll_at: timestamp,
      last_error: message.slice(0, 1000),
      updated_at: timestamp,
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not record poll error (${response.status})`);
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let collectorToken: string;

  try {
    supabaseUrl = requireEnvironment("SUPABASE_URL");
    serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    collectorToken = requireEnvironment("COREHISTORY_COLLECTOR_TOKEN");
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Missing environment",
    });
  }

  if (request.headers.get("x-corehistory-token") !== collectorToken) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let position: CollectorPosition = {
    roomId: null,
    epochId: null,
    lastSavedSeq: "0",
    archiveEnabled: true,
  };

  try {
    position = await readCollectorPosition(supabaseUrl, serviceRoleKey);

    if (!position.archiveEnabled) {
      return jsonResponse(200, { skipped: true, reason: "Archiving is disabled" });
    }

    const technocoreUrl = new URL(`/r/${ROOM_NAME}`, TECHNOCORE_BASE_URL);
    technocoreUrl.searchParams.set("since", position.lastSavedSeq);
    technocoreUrl.searchParams.set("limit", String(MAX_MESSAGES));
    technocoreUrl.searchParams.set("format", "json");
    technocoreUrl.searchParams.set("n", String(Date.now()));

    const technocoreResponse = await fetch(technocoreUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!technocoreResponse.ok) {
      throw new Error(`Technocore request failed (${technocoreResponse.status})`);
    }

    let response = parseTechnocoreResponse(await technocoreResponse.text());

    if (response.messages.length === 0 && position.lastSavedSeq !== "0") {
      const headUrl = new URL(`/r/${ROOM_NAME}`, TECHNOCORE_BASE_URL);
      headUrl.searchParams.set("limit", "1");
      headUrl.searchParams.set("format", "json");
      headUrl.searchParams.set("n", String(Date.now()));

      const headResponse = await fetch(headUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!headResponse.ok) {
        throw new Error(`Technocore head check failed (${headResponse.status})`);
      }

      const head = parseTechnocoreResponse(await headResponse.text());
      if (
        head.messages.length > 0 &&
        BigInt(head.last_seq) < BigInt(position.lastSavedSeq)
      ) {
        const rotationResponse = await supabaseRequest(
          supabaseUrl,
          serviceRoleKey,
          "/rest/v1/rpc/rotate_lobby_epoch",
          {
            method: "POST",
            body: JSON.stringify({
              p_expected_epoch_id: position.epochId,
              p_expected_last_saved_seq: position.lastSavedSeq,
            }),
          },
        );

        if (!rotationResponse.ok) {
          throw new Error(`Epoch rotation failed (${rotationResponse.status})`);
        }

        const rotation = parseDatabaseJson<{
          epoch_id: string;
          last_saved_seq: string;
        }>(await rotationResponse.text());
        position = {
          ...position,
          epochId: rotation.epoch_id,
          lastSavedSeq: rotation.last_saved_seq,
        };

        technocoreUrl.searchParams.set("since", "0");
        technocoreUrl.searchParams.set("n", String(Date.now()));
        const restartedResponse = await fetch(technocoreUrl, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });

        if (!restartedResponse.ok) {
          throw new Error(
            `Technocore restart poll failed (${restartedResponse.status})`,
          );
        }
        response = parseTechnocoreResponse(await restartedResponse.text());
      }
    }

    const ingestionResponse = await supabaseRequest(
      supabaseUrl,
      serviceRoleKey,
      "/rest/v1/rpc/ingest_lobby_poll",
      {
        method: "POST",
        body: JSON.stringify({
          p_expected_epoch_id: position.epochId,
          p_expected_last_saved_seq: position.lastSavedSeq,
          p_response_first_seq: response.first_seq,
          p_response_last_seq: response.last_seq,
          p_messages: response.messages,
        }),
      },
    );

    if (!ingestionResponse.ok) {
      throw new Error(`Database ingestion failed (${ingestionResponse.status})`);
    }

    const result = parseDatabaseJson<Record<string, unknown>>(
      await ingestionResponse.text(),
    );
    return jsonResponse(200, {
      ok: true,
      result,
    });
  } catch (error) {
    try {
      await recordPollError(supabaseUrl, serviceRoleKey, position, error);
    } catch {
      // Error recording is best-effort and must not hide the original failure.
    }
    return jsonResponse(502, {
      ok: false,
      error: error instanceof Error ? error.message : "Collector failed",
    });
  }
});
