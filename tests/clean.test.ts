import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";
import { countsByCheck, fixturesRoot, valeUnion } from "./helpers/vale.ts";

const CLEAN_PREFIX = "clean/";
const MD_EXTENSION = /\.md$/;

const CLEAN_GENRES = [
  "academic",
  "business-memo",
  "fiction",
  "howto",
  "journalism",
  "legal-policy",
  "marketing-honest",
  "personal-essay",
  "technical-reference",
].sort();

const cleanFixtureDir = fileURLToPath(new URL("fixtures/clean/", import.meta.url));
const expectedPath = fileURLToPath(new URL("expected-alerts.json", import.meta.url));
const expected: Record<string, Record<string, number>> = await Bun.file(expectedPath).json();

// Single shared union run covers every assertion in this file; never re-invoke Vale per test.
const results = valeUnion(["."], fixturesRoot);

describe("clean corpus", () => {
  it("covers all nine prose genres", () => {
    const genres = readdirSync(cleanFixtureDir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.replace(MD_EXTENSION, ""))
      .sort();
    expect(genres).toEqual(CLEAN_GENRES);
  });

  it("matches the committed alert-count map for the clean corpus", () => {
    const actual: Record<string, Record<string, number>> = {};
    for (const [file, alerts] of Object.entries(results)) {
      if (file.startsWith(CLEAN_PREFIX)) actual[file] = countsByCheck(alerts);
    }
    const expectedSlice: Record<string, Record<string, number>> = {};
    for (const [file, counts] of Object.entries(expected)) {
      if (file.startsWith(CLEAN_PREFIX)) expectedSlice[file] = counts;
    }
    expect(actual).toEqual(expectedSlice);
  });

  // clean/fiction.md is literary prose that uses em dashes on purpose, which is the honest scope
  // boundary of the EmDash* family -- a fiction author disables them rather than the rule
  // special-casing literary genres it cannot detect.
  it("raises no error or warning outside the fiction em-dash allowance", () => {
    const ALLOWED_NON_SUGGESTIONS = new Set([
      "clean/fiction.md\u0000Deslop.EmDashDocumentLimit",
      "clean/fiction.md\u0000Deslop.EmDashEmphasis",
    ]);
    const offenders: string[] = [];
    for (const [file, alerts] of Object.entries(results)) {
      if (!file.startsWith(CLEAN_PREFIX)) continue;
      for (const alert of alerts) {
        if (alert.Severity === "suggestion") continue;
        const key = `${file}\u0000${alert.Check}`;
        if (!ALLOWED_NON_SUGGESTIONS.has(key)) {
          offenders.push(`${key} (${alert.Severity})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
