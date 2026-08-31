import type { Database } from "@/lib/supabase/database.types";

type PublicFunctions = Database["public"]["Functions"];

export type ArchiveMessage =
  PublicFunctions["get_lobby_messages"]["Returns"][number];
export type LobbyEpoch = PublicFunctions["get_lobby_epochs"]["Returns"][number];
export type ArchiveStatus =
  PublicFunctions["get_lobby_archive_status"]["Returns"][number];

export type MessageCursor = {
  epochNumber: number;
  seq: string;
};

export type ArchiveFilters = {
  query: string;
  epochNumber: number | null;
  fromDate: string;
  throughDate: string;
  cursor: MessageCursor | null;
};

export type ArchivePage = {
  messages: ArchiveMessage[];
  nextCursor: MessageCursor | null;
};
