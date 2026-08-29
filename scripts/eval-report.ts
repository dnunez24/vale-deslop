#!/usr/bin/env bun
// Renders evals/REPORT.md from a run's committed results.json. Deterministic and offline: no API
// calls, no re-measurement (that's eval-measure.ts's job). `--check` regenerates in memory and
// exits 1 on any difference from the committed file, so a stale report fails CI instead of drifting
// silently from the artifacts it claims to describe.
//
//   bun run scripts/eval-report.ts [--run <id>|latest] [--check]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARMS, type ArmSummary, MEASURE_INI, type Results, type RunRecord, isEligible, loadResults, resolveRunId, verdict } from "./eval-lib.ts";

const reportPath = fileURLToPath(new URL("../evals/REPORT.md", import.meta.url));

function parseArgs(argv: string[]): { run: string; check: boolean } {
  let run = "latest";
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--run") run = argv[++i] ?? run;
    else if (argv[i] === "--check") check = true;
  }
  return { run, check };
}

const ARM_LABELS: Record<string, string> = {
  control: "control (bare model)",
  "skill-humanizer": "skill-humanizer (blader/humanizer)",
  "skill-stephenturner": "skill-stephenturner (stephenturner/skill-deslop)",
  "vale-deslop": "vale-deslop (this package)",
};

function fmt(n: number | null, digits = 2): string {
  return n === null ? "n/a" : n.toFixed(digits);
}

function pct(n: number | null): string {
  return n === null ? "n/a" : `${(n * 100).toFixed(0)}%`;
}

function truncate(text: string, maxChars: number): string {
  const trimmed = text.trim();
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed;
}

function firstNonHeadingParagraph(markdown: string): string {
  const lines = markdown.split("\n");
  const paragraph: string[] = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      started = true;
    }
    if (started) {
      if (trimmed === "") break;
      paragraph.push(trimmed);
    }
  }
  return paragraph.join(" ");
}

function renderMetadata(results: Results): string {
  const totalCost = results.runs.reduce((sum, r) => sum + r.costUsd, 0) + results.judge.reduce((sum, v) => sum + v.costUsd, 0);
  const lines = [
    "## Run metadata",
    "",
    `- Run id: \`${results.runId}\``,
    `- Created: ${results.createdAt}`,
    `- Git: \`${results.git.sha}\`${results.git.dirty ? " (dirty working tree)" : ""}`,
    `- Vale: ${results.vale.version}, ${results.vale.unionRuns} union runs per measurement`,
    `- Package zip sha256: \`${results.vale.packageZipSha256}\``,
    `- Actor model: \`${results.models.actor}\`, judge model: \`${results.models.judge}\``,
    ...results.skills.map((s) => `- ${s.armId}: [\`${s.repo}\`](https://github.com/${s.repo}) @ \`${s.sha}\``),
    `- Repeats: ${results.config.repeats}, judge votes: ${results.config.judgeVotes}, budget: $${results.config.budgetUsd}`,
    `- Total spend: $${totalCost.toFixed(2)}`,
    "",
  ];
  return lines.join("\n");
}

