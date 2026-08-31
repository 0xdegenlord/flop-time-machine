import Link from "next/link";

import { ArchiveStatus } from "@/components/archive-status";
import { DataError } from "@/components/data-error";
import { MessageList } from "@/components/message-list";
import {
  getLobbyArchiveStatus,
  getRecentLobbyMessages,
} from "@/lib/archive/queries";
import type { ArchiveMessage, ArchiveStatus as ArchiveStatusData } from "@/lib/archive/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let status: ArchiveStatusData | null = null;
  let messages: ArchiveMessage[] = [];
  let dataError: string | null = null;

  try {
    [status, messages] = await Promise.all([
      getLobbyArchiveStatus(),
      getRecentLobbyMessages(),
    ]);
  } catch (error) {
    dataError = error instanceof Error ? error.message : "Archive data could not be loaded.";
  }

  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">Continuous lobby observation / read only</p>
          <h1>Messages fade.<br />The signal remains.</h1>
          <p className="hero-intro">
            Flop Time Machine records the public Technocore lobby as a sequence
            of observable moments, preserving what would otherwise scroll away.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/archive">Enter the archive</Link>
            <Link className="text-action" href="/about">Read the field notes</Link>
          </div>
        </div>
        <div className="dial" aria-hidden="true">
          <div className="dial-ring">
            <span>REC</span>
            <strong>LOBBY</strong>
            <small>UTC</small>
          </div>
        </div>
      </section>

      {dataError ? <DataError message={dataError} /> : <ArchiveStatus status={status} />}

      <section className="recent-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Latest reception</p>
            <h2>Recent transmissions</h2>
          </div>
          <Link href="/archive">Search all messages</Link>
        </div>
        {!dataError && <MessageList messages={messages} />}
      </section>
    </>
  );
}
