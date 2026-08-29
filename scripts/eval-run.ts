#!/usr/bin/env bun
// Runs the four-arm eval: every corpus document, edited by every arm, `--repeats` times each, then
// (unless `--no-judge`) blind-judges vale-deslop against each skill baseline. Spends real API
// credit. Reads `evals/runs/.preflight.json` (written by `eval-preflight.ts`) for the flag set that
// actually works on this CLI/account instead of re-deciding it here.
//
//   bun run scripts/eval-run.ts [--docs a,b] [--arms a,b] [--repeats 3] [--judge-votes 3]
//                               [--no-judge] [--budget 25] [--actor-model sonnet]
//                               [--judge-model opus] [--run-id <id>] [--keep-scratch]
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARMS,
  type Arm,
  BASELINE_ARM_IDS,
  type JudgeVote,
  type Preflight,
  type Results,
  type RubricScores,
  type RunRecord,
  SUPPRESSION_PATTERN,
  deltaMetrics,
  findTranscript,
  measure,
  runsRoot,
  sha256Hex,
  summarize,
} from "./eval-lib.ts";
import { detectSkillActivation } from "./eval-preflight.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const evalsRoot = join(repoRoot, "evals");
const corpusRoot = join(evalsRoot, "corpus");
const skillsRoot = join(evalsRoot, "skills");
const promptsRoot = join(evalsRoot, "prompts");
const scratchRoot = join(evalsRoot, ".scratch");
const preflightCachePath = join(runsRoot, ".preflight.json");

const MAX_ITERATIONS_NOTE = 8; // Vale arm's stop-loop cap; enforced by the arm's own prompt, recorded in config.
const RETENTION_FLOOR = 0.7;
const ARM_CALL_BUDGET_USD = 1.0;
const JUDGE_CALL_BUDGET_USD = 0.5;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

