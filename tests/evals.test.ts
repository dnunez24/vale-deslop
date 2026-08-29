// Fast, no agent calls: corpus coverage is checked directly against Vale; the other checks hold the
// latest committed eval run's artifacts accountable to their own `results.json`. Measuring the 72
// run outputs themselves stays out of `bun test` (the `evals` GitHub Actions workflow owns that, via
// `mise run eval:verify`) so this file doesn't slow the lefthook pre-commit `test` job.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";
import { loadResults, measure, summarize } from "../scripts/eval-lib.ts";

const corpusRoot = fileURLToPath(new URL("../evals/corpus/", import.meta.url));
const evalsRoot = fileURLToPath(new URL("../evals/", import.meta.url));
const reportPath = join(evalsRoot, "REPORT.md");

const MIN_DISTINCT_CHECKS = 20;
const MIN_ALERTS = 60;
const MIN_WORDS = 850;
const MAX_WORDS = 1400;

describe("eval corpus", () => {
  const slugs = readdirSync(corpusRoot)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
  const measured = measure(slugs.map((slug) => ({ key: slug, text: readFileSync(join(corpusRoot, `${slug}.md`), "utf8") })));

  it("has six corpus documents", () => {
    expect(slugs.length).toBe(6);
  });

  for (const slug of slugs) {
    it(`${slug} trips >=${MIN_DISTINCT_CHECKS} distinct checks, >=${MIN_ALERTS} alerts, ${MIN_WORDS}-${MAX_WORDS} words`, () => {
      const m = measured.get(slug)!;
      expect(Object.keys(m.checks).length, `${slug}: distinct checks`).toBeGreaterThanOrEqual(MIN_DISTINCT_CHECKS);
      expect(m.alerts, `${slug}: alerts`).toBeGreaterThanOrEqual(MIN_ALERTS);
      expect(m.words, `${slug}: words`).toBeGreaterThanOrEqual(MIN_WORDS);
      expect(m.words, `${slug}: words`).toBeLessThanOrEqual(MAX_WORDS);
    });
  }
});

describe("latest eval run artifacts", () => {
  it("every ok run's outputPath exists on disk", () => {
    const results = loadResults("latest");
    for (const run of results.runs) {
      if (run.status !== "ok") continue;
      expect(existsSync(join(evalsRoot, run.outputPath)), `${run.doc}/${run.arm}/r${run.repeat}: ${run.outputPath}`).toBe(true);
    }
  });

  it("summarize() recomputed from runs[] deep-equals the committed summary", () => {
    const results = loadResults("latest");
    expect(summarize(results)).toEqual(results.summary);
  });

  it("REPORT.md contains the committed runId and every relative markdown link resolves", () => {
    const results = loadResults("latest");
    const report = readFileSync(reportPath, "utf8");
    expect(report).toContain(results.runId);

    const linkPattern = /\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null = linkPattern.exec(report);
    while (match !== null) {
      const link = match[1]!;
      if (!/^https?:\/\//.test(link)) {
        expect(existsSync(join(evalsRoot, link)), `broken relative link: ${link}`).toBe(true);
      }
      match = linkPattern.exec(report);
    }
  });
});
