import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";
import { countsByCheck, fixturesRoot, ruleNames, valeUnion } from "./helpers/vale.ts";

const RULES_PREFIX = "rules/";
const MD_EXTENSION = /\.md$/;

const rulesFixtureDir = fileURLToPath(new URL("fixtures/rules/", import.meta.url));
const expectedPath = fileURLToPath(new URL("expected-alerts.json", import.meta.url));
const expected: Record<string, Record<string, number>> = await Bun.file(expectedPath).json();

// Single shared union run covers every assertion in this file; never re-invoke Vale per test.
const results = valeUnion(["."], fixturesRoot);

describe("rule fixtures", () => {
  it("has exactly one fixture per rule", () => {
    const fixtureNames = readdirSync(rulesFixtureDir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.replace(MD_EXTENSION, ""))
      .sort();
    expect(fixtureNames).toEqual(ruleNames());
  });

  it.each(ruleNames())("Deslop.%s fires on its own fixture", (rule) => {
    const file = `${RULES_PREFIX}${rule}.md`;
    expect(expected[file]).toBeDefined();
    expect(expected[file]?.[`Deslop.${rule}`] ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("matches the committed alert-count map for every rule fixture", () => {
    const actual: Record<string, Record<string, number>> = {};
    for (const [file, alerts] of Object.entries(results)) {
      if (file.startsWith(RULES_PREFIX)) actual[file] = countsByCheck(alerts);
    }
    const expectedSlice: Record<string, Record<string, number>> = {};
    for (const [file, counts] of Object.entries(expected)) {
      if (file.startsWith(RULES_PREFIX)) expectedSlice[file] = counts;
    }
    expect(actual).toEqual(expectedSlice);
  });
});
