import type { Metadata } from "next";

import { ArchiveFilterForm } from "@/components/archive-filters";
import { ArchivePagination } from "@/components/archive-pagination";
import { ArchiveStatus } from "@/components/archive-status";
import { DataError } from "@/components/data-error";
import { MessageList } from "@/components/message-list";
import {
  getLobbyArchiveStatus,
  getLobbyEpochs,
  getLobbyMessages,
} from "@/lib/archive/queries";
import {
  parseArchiveSearchParams,
  type RawSearchParams,
} from "@/lib/archive/search-params";
import type {
  ArchivePage,
  ArchiveStatus as ArchiveStatusData,
  LobbyEpoch,
} from "@/lib/archive/types";

export const metadata: Metadata = { title: "Archive" };
export const dynamic = "force-dynamic";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { filters, error: parameterError } = parseArchiveSearchParams(await searchParams);
  let epochs: LobbyEpoch[] = [];
  let page: ArchivePage = { messages: [], nextCursor: null };
  let status: ArchiveStatusData | null = null;
  let dataError: string | null = null;

  try {
    [epochs, page, status] = await Promise.all([
      getLobbyEpochs(),
      getLobbyMessages(filters),
      getLobbyArchiveStatus(),
    ]);
  } catch (error) {
    dataError = error instanceof Error ? error.message : "Archive data could not be loaded.";
  }

  return (
    <div className="archive-page">
      <header className="page-intro">
        <p className="eyebrow">Indexed reception log</p>
        <h1>The archive</h1>
        <p>Search message text or narrow the recording by epoch and UTC date.</p>
      </header>
      {dataError ? (
        <DataError message={dataError} />
      ) : (
        <>
          <ArchiveStatus status={status} />
          <ArchiveFilterForm filters={filters} epochs={epochs} />
          {parameterError && <DataError message={parameterError} />}
          <div className="results-heading">
            <h2>{filters.query ? `Matches for “${filters.query}”` : "Recorded messages"}</h2>
            <span>{page.messages.length} shown</span>
          </div>
          <MessageList messages={page.messages} />
          <ArchivePagination filters={filters} nextCursor={page.nextCursor} />
        </>
      )}
    </div>
  );
}
