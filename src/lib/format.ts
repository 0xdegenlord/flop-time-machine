export function formatUtcTimestamp(value: string | null): string {
  if (!value) return "Not yet recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatCount(value: string | null): string {
  if (!value) return "0";

  try {
    return BigInt(value).toLocaleString("en-US");
  } catch {
    return value;
  }
}
