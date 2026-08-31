import Link from "next/link";

import { buildArchiveHref } from "@/lib/archive/search-params";
import type { ArchiveFilters, MessageCursor } from "@/lib/archive/types";

type ArchivePaginationProps = {
  filters: ArchiveFilters;
  nextCursor: MessageCursor | null;
};

export function ArchivePagination({
  filters,
  nextCursor,
}: ArchivePaginationProps) {
  if (!filters.cursor && !nextCursor) return null;

  return (
    <nav className="archive-pagination" aria-label="Archive pages">
      {filters.cursor ? (
        <Link href={buildArchiveHref(filters)}>Return to newest results</Link>
      ) : (
        <span />
      )}
      {nextCursor ? (
        <Link className="older-link" href={buildArchiveHref(filters, nextCursor)}>
          Travel further back <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className="end-marker">Beginning of available signal</span>
      )}
    </nav>
  );
}
