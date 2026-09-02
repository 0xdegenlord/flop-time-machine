import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Flop Time Machine home">
        <span className="brand-mark" aria-hidden="true">
          FTM
        </span>
        <span>Flop Time Machine</span>
      </Link>
      <nav className="site-nav" aria-label="Primary navigation">
        <Link href="/archive">Archive</Link>
        <Link href="/about">Field notes</Link>
      </nav>
    </header>
  );
}
