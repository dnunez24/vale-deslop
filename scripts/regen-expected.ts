#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { countsByCheck, fixturesRoot, valeUnion } from "../tests/helpers/vale.ts";

const results = valeUnion(["."], fixturesRoot);

const expected: Record<string, Record<string, number>> = {};
for (const [file, alerts] of Object.entries(results)) {
  const counts = countsByCheck(alerts);
  if (Object.keys(counts).length > 0) expected[file] = counts;
}

const sorted: Record<string, Record<string, number>> = {};
for (const key of Object.keys(expected).sort()) {
  sorted[key] = expected[key];
}

const outPath = fileURLToPath(new URL("../tests/expected-alerts.json", import.meta.url));
writeFileSync(outPath, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`wrote ${outPath}`);
