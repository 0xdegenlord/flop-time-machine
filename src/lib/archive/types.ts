export type ArchiveFilters = {
  query: string;
  did: string;
  epochNumber: number | null;
  fromDate: string;
  throughDate: string;
  cursor: MessageCursor | null;
};