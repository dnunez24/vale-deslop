#!/usr/bin/env bun
// Recomputes deterministic eval metrics from committed Markdown, without spending API credit.
//
//   bun run scripts/eval-measure.ts [--run <run-id>|latest] [--corpus-only] [--check]
//
// Default: recomputes `docs[]` and the deterministic fields of `runs[]` (words, alerts,
// alertsPer1k, checks, retention, reduction, rulesFiring, rulesCleared, regressions, and the
// retention-derived "over-deletion" flag) plus `summary` in `evals/runs/<id>/results.json`, from
// the committed `corpus/*.md` and `runs/<id>/**/output.md` files. Also re-checks the suppression
// pattern against each committed output.md, flipping `status`/`invalidReason` to
// `failed`/`suppression` if a marker was hand-added after the run — every other failure reason
// (no-edit, cli-error, config-tampering, skill-not-activated) depends on transcript/scratch-dir
// state this script never sees, so those stay untouched. `judge[]` is untouched too.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type DocMetrics,
  type Measurement,
  type Results,
  type RunRecord,
  SUPPRESSION_PATTERN,
  deltaMetrics,
  measure,
  resolveRunId,
  runsRoot,
  sha256Hex,
  summarize,
} from "./eval-lib.ts";

const corpusRoot = fileURLToPath(new URL("../evals/corpus/", import.meta.url));
const cachePath = fileURLToPath(new URL("../evals/.measure-cache.json", import.meta.url));

function parseArgs(argv: string[]): { run: string; corpusOnly: boolean; check: boolean } {
  let run = "latest";
  let corpusOnly = false;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--run") run = argv[++i] ?? run;
    else if (arg === "--corpus-only") corpusOnly = true;
    else if (arg === "--check") check = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return { run, corpusOnly, check };
}

type Cache = Record<string, Measurement>;

function loadCache(): Cache {
  if (!existsSync(cachePath)) return {};
  return JSON.parse(readFileSync(cachePath, "utf8")) as Cache;
}

function saveCache(cache: Cache): void {
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

/** Measures a batch through the sha256-keyed cache, only calling `measure()` for cache misses. */
function measureCached(items: { key: string; text: string }[], cache: Cache): Map<string, Measurement> {
  const hashByKey = new Map<string, string>();
  const misses: { key: string; text: string }[] = [];
  const out = new Map<string, Measurement>();
  for (const item of items) {
    const hash = sha256Hex(item.text);
    hashByKey.set(item.key, hash);
    const cached = cache[hash];
    if (cached) out.set(item.key, cached);
    else misses.push(item);
  }
  if (misses.length > 0) {
    const measured = measure(misses);
    for (const [key, m] of measured) {
      out.set(key, m);
      cache[hashByKey.get(key)!] = m;
    }
  }
  return out;
}

function listCorpusSlugs(): string[] {
  return readdirSync(corpusRoot)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
}

function measureCorpus(cache: Cache, slugs: string[] = listCorpusSlugs()): DocMetrics[] {
  const items = slugs.map((slug) => ({ key: slug, text: readFileSync(join(corpusRoot, `${slug}.md`), "utf8") }));
  const measured = measureCached(items, cache);
  return slugs.map((slug) => {
    const m = measured.get(slug)!;
    return { slug, path: `corpus/${slug}.md`, ...m };
  });
}

const RETENTION_FLOOR = 0.7;

function withOverDeletionFlag(flags: string[], retention: number): string[] {
  const withoutFlag = flags.filter((f) => f !== "over-deletion");
  return retention < RETENTION_FLOOR ? [...withoutFlag, "over-deletion"] : withoutFlag;
}

function remeasureRun(run: RunRecord, docs: DocMetrics[], cache: Cache): RunRecord {
  const outputAbsPath = fileURLToPath(new URL(`../evals/${run.outputPath}`, import.meta.url));
  const before = docs.find((d) => d.slug === run.doc);
  if (!before) throw new Error(`run ${run.doc}/${run.arm}/r${run.repeat}: no corpus doc named "${run.doc}"`);
  if (!existsSync(outputAbsPath)) {
    // Missing output is a runner-time failure (no-edit, cli-error, ...) already recorded; nothing to remeasure.
    return run;
  }
  const text = readFileSync(outputAbsPath, "utf8");

  if (SUPPRESSION_PATTERN.test(text)) {
    return {
      ...run,
      status: "failed",
      invalidReason: "suppression",
      flags: [],
      words: 0,
      retention: 0,
      alerts: 0,
      alertsPer1k: 0,
      reduction: 0,
      rulesFiring: 0,
      rulesCleared: 0,
      regressions: 0,
      checks: {},
    };
  }

  const [after] = [...measureCached([{ key: "after", text }], cache).values()];
  const delta = deltaMetrics(before, after!);
  return {
    ...run,
    status: "ok",
    invalidReason: null,
    words: after!.words,
    alerts: after!.alerts,
    alertsPer1k: after!.alertsPer1k,
    checks: after!.checks,
    ...delta,
    flags: withOverDeletionFlag(run.flags, delta.retention),
  };
}

function diffField<T>(label: string, committed: T, recomputed: T, report: string[]): void {
  if (!isDeepStrictEqual(committed, recomputed)) {
    report.push(`${label}:\n  committed:  ${JSON.stringify(committed)}\n  recomputed: ${JSON.stringify(recomputed)}`);
  }
}

async function main(): Promise<void> {
  const { run, corpusOnly, check } = parseArgs(process.argv.slice(2));
  const cache = loadCache();

  if (corpusOnly) {
    const docs = measureCorpus(cache);
    saveCache(cache);
    console.log("slug".padEnd(26), "words".padStart(6), "alerts".padStart(7), "checks".padStart(7));
    for (const doc of docs) {
      console.log(doc.slug.padEnd(26), String(doc.words).padStart(6), String(doc.alerts).padStart(7), String(Object.keys(doc.checks).length).padStart(7));
    }
    return;
  }

  const runId = resolveRunId(run);
  const resultsPath = join(runsRoot, runId, "results.json");
  const committed = JSON.parse(readFileSync(resultsPath, "utf8")) as Results;

  const docs = measureCorpus(cache, committed.docs.map((d) => d.slug));
  const runs = committed.runs.map((r) => remeasureRun(r, docs, cache));
  const recomputed: Results = { ...committed, docs, runs, summary: summarize({ ...committed, docs, runs }) };
  saveCache(cache);

  if (check) {
    const report: string[] = [];
    diffField("docs", committed.docs, recomputed.docs, report);
    diffField("runs", committed.runs, recomputed.runs, report);
    diffField("summary", committed.summary, recomputed.summary, report);
    if (report.length > 0) {
      console.error(`evals/runs/${runId}/results.json is out of date:\n\n${report.join("\n\n")}`);
      process.exit(1);
    }
    console.log(`evals/runs/${runId}/results.json matches recomputed metrics`);
    return;
  }

  writeFileSync(resultsPath, `${JSON.stringify(recomputed, null, 2)}\n`);
  console.log(`wrote ${resultsPath}`);
}

await main();