type CliArgs = {
  docs: string[] | null;
  arms: string[] | null;
  repeats: number;
  judgeVotes: number;
  noJudge: boolean;
  budget: number;
  actorModel: string;
  judgeModel: string;
  runId: string | null;
  keepScratch: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    docs: null,
    arms: null,
    repeats: 3,
    judgeVotes: 3,
    noJudge: false,
    budget: 25,
    actorModel: "sonnet",
    judgeModel: "opus",
    runId: null,
    keepScratch: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--docs") args.docs = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (arg === "--arms") args.arms = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (arg === "--repeats") args.repeats = Number(argv[++i]);
    else if (arg === "--judge-votes") args.judgeVotes = Number(argv[++i]);
    else if (arg === "--no-judge") args.noJudge = true;
    else if (arg === "--budget") args.budget = Number(argv[++i]);
    else if (arg === "--actor-model") args.actorModel = argv[++i] ?? args.actorModel;
    else if (arg === "--judge-model") args.judgeModel = argv[++i] ?? args.judgeModel;
    else if (arg === "--run-id") args.runId = argv[++i] ?? null;
    else if (arg === "--keep-scratch") args.keepScratch = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Shell / git helpers
// ---------------------------------------------------------------------------

function sh(cmd: string[], cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const proc = Bun.spawnSync({ cmd, cwd, stdout: "pipe", stderr: "pipe" });
  return { stdout: proc.stdout.toString("utf8"), stderr: proc.stderr.toString("utf8"), exitCode: proc.exitCode };
}

function gitShortSha(): string {
  const { stdout, exitCode } = sh(["git", "rev-parse", "--short", "HEAD"], repoRoot);
  if (exitCode !== 0) throw new Error("git rev-parse failed; is this a git checkout?");
  return stdout.trim();
}

function gitDirty(): boolean {
  const { stdout } = sh(["git", "status", "--porcelain"], repoRoot);
  return stdout.trim().length > 0;
}

function utcRunTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

// ---------------------------------------------------------------------------
// `claude` CLI invocation
// ---------------------------------------------------------------------------

type ClaudeJsonResult = {
  result?: string;
  is_error?: boolean;
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
};

type ClaudeCallOutcome = {
  ok: boolean;
  resultText: string;
  sessionId: string | null;
  costUsd: number;
  durationMs: number;
  numTurns: number;
  raw: string;
};

function invokeClaude(cwd: string, promptText: string, flags: string[]): ClaudeCallOutcome {
  const proc = Bun.spawnSync({
    cmd: ["claude", "-p", "--output-format", "json", ...flags],
    cwd,
    stdin: Buffer.from(promptText, "utf8"),
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = proc.stdout.toString("utf8");
  const stderr = proc.stderr.toString("utf8");
  const raw = stdout.trim() ? stdout : stderr;
  let json: ClaudeJsonResult = {};
  try {
    json = JSON.parse(raw) as ClaudeJsonResult;
  } catch {
    // leave json empty; caller sees ok:false with the raw text
  }
  return {
    ok: proc.exitCode === 0 && json.is_error !== true,
    resultText: json.result ?? "",
    sessionId: json.session_id ?? null,
    costUsd: json.total_cost_usd ?? 0,
    durationMs: json.duration_ms ?? 0,
    numTurns: json.num_turns ?? 0,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Preflight record
// ---------------------------------------------------------------------------

type PreflightRecord = {
  resolvedActorModel: string;
  judgeModel: string;
  preflight: Preflight;
};

function loadPreflight(): PreflightRecord {
  if (!existsSync(preflightCachePath)) {
    throw new Error(`missing ${preflightCachePath}: run \`bun run scripts/eval-preflight.ts\` first`);
  }
  const raw = JSON.parse(readFileSync(preflightCachePath, "utf8")) as {
    resolvedActorModel: string;
    judgeModel: string;
    preflight: Preflight;
  };
  return { resolvedActorModel: raw.resolvedActorModel, judgeModel: raw.judgeModel, preflight: raw.preflight };
}

/** The base `--permission-mode` plus tool flags, given P3's resolved mechanism and the arm kind. */
function permissionFlags(preflight: Preflight, arm: Arm): string[] {
  const mode = preflight.permissionMode;
  const denyBash = mode === "bypassPermissions" ? ["--disallowedTools", "Bash"] : ["--allowedTools", "Read,Edit,Write"];
  const allowValeOnly = mode === "bypassPermissions" ? ["--allowedTools", "Bash(vale *)"] : ["--allowedTools", "Read,Edit,Write,Bash(vale *)"];
  const base = ["--permission-mode", mode];
  if (arm.kind === "vale") return [...base, ...allowValeOnly];
  return [...base, ...denyBash];
}

function armFlags(preflight: Preflight, arm: Arm): string[] {
  const isolation = arm.kind === "skill" ? ["--setting-sources", "project"] : ["--safe-mode"];
  return [...isolation, ...permissionFlags(preflight, arm)];
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const sharedPrompt = readFileSync(join(promptsRoot, "shared.md"), "utf8");

function promptFor(arm: Arm): string {
  if (arm.kind === "control") return sharedPrompt;
  if (arm.kind === "vale") return `${sharedPrompt}\n${readFileSync(join(promptsRoot, "vale-deslop.md"), "utf8")}`;
  const skillPrompt = readFileSync(join(promptsRoot, "skill.md"), "utf8").replace("{{SKILL_NAME}}", arm.skillName!);
  return `${sharedPrompt}\n${skillPrompt}`;
}

// ---------------------------------------------------------------------------
// Scratch setup
// ---------------------------------------------------------------------------

function setupScratch(dir: string, doc: string, arm: Arm, packageZipPath: string): { valeIniSha256: string | null } {
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(corpusRoot, `${doc}.md`), join(dir, "deslop.md"));

  if (arm.kind === "skill") {
    const skillDir = join(dir, ".claude", "skills", arm.skillName!);
    mkdirSync(skillDir, { recursive: true });
    cpSync(join(skillsRoot, arm.vendorDir!), skillDir, { recursive: true, filter: (src) => !src.endsWith("SOURCE.json") });
  }

  if (arm.kind === "vale") {
    const iniText = `StylesPath = styles\nMinAlertLevel = suggestion\nPackages = ${packageZipPath}\n\n[*.md]\nBasedOnStyles = Deslop\n`;
    writeFileSync(join(dir, ".vale.ini"), iniText);
    const sync = sh(["vale", "--no-global", "--config=.vale.ini", "sync"], dir);
    if (sync.exitCode !== 0) throw new Error(`vale sync failed in ${dir}: ${sync.stderr}`);
    return { valeIniSha256: sha256Hex(iniText) };
  }

  return { valeIniSha256: null };
}


const ALLOWED_VALE_SCRATCH_ENTRIES: Record<string, true> = { "deslop.md": true, ".vale.ini": true, styles: true, ".claude": true, ".vale": true };

function scratchTamperedForValeArm(dir: string): boolean {
  for (const entry of readdirSync(dir)) {
    if (!ALLOWED_VALE_SCRATCH_ENTRIES[entry]) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// One (doc, arm, repeat) run
// ---------------------------------------------------------------------------

type AttemptOutcome = {
  status: "ok" | "failed";
  invalidReason: string | null;
  flags: string[];
  outputText: string | null;
  skillActivated: boolean | null;
  valeInvocations: number | null;
  costUsd: number;
  durationMs: number;
  numTurns: number;
};

async function runOneAttempt(doc: string, arm: Arm, sourceText: string, preflight: PreflightRecord, packageZipPath: string, keepScratch: boolean): Promise<AttemptOutcome> {
  const dir = mkdtempSync(join(scratchRoot, `${doc}-${arm.id}-`));
  try {
    const { valeIniSha256 } = setupScratch(dir, doc, arm, packageZipPath);
    const outcome = invokeClaude(dir, promptFor(arm), armFlags(preflight.preflight, arm));

    const outputPath = join(dir, "deslop.md");
    const outputText = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : null;

    if (!outcome.ok) {
      return { status: "failed", invalidReason: "cli-error", flags: [], outputText: null, skillActivated: null, valeInvocations: null, costUsd: outcome.costUsd, durationMs: outcome.durationMs, numTurns: outcome.numTurns };
    }
    if (outputText === null || outputText.trim().length === 0 || outputText === sourceText) {
      return { status: "failed", invalidReason: "no-edit", flags: [], outputText: null, skillActivated: null, valeInvocations: null, costUsd: outcome.costUsd, durationMs: outcome.durationMs, numTurns: outcome.numTurns };
    }
    if (SUPPRESSION_PATTERN.test(outputText)) {
      return { status: "failed", invalidReason: "suppression", flags: [], outputText: null, skillActivated: null, valeInvocations: null, costUsd: outcome.costUsd, durationMs: outcome.durationMs, numTurns: outcome.numTurns };
    }
    if (arm.kind === "vale") {
      const currentIniSha = sha256Hex(readFileSync(join(dir, ".vale.ini")));
      if (currentIniSha !== valeIniSha256 || scratchTamperedForValeArm(dir)) {
        return { status: "failed", invalidReason: "config-tampering", flags: [], outputText: null, skillActivated: null, valeInvocations: null, costUsd: outcome.costUsd, durationMs: outcome.durationMs, numTurns: outcome.numTurns };
      }
    }

    let skillActivated: boolean | null = null;
    let valeInvocations: number | null = null;
    if (outcome.sessionId) {
      const transcriptPath = await findTranscript(outcome.sessionId);
      if (transcriptPath) {
        const transcript = readFileSync(transcriptPath, "utf8");
        if (arm.kind === "skill") skillActivated = detectSkillActivation(transcript, arm.skillName!);
        if (arm.kind === "vale") valeInvocations = countValeInvocations(transcript);
      }
    }
    if (arm.kind === "skill" && skillActivated === false) {
      return { status: "failed", invalidReason: "skill-not-activated", flags: [], outputText: null, skillActivated, valeInvocations, costUsd: outcome.costUsd, durationMs: outcome.durationMs, numTurns: outcome.numTurns };
    }

    return { status: "ok", invalidReason: null, flags: [], outputText, skillActivated, valeInvocations, costUsd: outcome.costUsd, durationMs: outcome.durationMs, numTurns: outcome.numTurns };
  } finally {
    if (!keepScratch) rmSync(dir, { recursive: true, force: true });
  }
}

function countValeInvocations(transcript: string): number {
  let count = 0;
  for (const line of transcript.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (typeof obj !== "object" || obj === null || !("message" in obj)) continue;
    const message = obj.message;
    if (typeof message !== "object" || message === null || !("content" in message)) continue;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (typeof block !== "object" || block === null) continue;
      if (!("type" in block) || !("name" in block)) continue;
      if (block.type !== "tool_use" || block.name !== "Bash") continue;
      if (!("input" in block) || typeof block.input !== "object" || block.input === null) continue;
      if (!("command" in block.input)) continue;
      const command = block.input.command;
      if (typeof command === "string" && command.includes("vale ")) count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Judge
// ---------------------------------------------------------------------------

const judgePromptTemplate = readFileSync(join(promptsRoot, "judge.md"), "utf8");

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["a", "b", "fidelity_a", "fidelity_b", "winner", "reason"],
  properties: {
    a: {
      type: "object",
      additionalProperties: false,
      required: ["directness", "rhythm", "trust", "authenticity", "density"],
      properties: {
        directness: { type: "integer", minimum: 1, maximum: 10 },
        rhythm: { type: "integer", minimum: 1, maximum: 10 },
        trust: { type: "integer", minimum: 1, maximum: 10 },
        authenticity: { type: "integer", minimum: 1, maximum: 10 },
        density: { type: "integer", minimum: 1, maximum: 10 },
      },
    },
    b: { $ref: "#/properties/a" },
    fidelity_a: { type: "integer", minimum: 0, maximum: 5 },
    fidelity_b: { type: "integer", minimum: 0, maximum: 5 },
    winner: { enum: ["A", "B", "tie"] },
    reason: { type: "string", maxLength: 400 },
  },
};

type JudgeResponse = {
  a: RubricScores;
  b: RubricScores;
  fidelity_a: number;
  fidelity_b: number;
  winner: "A" | "B" | "tie";
  reason: string;
};

function isJudgeResponse(value: unknown): value is JudgeResponse {
  if (typeof value !== "object" || value === null) return false;
  if (!("a" in value) || !("b" in value) || !("winner" in value)) return false;
  if (!("fidelity_a" in value) || !("fidelity_b" in value) || !("reason" in value)) return false;
  const winner = value.winner;
  return winner === "A" || winner === "B" || winner === "tie";
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1]! : trimmed;
}

function attemptJudgeCall(finalPrompt: string, flags: string[]): { outcome: ClaudeCallOutcome; parsed: unknown } {
  const outcome = invokeClaude(repoRoot, finalPrompt, flags);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(outcome.resultText));
  } catch {
    parsed = undefined;
  }
  return { outcome, parsed };
}

function runJudgeVote(
  doc: string,
  baselineArm: string,
  repeat: number,
  voteIndex: number,
  sourceText: string,
  valeText: string,
  baselineText: string,
  preflight: PreflightRecord,
): JudgeVote {
  const blindKey = sha256Hex(`${doc}\u0000${baselineArm}\u0000${repeat}\u0000${voteIndex}`);
  const valeIsA = Number.parseInt(blindKey.slice(0, 1), 16) % 2 === 0;
  const docA = valeIsA ? valeText : baselineText;
  const docB = valeIsA ? baselineText : valeText;
  const valeLabel: "A" | "B" = valeIsA ? "A" : "B";

  const prompt = judgePromptTemplate.replace("{{SOURCE}}", sourceText).replace("{{DOC_A}}", docA).replace("{{DOC_B}}", docB);

  const useSchema = preflight.preflight.jsonSchema;
  const flags = ["--safe-mode", "--model", preflight.judgeModel, "--max-budget-usd", String(JUDGE_CALL_BUDGET_USD)];
  if (useSchema) flags.push("--json-schema", JSON.stringify(JUDGE_SCHEMA));
  const finalPrompt = useSchema ? prompt : `${prompt}\n\nReply with only the JSON object, no prose and no code fence.`;

  let { outcome, parsed } = attemptJudgeCall(finalPrompt, flags);
  let costUsd = outcome.costUsd;
  // Parsing failed twice: record the vote as invalid and exclude it, per the pre-registered judge protocol.
  if (!outcome.ok || !isJudgeResponse(parsed)) {
    const retry = attemptJudgeCall(finalPrompt, flags);
    costUsd += retry.outcome.costUsd;
    outcome = retry.outcome;
    parsed = retry.parsed;
  }

  if (!outcome.ok || !isJudgeResponse(parsed)) {
    return {
      doc,
      baselineArm,
      repeat,
      voteIndex,
      valeLabel,
      a: { directness: 0, rhythm: 0, trust: 0, authenticity: 0, density: 0 },
      b: { directness: 0, rhythm: 0, trust: 0, authenticity: 0, density: 0 },
      fidelityA: 0,
      fidelityB: 0,
      winner: "tie",
      reason: `invalid judge response after retry: ${(outcome.resultText || outcome.raw).slice(0, 300)}`,
      costUsd,
      valid: false,
    };
  }

  return {
    doc,
    baselineArm,
    repeat,
    voteIndex,
    valeLabel,
    a: parsed.a,
    b: parsed.b,
    fidelityA: parsed.fidelity_a,
    fidelityB: parsed.fidelity_b,
    winner: parsed.winner,
    reason: parsed.reason,
    costUsd,
    valid: true,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(scratchRoot, { recursive: true });
  mkdirSync(runsRoot, { recursive: true });

  const preflight = loadPreflight();

  const allDocs = readdirSync(corpusRoot)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
  const docs = args.docs ?? allDocs;
  const arms = (args.arms ?? ARMS.map((a) => a.id)).map((id) => {
    const arm = ARMS.find((a) => a.id === id);
    if (!arm) throw new Error(`unknown arm: ${id}`);
    return arm;
  });

  const runId = args.runId ?? `${utcRunTimestamp()}-${gitShortSha()}`;
  const runDir = join(runsRoot, runId);
  mkdirSync(runDir, { recursive: true });

  const packageDir = join(runDir, ".package");
  const packageZipPath = join(packageDir, "Deslop.zip");
  const existingResultsPath = join(runDir, "results.json");
  let results: Results;
  if (existsSync(existingResultsPath)) {
    results = JSON.parse(readFileSync(existingResultsPath, "utf8")) as Results;
    if (!existsSync(packageZipPath)) {
      throw new Error(`resuming run ${runId} but ${packageZipPath} is missing; cannot verify the Vale arm's package identity across the resume`);
    }
    console.log(`resuming run ${runId} (${results.runs.length} runs already recorded)`);
  } else {
    // Build the shipped artifact once per run, into a location that survives the process exiting so
    // `--run-id` resume can reuse the exact same zip the Vale arm's scratch `.vale.ini` points at.
    mkdirSync(packageDir, { recursive: true });
    const build = sh([join(repoRoot, "scripts", "build-package.sh"), packageDir]);
    if (build.exitCode !== 0) throw new Error(`build-package.sh failed: ${build.stderr}`);
    const packageZipSha256 = sha256Hex(readFileSync(packageZipPath));

    const skillsMeta = ["humanizer", "stephenturner"].map((vendorDir) => {
      const source = JSON.parse(readFileSync(join(skillsRoot, vendorDir, "SOURCE.json"), "utf8")) as { repo: string; sha: string; files: Record<string, string> };
      const armId = vendorDir === "humanizer" ? "skill-humanizer" : "skill-stephenturner";
      const skillSha256 = sha256Hex(Object.values(source.files).sort().join(""));
      return { armId, repo: source.repo, sha: source.sha, skillSha256 };
    });

    results = {
      runId,
      createdAt: new Date().toISOString(),
      git: { sha: gitShortSha(), dirty: gitDirty() },
      vale: { version: sh(["vale", "--version"]).stdout.trim(), unionRuns: 20, packageZipSha256 },
      models: { actor: preflight.resolvedActorModel, judge: preflight.judgeModel },
      skills: skillsMeta,
      config: { repeats: args.repeats, judgeVotes: args.judgeVotes, maxIterations: MAX_ITERATIONS_NOTE, budgetUsd: args.budget },
      preflight: preflight.preflight,
      docs: [],
      runs: [],
      judge: [],
      summary: { arms: [], perDocArm: [], judgePairs: [] },
    };
  }

  // docs[] measurement (idempotent; corpus is immutable during a run).
  const docItems = docs.map((slug) => ({ key: slug, text: readFileSync(join(corpusRoot, `${slug}.md`), "utf8") }));
  const measuredDocs = measure(docItems);
  results.docs = docs.map((slug) => {
    const m = measuredDocs.get(slug)!;
    return { slug, path: `corpus/${slug}.md`, ...m };
  });

  let cumulativeCostUsd = results.runs.reduce((sum, r) => sum + r.costUsd, 0) + results.judge.reduce((sum, v) => sum + v.costUsd, 0);

  function persist(): void {
    results.summary = summarize(results);
    writeFileSync(join(runDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
    writeFileSync(
      join(runDir, "manifest.json"),
      `${JSON.stringify({ runId: results.runId, createdAt: results.createdAt, git: results.git, vale: results.vale, models: results.models, skills: results.skills, config: results.config, preflight: results.preflight }, null, 2)}\n`,
    );
  }

  function alreadyRan(doc: string, armId: string, repeat: number): RunRecord | undefined {
    return results.runs.find((r) => r.doc === doc && r.arm === armId && r.repeat === repeat);
  }

  // -------------------------------------------------------------------------
  // Arm runs
  // -------------------------------------------------------------------------

  for (const doc of docs) {
    const sourceText = readFileSync(join(corpusRoot, `${doc}.md`), "utf8");
    const before = results.docs.find((d) => d.slug === doc)!;

    for (const arm of arms) {
      for (let repeat = 1; repeat <= args.repeats; repeat++) {
        if (alreadyRan(doc, arm.id, repeat)) continue;

        if (cumulativeCostUsd + ARM_CALL_BUDGET_USD > args.budget) {
          console.error(`budget guard: $${cumulativeCostUsd.toFixed(2)} spent, next call could reach $${args.budget}. Stopping.`);
          console.error(`resume with: bun run scripts/eval-run.ts --run-id ${runId}`);
          persist();
          return;
        }

        let attempt = await runOneAttempt(doc, arm, sourceText, preflight, packageZipPath, args.keepScratch);
        if (attempt.status === "failed" && attempt.invalidReason !== "skill-not-activated") {
          // Retry once for transient failures; a genuine skill-not-activated result is a real finding, not noise.
          attempt = await runOneAttempt(doc, arm, sourceText, preflight, packageZipPath, args.keepScratch);
        }
        cumulativeCostUsd += attempt.costUsd;

        let outputPath = "";
        let words = 0;
        let retention = 0;
        let alerts = 0;
        let alertsPer1k = 0;
        let reduction = 0;
        let rulesFiring = 0;
        let rulesCleared = 0;
        let regressions = 0;
        let checks: Record<string, number> = {};
        const flags: string[] = [];

        if (attempt.status === "ok" && attempt.outputText !== null) {
          const outDir = join(runDir, doc, arm.id, `r${repeat}`);
          mkdirSync(outDir, { recursive: true });
          writeFileSync(join(outDir, "output.md"), attempt.outputText);
          outputPath = `runs/${runId}/${doc}/${arm.id}/r${repeat}/output.md`;

          const after = measure([{ key: "after", text: attempt.outputText }]).get("after")!;
          const delta = deltaMetrics(before, after);
          words = after.words;
          alerts = after.alerts;
          alertsPer1k = after.alertsPer1k;
          checks = after.checks;
          reduction = delta.reduction;
          rulesFiring = delta.rulesFiring;
          rulesCleared = delta.rulesCleared;
          regressions = delta.regressions;
          retention = delta.retention;
          if (retention < RETENTION_FLOOR) flags.push("over-deletion");
        }

        const record: RunRecord = {
          doc,
          arm: arm.id,
          repeat,
          status: attempt.status,
          invalidReason: attempt.invalidReason,
          flags,
          outputPath,
          words,
          retention,
          alerts,
          alertsPer1k,
          reduction,
          rulesFiring,
          rulesCleared,
          regressions,
          checks,
          skillActivated: attempt.skillActivated,
          valeInvocations: attempt.valeInvocations,
          numTurns: attempt.numTurns,
          durationMs: attempt.durationMs,
          costUsd: attempt.costUsd,
        };
        results.runs.push(record);
        const armOutDir = attempt.status === "ok" ? join(runDir, doc, arm.id, `r${repeat}`) : null;
        if (armOutDir) writeFileSync(join(armOutDir, "meta.json"), `${JSON.stringify(record, null, 2)}\n`);
        persist();
        console.log(`${record.status === "ok" ? "OK" : "FAILED"} ${doc}/${arm.id}/r${repeat} ${record.invalidReason ?? ""} (total spend $${cumulativeCostUsd.toFixed(2)})`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Judge
  // -------------------------------------------------------------------------

  if (!args.noJudge) {
    for (const doc of docs) {
      const sourceText = readFileSync(join(corpusRoot, `${doc}.md`), "utf8");
      for (const baselineArm of BASELINE_ARM_IDS) {
        if (!arms.some((a) => a.id === baselineArm) || !arms.some((a) => a.id === "vale-deslop")) continue;
        for (let repeat = 1; repeat <= args.repeats; repeat++) {
          const valeRun = alreadyRan(doc, "vale-deslop", repeat);
          const baselineRun = alreadyRan(doc, baselineArm, repeat);
          if (!valeRun || valeRun.status !== "ok" || !baselineRun || baselineRun.status !== "ok") {
            console.log(`skipping judge ${doc}/${baselineArm}/r${repeat}: a required run is missing or failed`);
            continue;
          }
          const valeText = readFileSync(join(evalsRoot, valeRun.outputPath), "utf8");
          const baselineText = readFileSync(join(evalsRoot, baselineRun.outputPath), "utf8");

          for (let voteIndex = 1; voteIndex <= args.judgeVotes; voteIndex++) {
            const voteDir = join(runDir, "judge", doc, baselineArm, `r${repeat}`);
            const votePath = join(voteDir, `vote${voteIndex}.json`);
            if (existsSync(votePath)) continue;

            if (cumulativeCostUsd + JUDGE_CALL_BUDGET_USD > args.budget) {
              console.error(`budget guard: $${cumulativeCostUsd.toFixed(2)} spent, next judge call could reach $${args.budget}. Stopping.`);
              console.error(`resume with: bun run scripts/eval-run.ts --run-id ${runId}`);
              persist();
              return;
            }

            const vote = runJudgeVote(doc, baselineArm, repeat, voteIndex, sourceText, valeText, baselineText, preflight);
            cumulativeCostUsd += vote.costUsd;
            mkdirSync(voteDir, { recursive: true });
            writeFileSync(votePath, `${JSON.stringify(vote, null, 2)}\n`);
            results.judge.push(vote);
            persist();
            console.log(`${vote.valid ? "OK" : "INVALID"} judge ${doc}/${baselineArm}/r${repeat}/vote${voteIndex}`);
          }
        }
      }
    }
  }

  persist();
  console.log(`\nrun ${runId} complete. Total spend: $${cumulativeCostUsd.toFixed(2)}`);
  writeFileSync(join(runsRoot, "LATEST"), `${runId}\n`);
}

await main();
