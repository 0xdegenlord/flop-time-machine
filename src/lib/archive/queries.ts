import "server-only";

import { createPublicSupabaseClient } from "@/lib/supabase/server";

import { endOfThroughDate } from "./search-params";
import type {
  ArchiveFilters,
  ArchiveMessage,
  ArchivePage,
  ArchiveStatus,
  LobbyEpoch,
} from "./types";

const ARCHIVE_PAGE_SIZE = 40;

function throwRpcError(operation: string, error: { message: string }): never {
  throw new Error(`${operation}: ${error.message}`);
}

export async function getLobbyEpochs(limit = 100): Promise<LobbyEpoch[]> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_lobby_epochs", {
    p_before_epoch_number: null,
    p_limit: limit,
  });

  if (error) throwRpcError("Could not load lobby epochs", error);
  return data ?? [];
}

export async function getLobbyArchiveStatus(): Promise<ArchiveStatus | null> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_lobby_archive_status");

  if (error) throwRpcError("Could not load archive status", error);
  return data?.[0] ?? null;
}

export async function getLobbyMessages(
  filters: ArchiveFilters,
): Promise<ArchivePage> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_lobby_messages", {
    p_before_epoch_number: filters.cursor?.epochNumber ?? null,
    p_before_seq: filters.cursor?.seq ?? null,
    p_epoch_number: filters.epochNumber,
    p_from_timestamp: filters.fromDate
      ? `${filters.fromDate}T00:00:00.000Z`
      : null,
    p_limit: ARCHIVE_PAGE_SIZE + 1,
    p_query: filters.query || null,
    p_to_timestamp: endOfThroughDate(filters.throughDate),
    p_sender: filters.did || null,
  });

  if (error) throwRpcError("Could not load lobby messages", error);

  const rows: ArchiveMessage[] = data ?? [];
  const hasNextPage = rows.length > ARCHIVE_PAGE_SIZE;
  const messages = rows.slice(0, ARCHIVE_PAGE_SIZE);
  const lastMessage = messages.at(-1);

  return {
    messages,
    nextCursor:
      hasNextPage && lastMessage
        ? { epochNumber: lastMessage.epoch_number, seq: lastMessage.seq }
        : null,
  };
}

export async function getRecentLobbyMessages(
  limit = 6,
): Promise<ArchiveMessage[]> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_lobby_messages", {
    p_before_epoch_number: null,
    p_before_seq: null,
    p_epoch_number: null,
    p_from_timestamp: null,
    p_limit: limit,
    p_query: null,
    p_to_timestamp: null,
  });

  if (error) throwRpcError("Could not load recent lobby messages", error);
  return data ?? [];
}
