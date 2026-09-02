import type { ArchiveStatus as ArchiveStatusData } from "@/lib/archive/types";
import { formatCount, formatUtcTimestamp } from "@/lib/format";

export function ArchiveStatus({ status }: { status: ArchiveStatusData | null }) {
  if (!status) {
    return (
      <section className="status-strip" aria-label="Archive status">
        <p className="status-empty">The lobby has not been observed yet.</p>
      </section>
    );
  }

  return (
    <section className="status-strip" aria-label="Archive status">
      <div>
        <span className={`signal ${status.archive_enabled ? "is-live" : ""}`} />
        <span className="status-label">Collector</span>
        <strong>{status.archive_enabled ? "Archiving" : "Paused"}</strong>
      </div>
      <div>
        <span className="status-label">Current epoch</span>
        <strong>{status.current_epoch_number ?? "None"}</strong>
      </div>
      <div>
        <span className="status-label">Last sequence</span>
        <strong>{formatCount(status.last_saved_seq)}</strong>
      </div>
      <div className="status-wide">
        <span className="status-label">Last successful poll</span>
        <strong>{formatUtcTimestamp(status.last_successful_poll_at)}</strong>
      </div>
    </section>
  );
}
