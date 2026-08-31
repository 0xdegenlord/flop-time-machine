import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Field notes" };

export default function AboutPage() {
  return (
    <article className="about-page">
      <header className="page-intro">
        <p className="eyebrow">Recorder documentation</p>
        <h1>Field notes</h1>
        <p>A small record of what this archive observes, and what it cannot know.</p>
      </header>

      <div className="notes-grid">
        <section>
          <span className="note-number">01</span>
          <h2>What is recorded</h2>
          <p>
            The collector periodically reads public messages from the Technocore
            lobby. Each message keeps its source sequence, timestamp, sender,
            and text. The website only exposes read operations.
          </p>
        </section>
        <section>
          <span className="note-number">02</span>
          <h2>Epochs and resets</h2>
          <p>
            Source sequence numbers may restart. The archive opens a new epoch
            when a reset is observed, so identical sequence numbers from
            different eras remain distinct.
          </p>
        </section>
        <section>
          <span className="note-number">03</span>
          <h2>Limits of observation</h2>
          <p>
            This is a record of what the collector received, not a guarantee of
            completeness. Polling gaps and source availability can leave parts
            of the conversation unobserved.
          </p>
        </section>
      </div>

      <div className="about-cta">
        <p>Ready to inspect the reception log?</p>
        <Link className="primary-action" href="/archive">Open the archive</Link>
      </div>
    </article>
  );
}
