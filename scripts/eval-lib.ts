// Shared eval-harness infrastructure: content hashing, the deterministic Vale measurement used by
// eval-measure.ts and the corpus itself, and the aggregation/verdict logic eval-report.ts renders.
// Nothing here calls the `claude` CLI or spends API credit.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { countsByCheck, packageRoot, valeUnion } from "../tests/helpers/vale.ts";

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

// Content-addressed sha256, hex-encoded. Reused wherever an artifact's identity must be pinned and
// later re-verified: vendored skill files (eval-vendor-skills.ts), the built package zip and
// vendored-skill directories (eval-run.ts's manifest), and the per-file measurement cache key
// (eval-measure.ts). One implementation keeps those checks in lockstep.
export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

// Rounds to two decimal places, returning a number (not a string), so re-measures diff cleanly and
// `results.json` never accumulates floating-point noise across a re-run.
function round2(n: number): number {
  return Number(n.toFixed(2));
}

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------

export type Arm = {
  id: string;
  kind: "control" | "skill" | "vale";
  skillName?: string;
  vendorDir?: string;
};

export const ARMS: Arm[] = [
  { id: "control", kind: "control" },
  { id: "skill-humanizer", kind: "skill", skillName: "humanizer", vendorDir: "humanizer" },
  { id: "skill-stephenturner", kind: "skill", skillName: "deslop", vendorDir: "stephenturner" },
  { id: "vale-deslop", kind: "vale" },
];

// The two skill arms are the baselines the pre-registered criteria (C1, C3, C4) compare
// `vale-deslop` against. `control` is the floor, not a baseline: it exists to show what the base
// model does unaided, not to be beaten.
export const BASELINE_ARM_IDS = ["skill-humanizer", "skill-stephenturner"] as const;

// ---------------------------------------------------------------------------
// Word count
// ---------------------------------------------------------------------------

