import type { ArchiveFilters, MessageCursor } from "./types";

export type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type ParsedArchiveSearch = {
  filters: ArchiveFilters;
  error: string | null;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function positiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function positiveBigintString(value: string): string | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  try {
    return BigInt(value) > 0n ? BigInt(value).toString() : null;
  } catch {
    return null;
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

export function endOfThroughDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function parseArchiveSearchParams(
  params: RawSearchParams,
): ParsedArchiveSearch {
  const rawQuery = first(params.q);
  const query = rawQuery.trim();
  const rawEpoch = first(params.epoch);
  const rawFrom = first(params.from);
  const rawThrough = first(params.through);
  const rawCursorEpoch = first(params.cursorEpoch);
  const rawCursorSeq = first(params.cursorSeq);
  const errors: string[] = [];

  if (query.length > 200 || /[\u0000-\u001f\u007f]/.test(query)) {
    errors.push("Search must be 200 characters or fewer and contain no control characters.");
  }

  const epochNumber = rawEpoch ? positiveInteger(rawEpoch) : null;
  if (rawEpoch && epochNumber === null) {
    errors.push("The epoch filter is invalid.");
  }

  const fromDate = rawFrom && validDate(rawFrom) ? rawFrom : "";
  const throughDate = rawThrough && validDate(rawThrough) ? rawThrough : "";
  if (rawFrom && !fromDate) {
    errors.push("The start date is invalid.");
  }
  if (rawThrough && !throughDate) {
    errors.push("The end date is invalid.");
  }
  if (fromDate && throughDate && fromDate > throughDate) {
    errors.push("The start date must not follow the end date.");
  }

  const cursorEpoch = rawCursorEpoch
    ? positiveInteger(rawCursorEpoch)
    : null;
  const cursorSeq = rawCursorSeq
    ? positiveBigintString(rawCursorSeq)
    : null;
  let cursor: MessageCursor | null = null;

  if (rawCursorEpoch || rawCursorSeq) {
    if (cursorEpoch === null || cursorSeq === null) {
      errors.push("The message cursor is invalid.");
    } else {
      cursor = { epochNumber: cursorEpoch, seq: cursorSeq };
    }
  }

  return {
    filters: {
      query: query.length <= 200 ? query : "",
      epochNumber,
      fromDate,
      throughDate,
      cursor,
    },
    error: errors.length > 0 ? errors.join(" ") : null,
  };
}

export function buildArchiveHref(
  filters: ArchiveFilters,
  cursor: MessageCursor | null = null,
): string {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.epochNumber) params.set("epoch", String(filters.epochNumber));
  if (filters.fromDate) params.set("from", filters.fromDate);
  if (filters.throughDate) params.set("through", filters.throughDate);
  if (cursor) {
    params.set("cursorEpoch", String(cursor.epochNumber));
    params.set("cursorSeq", cursor.seq);
  }

  const query = params.toString();
  return query ? `/archive?${query}` : "/archive";
}
