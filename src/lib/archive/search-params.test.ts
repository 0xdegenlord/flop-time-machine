import { describe, expect, it } from "vitest";

import {
  buildArchiveHref,
  endOfThroughDate,
  parseArchiveSearchParams,
} from "./search-params";

describe("archive search parameters", () => {
  it("parses filters and preserves bigint cursors as text", () => {
    const parsed = parseArchiveSearchParams({
      q: " memory lane ",
      epoch: "3",
      from: "2026-08-01",
      through: "2026-08-31",
      cursorEpoch: "2",
      cursorSeq: "9007199254740993",
    });

    expect(parsed.error).toBeNull();

    expect(parsed.filters).toEqual({
      query: "memory lane",
      did: "",
      epochNumber: 3,
      fromDate: "2026-08-01",
      throughDate: "2026-08-31",
      cursor: { epochNumber: 2, seq: "9007199254740993" },
    });
  });

  it("rejects malformed dates and incomplete cursors", () => {
    const parsed = parseArchiveSearchParams({
      from: "2026-02-30",
      cursorEpoch: "2",
    });

    expect(parsed.error).toContain("start date");
    expect(parsed.error).toContain("cursor");
    expect(parsed.filters.cursor).toBeNull();
  });

  it("builds a shareable next-page URL without stale parameters", () => {
    const href = buildArchiveHref(
      {
        query: "hello world",
        did: "",
        epochNumber: 4,
        fromDate: "",
        throughDate: "2026-08-31",
        cursor: null,
      },
      { epochNumber: 4, seq: "81" },
    );

    expect(href).toBe(
      "/archive?q=hello+world&epoch=4&through=2026-08-31&cursorEpoch=4&cursorSeq=81",
    );
  });

  it("converts an inclusive end date to the RPC's exclusive boundary", () => {
    expect(endOfThroughDate("2026-08-31")).toBe(
      "2026-09-01T00:00:00.000Z",
    );
    expect(endOfThroughDate("")).toBeNull();
  });
});