function renderMethod(): string {
  return [
    "## Method",
    "",
    "Four arms edit the same corpus document with the same shared task text. Only the intervention differs:",
    "",
    "| Arm | Intervention |",
    "| --- | --- |",
    "| `control` | none (bare model) |",
    "| `skill-humanizer` | [`blader/humanizer`](https://github.com/blader/humanizer), skill `humanizer` |",
    "| `skill-stephenturner` | [`stephenturner/skill-deslop`](https://github.com/stephenturner/skill-deslop), skill `deslop` |",
    "| `vale-deslop` | this package's built `Deslop.zip`, plus a `vale` fix loop (max 8 iterations) |",
    "",
    "Shared task text (`evals/prompts/shared.md`), identical across every arm:",
    "",
    "> Rewrite deslop.md's prose so it no longer reads as AI-generated, preserving every factual claim, heading, list, table, and code block, within 15% of the original word count.",
    "",
    "Every document is measured before and after with the same fixed Vale configuration — not the repo's own `.vale.ini`, and not any arm's scratch config:",
    "",
    "```ini",
    MEASURE_INI.trim(),
    "```",
    "",
    "Metric formulas:",
    "",
    "- `alertsPer1k = alerts / words * 1000`",
    "- `reduction = (beforeAlertsPer1k - afterAlertsPer1k) / beforeAlertsPer1k`",
    "- `rulesFiring` = distinct checks in the after document",
    "- `rulesCleared` = size of (before check set minus after check set)",
    "- `regressions` = sum over checks of max(0, afterCount - beforeCount)",
    "- `retention = afterWords / beforeWords`",
    "",
    "A run with `retention < 0.70` is flagged `over-deletion`: it counts as `ok` but is excluded from the headline means below (deleting content is the cheapest way to win an alert-density metric, so it must cost the arm its result rather than earn it one).",
    "",
  ].join("\n");
}

function renderHeadline(results: Results): string {
  const rows = results.summary.arms.map((s: ArmSummary) => {
    const label = ARM_LABELS[s.armId] ?? s.armId;
    return `| ${label} | ${fmt(s.meanAlertsPer1k)} (${fmt(s.minAlertsPer1k)}–${fmt(s.maxAlertsPer1k)}) | ${pct(s.meanReduction)} | ${fmt(s.meanRulesFiring)} | ${fmt(s.meanRegressions)} | ${fmt(s.meanRetention)} | ${pct(s.judgeWinRate)} | ${fmt(s.meanRubric)} | ${fmt(s.meanFidelity)} | $${fmt(s.meanCostUsd)} | ${fmt(s.meanDurationMs, 0)}ms | ${s.okCount}/${s.disqualifiedCount}/${s.failedCount} |`;
  });
  return [
    "## Headline results",
    "",
    "| Arm | Mean alerts/1k (min–max) | Mean reduction | Mean rules firing | Mean regressions | Mean retention | Judge win rate vs. counterpart | Mean rubric | Mean fidelity | Mean cost | Mean duration | ok/disqualified/failed |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "\"Judge win rate vs. counterpart\": for `vale-deslop`, its win rate across every judged pair against both baselines; for each skill arm, its win rate against `vale-deslop` specifically. `control` is never judged (it has no vale-deslop pairing) and shows n/a.",
    "",
  ].join("\n");
}

function renderPerDocument(results: Results): string {
  const sections: string[] = ["## Per-document results", ""];
  for (const doc of results.docs) {
    sections.push(`### ${doc.slug}`, "");
    sections.push(`[before](corpus/${doc.slug}.md) — ${doc.words} words, ${doc.alerts} alerts, ${Object.keys(doc.checks).length} distinct checks`, "");
    const sourceText = existsSync(fileURLToPath(new URL(`../evals/corpus/${doc.slug}.md`, import.meta.url)))
      ? readFileSync(fileURLToPath(new URL(`../evals/corpus/${doc.slug}.md`, import.meta.url)), "utf8")
      : "";

    const rows: string[] = [];
    const samples: string[] = [`**Source** (r1): ${truncate(firstNonHeadingParagraph(sourceText), 240)}`];
    for (const arm of ARMS) {
      const runsForArm = results.runs.filter((r: RunRecord) => r.doc === doc.slug && r.arm === arm.id);
      const r1 = runsForArm.find((r) => r.repeat === 1);
      const eligible = runsForArm.filter(isEligible);
      const meanAlertsPer1k = eligible.length > 0 ? eligible.reduce((s, r) => s + r.alertsPer1k, 0) / eligible.length : null;
      const meanRetention = eligible.length > 0 ? eligible.reduce((s, r) => s + r.retention, 0) / eligible.length : null;
      rows.push(
        `| ${ARM_LABELS[arm.id] ?? arm.id} | ${meanAlertsPer1k === null ? "n/a" : meanAlertsPer1k.toFixed(2)} | ${meanRetention === null ? "n/a" : meanRetention.toFixed(2)} | ${eligible.length}/${runsForArm.length} |`,
      );
      if (r1 && r1.status === "ok" && r1.outputPath) {
        const outAbs = fileURLToPath(new URL(`../evals/${r1.outputPath}`, import.meta.url));
        const text = existsSync(outAbs) ? readFileSync(outAbs, "utf8") : "";
        samples.push(`**${ARM_LABELS[arm.id] ?? arm.id}** ([after](${r1.outputPath})): ${truncate(firstNonHeadingParagraph(text), 240)}`);
      }
    }

    sections.push("| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |", "| --- | --- | --- | --- |", ...rows, "");
    sections.push("**Sample transformation** (first paragraph, repeat 1):", "");
    for (const sample of samples) sections.push(`- ${sample}`);
    sections.push("");
  }
  return sections.join("\n");
}

