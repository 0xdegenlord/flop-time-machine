import Link from "next/link";

import type { ArchiveFilters, LobbyEpoch } from "@/lib/archive/types";

type ArchiveFiltersProps = {
  filters: ArchiveFilters;
  epochs: LobbyEpoch[];
};

export function ArchiveFilterForm({ filters, epochs }: ArchiveFiltersProps) {
  return (
    <form className="archive-filters" action="/archive" method="get">
      <label className="search-field">
        <span>Search transcript</span>
        <input
          type="search"
          name="q"
          maxLength={200}
          defaultValue={filters.query}
          placeholder="Words remembered, names half-known..."
        />
      </label>

      <label className="did-field">
        <span>DID</span>
        <input
          type="text"
          name="did"
          maxLength={500}
          defaultValue={filters.did}
          placeholder="Paste a DID to find its messages..."
        />
      </label>

      <label>
        <span>Epoch</span>
        <select name="epoch" defaultValue={filters.epochNumber ?? ""}>
          <option value="">All epochs</option>
          {epochs.map((epoch) => (
            <option key={epoch.epoch_id} value={epoch.epoch_number}>
              Epoch {epoch.epoch_number} · {epoch.message_count} messages
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>From (UTC)</span>
        <input type="date" name="from" defaultValue={filters.fromDate} />
      </label>

      <label>
        <span>Through (UTC)</span>
        <input type="date" name="through" defaultValue={filters.throughDate} />
      </label>

      <div className="filter-actions">
        <button type="submit">Tune archive</button>
        <Link href="/archive">Clear</Link>
      </div>
    </form>
  );
}