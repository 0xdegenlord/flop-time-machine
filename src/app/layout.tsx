import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Flop Time Machine",
    template: "%s | Flop Time Machine",
  },
  description: "A searchable, read-only archive of the Technocore lobby.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <SiteHeader />
          <main>{children}</main>
          <footer className="site-footer">
            <span>Technocore lobby field recorder</span>
            <span>All timestamps are UTC</span>
            <a
              className="footer-credit"
              href="https://x.com/0xdegenlord"
              target="_blank"
              rel="noopener noreferrer"
            >
              Built by @0xdegenlord
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