const FENCED_BLOCK = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const INLINE_CODE = /`[^`]*`/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;

export function countWords(markdown: string): number {
  const stripped = markdown
    .replace(FENCED_BLOCK, " ")
    .replace(HTML_COMMENT, " ")
    .replace(INLINE_CODE, " ")
    .replace(MARKDOWN_LINK, "$1");
  return stripped.split(/\s+/).filter((token) => token.length > 0).length;
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export type Measurement = {
  words: number;
  alerts: number;
  alertsPer1k: number;
  checks: Record<string, number>;
};

// Detects a suppression attempt in an arm's output: an HTML comment or inline directive that would
// silence Vale rather than fix the flagged prose. Shared by eval-run.ts (checked at run time) and
// eval-measure.ts (re-checked against committed output.md, so hand-editing suppression markers into
// a committed artifact after the fact is caught too).
export const SUPPRESSION_PATTERN = /<!--\s*vale|vale\s+(off|on)|vale-ignore/i;

const STYLES_PLACEHOLDER = "<repo>/Deslop/styles";

// The fixed yardstick every arm (and the corpus itself) is measured against. Deliberately not the
// repo's own `.vale.ini` (which disables nine document-shape rules and adds Microsoft) and not any
// arm's scratch config: one config, `MinAlertLevel = suggestion`, only `Deslop`. `eval-report.ts`
// embeds this exact text (with the placeholder resolved per-machine at measurement time) in the
// report's Method section.
export const MEASURE_INI = `StylesPath = ${STYLES_PLACEHOLDER}
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Deslop
`;

const stylesPathAbs = join(packageRoot, "styles");

/** One temp directory per call. Runs `valeUnion` once for the whole batch and maps results back by key. */
export function measure(files: { key: string; text: string }[]): Map<string, Measurement> {
  const tmpDir = mkdtempSync(join(tmpdir(), "deslop-measure-"));
  try {
    writeFileSync(join(tmpDir, ".vale.ini"), MEASURE_INI.replace(STYLES_PLACEHOLDER, stylesPathAbs));
    const names = files.map((_, i) => `${i}.md`);
    files.forEach((f, i) => writeFileSync(join(tmpDir, names[i]!), f.text));

    const results = valeUnion(["."], tmpDir);
    // Vale's JSON keys are relative paths as passed on the command line; normalize away a leading
    // "./" defensively so a Vale version change in path formatting can't silently zero out counts.
    const byName = new Map<string, Measurement>();
    for (const [file, alerts] of Object.entries(results)) {
      byName.set(file.replace(/^\.\//, ""), { words: 0, alerts: alerts.length, alertsPer1k: 0, checks: countsByCheck(alerts) });
    }

    const out = new Map<string, Measurement>();
    files.forEach((f, i) => {
      const words = countWords(f.text);
      const found = byName.get(names[i]!);
      const alerts = found?.alerts ?? 0;
      const checks = found?.checks ?? {};
      out.set(f.key, { words, alerts, alertsPer1k: round2(words > 0 ? (alerts / words) * 1000 : 0), checks });
    });
    return out;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function deltaMetrics(
  before: Measurement,
  after: Measurement,
): { reduction: number; rulesFiring: number; rulesCleared: number; regressions: number; retention: number } {
  const reduction = before.alertsPer1k > 0 ? (before.alertsPer1k - after.alertsPer1k) / before.alertsPer1k : 0;
  const rulesFiring = Object.keys(after.checks).length;
  const beforeChecks = new Set(Object.keys(before.checks));
  const afterChecks = new Set(Object.keys(after.checks));
  let rulesCleared = 0;
  for (const check of beforeChecks) if (!afterChecks.has(check)) rulesCleared++;
  let regressions = 0;
  for (const [check, afterCount] of Object.entries(after.checks)) {
    regressions += Math.max(0, afterCount - (before.checks[check] ?? 0));
  }
  const retention = before.words > 0 ? after.words / before.words : 0;
  return { reduction: round2(reduction), rulesFiring, rulesCleared, regressions, retention: round2(retention) };
}

// ---------------------------------------------------------------------------
// Results / Summary / Verdict
// ---------------------------------------------------------------------------

export type RunStatus = "ok" | "failed";

export type DocMetrics = Measurement & { slug: string; path: string };

export type RunRecord = {
  doc: string;
  arm: string;
  repeat: number;
  status: RunStatus;
  invalidReason: string | null;
  flags: string[];
  outputPath: string;
  words: number;
  retention: number;
  alerts: number;
  alertsPer1k: number;
  reduction: number;
  rulesFiring: number;
  rulesCleared: number;
  regressions: number;
  checks: Record<string, number>;
  skillActivated: boolean | null;
  valeInvocations: number | null;
  numTurns: number;
  durationMs: number;
  costUsd: number;
};

export type RubricScores = {
  directness: number;
  rhythm: number;
  trust: number;
  authenticity: number;
  density: number;
};

export type JudgeVote = {
  doc: string;
  baselineArm: string;
  repeat: number;
  voteIndex: number;
  /** Which blinded label ("A" or "B") the vale-deslop output was assigned for this vote. */
  valeLabel: "A" | "B";
  a: RubricScores;
  b: RubricScores;
  fidelityA: number;
  fidelityB: number;
  winner: "A" | "B" | "tie";
  reason: string;
  costUsd: number;
  valid: boolean;
};

export type Preflight = {
  permissionMode: string;
  toolDenyWorks: boolean;
  jsonSchema: boolean;
  skillIsolated: boolean;
};

export type Results = {
  runId: string;
  createdAt: string;
  git: { sha: string; dirty: boolean };
  vale: { version: string; unionRuns: number; packageZipSha256: string };
  models: { actor: string; judge: string };
  skills: Array<{ armId: string; repo: string; sha: string; skillSha256: string }>;
  config: { repeats: number; judgeVotes: number; maxIterations: number; budgetUsd: number };
  preflight: Preflight;
  docs: DocMetrics[];
  runs: RunRecord[];
  judge: JudgeVote[];
  summary: Summary;
};

// A run counts toward headline means only if it reached a clean, ungamed "ok": retention below 0.70
// (over-deletion) is the cheapest way to win an alert-density metric, so it disqualifies the run
// from the mean instead of rewarding it.
export function isEligible(run: RunRecord): boolean {
  return run.status === "ok" && !run.flags.includes("over-deletion");
}

function mean(values: number[]): number {
  return values.length > 0 ? round2(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

export type ArmSummary = {
  armId: string;
  n: number;
  meanAlertsPer1k: number;
  minAlertsPer1k: number;
  maxAlertsPer1k: number;
  meanReduction: number;
  meanRulesFiring: number;
  meanRegressions: number;
  meanRetention: number;
  judgeWinRate: number | null;
  meanRubric: number | null;
  meanFidelity: number | null;
  meanCostUsd: number;
  meanDurationMs: number;
  okCount: number;
  disqualifiedCount: number;
  failedCount: number;
};

export type PerDocArmStat = { doc: string; arm: string; meanAlertsPer1k: number; n: number };

export type JudgePairStat = {
  baselineArm: string;
  aggregates: number;
  valeWins: number;
  baselineWins: number;
  ties: number;
  valeWinRate: number;
  valeMeanFidelity: number;
  baselineMeanFidelity: number;
  valeMeanRubric: number;
  baselineMeanRubric: number;
};

export type Summary = {
  arms: ArmSummary[];
  perDocArm: PerDocArmStat[];
  judgePairs: JudgePairStat[];
};

function rubricMean(scores: RubricScores): number {
  return (scores.directness + scores.rhythm + scores.trust + scores.authenticity + scores.density) / 5;
}

export type JudgeAggregate = {
  doc: string;
  baselineArm: string;
  repeat: number;
  winner: "vale" | "baseline" | "tie";
  valeRubric: number;
  baselineRubric: number;
  valeFidelity: number;
  baselineFidelity: number;
};

// One aggregate per (doc, baselineArm, repeat): majority winner across that repeat's votes
// (un-blinded via `valeLabel`), mean rubric, mean fidelity. A repeat with no majority is a tie.
function aggregateJudgeVotes(votes: JudgeVote[]): JudgeAggregate[] {
  const groups = new Map<string, JudgeVote[]>();
  for (const vote of votes) {
    if (!vote.valid) continue;
    const key = `${vote.doc}\u0000${vote.baselineArm}\u0000${vote.repeat}`;
    const group = groups.get(key) ?? [];
    group.push(vote);
    groups.set(key, group);
  }
  const aggregates: JudgeAggregate[] = [];
  for (const [key, group] of groups) {
    const [doc, baselineArm, repeatStr] = key.split("\u0000") as [string, string, string];
    let valeWins = 0;
    let baselineWins = 0;
    let ties = 0;
    let valeRubricSum = 0;
    let baselineRubricSum = 0;
    let valeFidelitySum = 0;
    let baselineFidelitySum = 0;
    for (const vote of group) {
      const valeScores = vote.valeLabel === "A" ? vote.a : vote.b;
      const baselineScores = vote.valeLabel === "A" ? vote.b : vote.a;
      const valeFidelity = vote.valeLabel === "A" ? vote.fidelityA : vote.fidelityB;
      const baselineFidelity = vote.valeLabel === "A" ? vote.fidelityB : vote.fidelityA;
      valeRubricSum += rubricMean(valeScores);
      baselineRubricSum += rubricMean(baselineScores);
      valeFidelitySum += valeFidelity;
      baselineFidelitySum += baselineFidelity;
      const voteWinner = vote.winner === "tie" ? "tie" : vote.winner === vote.valeLabel ? "vale" : "baseline";
      if (voteWinner === "vale") valeWins++;
      else if (voteWinner === "baseline") baselineWins++;
      else ties++;
    }
    const winner = valeWins > baselineWins && valeWins > ties ? "vale" : baselineWins > valeWins && baselineWins > ties ? "baseline" : "tie";
    aggregates.push({
      doc,
      baselineArm,
      repeat: Number(repeatStr),
      winner,
      valeRubric: valeRubricSum / group.length,
      baselineRubric: baselineRubricSum / group.length,
      valeFidelity: valeFidelitySum / group.length,
      baselineFidelity: baselineFidelitySum / group.length,
    });
  }
  return aggregates;
}

export function summarize(results: Results): Summary {
  const arms: ArmSummary[] = ARMS.map((arm) => {
    const armRuns = results.runs.filter((r) => r.arm === arm.id);
    const okRuns = armRuns.filter((r) => r.status === "ok");
    const eligible = okRuns.filter((r) => isEligible(r));
    const disqualified = okRuns.length - eligible.length;
    const failed = armRuns.filter((r) => r.status === "failed").length;

    const baselinePairs = results.judge.filter((v) => v.valid);
    const aggregates = aggregateJudgeVotes(baselinePairs);
    let judgeWinRate: number | null = null;
    let meanRubric: number | null = null;
    let meanFidelity: number | null = null;
    if (arm.id === "vale-deslop") {
      const relevant = aggregates;
      if (relevant.length > 0) {
        const wins = relevant.filter((a) => a.winner === "vale").length + 0.5 * relevant.filter((a) => a.winner === "tie").length;
        judgeWinRate = round2(wins / relevant.length);
        meanRubric = mean(relevant.map((a) => a.valeRubric));
        meanFidelity = mean(relevant.map((a) => a.valeFidelity));
      }
    } else if ((BASELINE_ARM_IDS as readonly string[]).includes(arm.id)) {
      const relevant = aggregates.filter((a) => a.baselineArm === arm.id);
      if (relevant.length > 0) {
        const wins = relevant.filter((a) => a.winner === "baseline").length + 0.5 * relevant.filter((a) => a.winner === "tie").length;
        judgeWinRate = round2(wins / relevant.length);
        meanRubric = mean(relevant.map((a) => a.baselineRubric));
        meanFidelity = mean(relevant.map((a) => a.baselineFidelity));
      }
    }

    return {
      armId: arm.id,
      n: eligible.length,
      meanAlertsPer1k: mean(eligible.map((r) => r.alertsPer1k)),
      minAlertsPer1k: eligible.length > 0 ? Math.min(...eligible.map((r) => r.alertsPer1k)) : 0,
      maxAlertsPer1k: eligible.length > 0 ? Math.max(...eligible.map((r) => r.alertsPer1k)) : 0,
      meanReduction: mean(eligible.map((r) => r.reduction)),
      meanRulesFiring: mean(eligible.map((r) => r.rulesFiring)),
      meanRegressions: mean(eligible.map((r) => r.regressions)),
      meanRetention: mean(eligible.map((r) => r.retention)),
      judgeWinRate,
      meanRubric,
      meanFidelity,
      meanCostUsd: mean(armRuns.map((r) => r.costUsd)),
      meanDurationMs: mean(armRuns.map((r) => r.durationMs)),
      okCount: okRuns.length,
      disqualifiedCount: disqualified,
      failedCount: failed,
    };
  });

  const docSlugs = [...new Set(results.runs.map((r) => r.doc))];
  const perDocArm: PerDocArmStat[] = [];
  for (const doc of docSlugs) {
    for (const arm of ARMS) {
      const eligible = results.runs.filter((r) => r.doc === doc && r.arm === arm.id && isEligible(r));
      perDocArm.push({ doc, arm: arm.id, meanAlertsPer1k: mean(eligible.map((r) => r.alertsPer1k)), n: eligible.length });
    }
  }

  const validVotes = results.judge.filter((v) => v.valid);
  const aggregates = aggregateJudgeVotes(validVotes);
  const judgePairs: JudgePairStat[] = BASELINE_ARM_IDS.map((baselineArm) => {
    const relevant = aggregates.filter((a) => a.baselineArm === baselineArm);
    const valeWins = relevant.filter((a) => a.winner === "vale").length;
    const baselineWins = relevant.filter((a) => a.winner === "baseline").length;
    const ties = relevant.filter((a) => a.winner === "tie").length;
    const valeWinRate = relevant.length > 0 ? round2((valeWins + 0.5 * ties) / relevant.length) : 0;
    return {
      baselineArm,
      aggregates: relevant.length,
      valeWins,
      baselineWins,
      ties,
      valeWinRate,
      valeMeanFidelity: mean(relevant.map((a) => a.valeFidelity)),
      baselineMeanFidelity: mean(relevant.map((a) => a.baselineFidelity)),
      valeMeanRubric: mean(relevant.map((a) => a.valeRubric)),
      baselineMeanRubric: mean(relevant.map((a) => a.baselineRubric)),
    };
  });

  return { arms, perDocArm, judgePairs };
}

export type VerdictCriterion = { pass: boolean; detail: string };

export function verdict(summary: Summary): { criteria: Record<string, VerdictCriterion>; hypothesisHeld: boolean } {
  const docSlugs = [...new Set(summary.perDocArm.map((p) => p.doc))];

  // C1: vale-deslop's per-doc mean alertsPer1k lower than each baseline's on >=5 of 6 documents.
  const c1PerBaseline = BASELINE_ARM_IDS.map((baseline) => {
    let wins = 0;
    for (const doc of docSlugs) {
      const valeStat = summary.perDocArm.find((p) => p.doc === doc && p.arm === "vale-deslop");
      const baseStat = summary.perDocArm.find((p) => p.doc === doc && p.arm === baseline);
      if (valeStat && baseStat && valeStat.n > 0 && baseStat.n > 0 && valeStat.meanAlertsPer1k < baseStat.meanAlertsPer1k) {
        wins++;
      }
    }
    return { baseline, wins, total: docSlugs.length };
  });
  const c1Pass = c1PerBaseline.every((b) => b.wins >= 5);
  const c1Detail = c1PerBaseline.map((b) => `${b.baseline}: ${b.wins}/${b.total} docs`).join("; ");

  // C2: vale-deslop mean retention >= 0.85.
  const valeSummary = summary.arms.find((a) => a.armId === "vale-deslop");
  const c2Pass = (valeSummary?.meanRetention ?? 0) >= 0.85;
  const c2Detail = `vale-deslop mean retention = ${valeSummary?.meanRetention ?? "n/a"}`;

  // C3: vale-deslop mean judge fidelity >= (each baseline's mean fidelity - 0.5).
  const c3PerBaseline = summary.judgePairs.map((p) => ({
    baseline: p.baselineArm,
    pass: p.aggregates > 0 && p.valeMeanFidelity >= p.baselineMeanFidelity - 0.5,
    valeFidelity: p.valeMeanFidelity,
    baselineFidelity: p.baselineMeanFidelity,
  }));
  const c3Pass = c3PerBaseline.length > 0 && c3PerBaseline.every((b) => b.pass);
  const c3Detail = c3PerBaseline.map((b) => `${b.baseline}: vale ${b.valeFidelity} vs ${b.baselineFidelity} - 0.5`).join("; ");

  // C4: vale-deslop judge win rate >= 0.5 against each baseline on that baseline's own rubric.
  const c4PerBaseline = summary.judgePairs.map((p) => ({ baseline: p.baselineArm, pass: p.aggregates > 0 && p.valeWinRate >= 0.5, winRate: p.valeWinRate }));
  const c4Pass = c4PerBaseline.length > 0 && c4PerBaseline.every((b) => b.pass);
  const c4Detail = c4PerBaseline.map((b) => `${b.baseline}: win rate ${b.winRate}`).join("; ");

  const criteria: Record<string, VerdictCriterion> = {
    C1: { pass: c1Pass, detail: c1Detail },
    C2: { pass: c2Pass, detail: c2Detail },
    C3: { pass: c3Pass, detail: c3Detail },
    C4: { pass: c4Pass, detail: c4Detail },
  };

  return { criteria, hypothesisHeld: c1Pass && c2Pass && c3Pass && c4Pass };
}

const runsRoot = fileURLToPath(new URL("../evals/runs/", import.meta.url));

export function resolveRunId(runId: string | "latest"): string {
  if (runId !== "latest") return runId;
  const latestPath = join(runsRoot, "LATEST");
  return readFileSync(latestPath, "utf8").trim();
}

export function loadResults(runId: string | "latest"): Results {
  const resolvedId = resolveRunId(runId);
  const resultsPath = join(runsRoot, resolvedId, "results.json");
  return JSON.parse(readFileSync(resultsPath, "utf8")) as Results;
}

export { runsRoot };

// Locates a session's persisted transcript. Verified against real session files on this machine
// (~/.claude/projects/**/*.jsonl): the directory name is a sanitized cwd, but the session id
// uniquely names the file regardless of directory, so a recursive glob by id alone is sufficient.
export async function findTranscript(sessionId: string): Promise<string | null> {
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME ?? "", ".claude");
  const glob = new Bun.Glob(`projects/**/${sessionId}.jsonl`);
  for await (const match of glob.scan({ cwd: configDir, absolute: true })) {
    return match;
  }
  return null;
}