function renderValidity(results: Results): string {
  const failed = results.runs.filter((r) => r.status === "failed");
  const overDeletion = results.runs.filter((r) => r.flags.includes("over-deletion"));
  const skillNotActivated = results.runs.filter((r) => r.invalidReason === "skill-not-activated");
  const invalidVotes = results.judge.filter((v) => !v.valid);

  const lines = ["## Validity", ""];
  lines.push(`- Failed runs: ${failed.length}`);
  for (const r of failed) lines.push(`  - \`${r.doc}/${r.arm}/r${r.repeat}\`: ${r.invalidReason}`);
  lines.push(`- Over-deletion flags (excluded from headline means): ${overDeletion.length}`);
  for (const r of overDeletion) lines.push(`  - \`${r.doc}/${r.arm}/r${r.repeat}\`: retention ${r.retention}`);
  lines.push(`- Skill-not-activated occurrences: ${skillNotActivated.length}`);
  for (const r of skillNotActivated) lines.push(`  - \`${r.doc}/${r.arm}/r${r.repeat}\``);
  lines.push(`- Invalid judge votes: ${invalidVotes.length}`);
  for (const v of invalidVotes) lines.push(`  - \`${v.doc}/${v.baselineArm}/r${v.repeat}/vote${v.voteIndex}\`: ${v.reason}`);
  lines.push("");
  return lines.join("\n");
}

function renderVerdict(results: Results): string {
  const { criteria, hypothesisHeld } = verdict(results.summary);
  const lines = ["## Verdict", ""];
  for (const [id, criterion] of Object.entries(criteria)) {
    lines.push(`- **${id}** — ${criterion.pass ? "PASS" : "FAIL"}: ${criterion.detail}`);
  }
  lines.push("", `Hypothesis held: ${hypothesisHeld ? "yes" : "no"}`, "");
  return lines.join("\n");
}

function renderReport(results: Results): string {
  return [
    "# Deslop eval report",
    "",
    "Vale Deslop vs. agent deslop skills, on a pre-registered corpus with a pre-registered verdict. See `evals/README.md` for how to reproduce this report.",
    "",
    renderMetadata(results),
    renderMethod(),
    renderHeadline(results),
    renderPerDocument(results),
    renderValidity(results),
    renderVerdict(results),
  ].join("\n");
}

async function main(): Promise<void> {
  const { run, check } = parseArgs(process.argv.slice(2));
  const runId = resolveRunId(run);
  const results = loadResults(runId);
  const report = renderReport(results);

  if (check) {
    const committed = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;
    if (committed !== report) {
      console.error(`evals/REPORT.md is out of date for run ${runId}. Run \`bun run scripts/eval-report.ts\` and commit the result.`);
      process.exit(1);
    }
    console.log(`evals/REPORT.md matches recomputed report for run ${runId}`);
    return;
  }

  writeFileSync(reportPath, report);
  console.log(`wrote ${reportPath}`);
}

await main();
