#!/usr/bin/env bun
// Four cheap probes that resolve `claude` CLI unknowns before a full eval run spends real budget:
// auth/model resolution, skill isolation, tool-deny mechanism, and structured judge output. Each
// probe records the exact flag set that worked; `eval-run.ts` reads this record instead of
// re-deciding. See evals/README.md's "Preflight" section and the plan's Assumptions & contingencies.
//
//   bun run scripts/eval-preflight.ts [--actor-model <alias>] [--judge-model <alias>]
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findTranscript, type Preflight } from "./eval-lib.ts";

type ModelUsageEntry = { canonicalModel?: string; outputTokens?: number; inputTokens?: number; cacheReadInputTokens?: number };

type ClaudeJsonResult = {
  result?: string;
  is_error?: boolean;
  session_id?: string;
  model?: string;
  modelUsage?: Record<string, ModelUsageEntry>;
  total_cost_usd?: number;
};

type ClaudeInvocation = { json: ClaudeJsonResult; raw: string; exitCode: number };

function runClaude(args: string[], cwd?: string): ClaudeInvocation {
  const proc = Bun.spawnSync({ cmd: ["claude", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const stdout = proc.stdout.toString("utf8");
  const stderr = proc.stderr.toString("utf8");
  const raw = stdout.trim() ? stdout : stderr;
  let json: ClaudeJsonResult = {};
  try {
    json = JSON.parse(raw) as ClaudeJsonResult;
  } catch {
    // Non-JSON output (crash, missing binary, etc.): leave json empty, report raw in the detail.
  }
  return { json, raw, exitCode: proc.exitCode };
}

// `.modelUsage` can hold more than one entry: verified live (2026-08-28) that a plain `-p` call
// with `--model sonnet` returns both a "claude-haiku-4-5-…" entry (a small internal routing/title
// call, no relation to the visible answer) and a "claude-sonnet-5" entry (the model that actually
// produced `.result`). Picking the first object key is wrong — it happened to be the haiku entry.
// Match the requested alias against each key/`canonicalModel` instead; the entry with the most
// total tokens is the fallback signal when no name match is found, since the answering call is
// consistently the larger one. `.model` and the alias itself are last resorts so the manifest never
// records "unknown".
function resolveModel(json: ClaudeJsonResult, alias: string): string {
  const entries = Object.entries(json.modelUsage ?? {});
  if (entries.length === 0) return json.model ?? alias;

  const aliasMatch = entries.find(([key, usage]) => key.includes(alias) || (usage.canonicalModel ?? "").includes(alias));
  if (aliasMatch) return aliasMatch[0];

  const largest = entries.reduce((best, current) => {
    const totalTokens = (entry: ModelUsageEntry) => (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0) + (entry.cacheReadInputTokens ?? 0);
    return totalTokens(current[1]) > totalTokens(best[1]) ? current : best;
  });
  return largest[0];
}

// Verified against real session transcripts on this machine (~/.claude/projects/**/*.jsonl,
// 2026-08-28): a skill invocation is an assistant `tool_use` block with `name: "Skill"` and
// `input.skill` equal to the bare skill name for a project/user-level skill (e.g. "find-docs"), or
// "<plugin>:<skill>" for a plugin-provided one. No transcript observed lists "available skills" as
// a standalone event; a skill only appears once actually invoked.
function skillToolUseName(block: unknown): string | null {
  if (typeof block !== "object" || block === null) return null;
  if (!("type" in block) || !("name" in block)) return null;
  if (block.type !== "tool_use" || block.name !== "Skill") return null;
  if (!("input" in block) || typeof block.input !== "object" || block.input === null) return null;
  if (!("skill" in block.input)) return null;
  const skill = block.input.skill;
  return typeof skill === "string" ? skill : null;
}

export function detectSkillActivation(transcript: string, skillName: string): boolean {
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
      const skill = skillToolUseName(block);
      if (skill !== null && (skill === skillName || skill.endsWith(`:${skillName}`))) return true;
    }
  }
  return false;
}


export type ProbeResult = { name: string; pass: boolean; detail: string };

async function probeP1(actorModel: string): Promise<ProbeResult & { resolvedModel: string }> {
  const { json, raw } = runClaude(["-p", "--safe-mode", "--model", actorModel, "--output-format", "json", "Reply with the single word READY."]);
  const pass = typeof json.result === "string" && json.result.includes("READY");
  const resolvedModel = resolveModel(json, actorModel);
  return {
    name: "P1 auth and model",
    pass,
    detail: pass ? `resolved model: ${resolvedModel}` : `unexpected result: ${(json.result ?? raw).slice(0, 400)}`,
    resolvedModel,
  };
}

async function probeP2(
  actorModel: string,
  vendoredHumanizerDir: string,
): Promise<ProbeResult & { skillActivationDetected: boolean | null }> {
  const tmp = mkdtempSync(join(tmpdir(), "eval-preflight-p2-"));
  try {
    const skillDir = join(tmp, ".claude", "skills", "humanizer");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), readFileSync(join(vendoredHumanizerDir, "SKILL.md")));

    const { json, raw } = runClaude(
      ["-p", "--setting-sources", "project", "--model", actorModel, "--output-format", "json", "List every skill available to you by name, one per line. Use no tools."],
      tmp,
    );
    const text = json.result ?? "";
    const namesHumanizer = /\bhumanizer\b/i.test(text);
    const namesDeslop = /\bdeslop\b/i.test(text);
    const pass = namesHumanizer && !namesDeslop;

    let skillActivationDetected: boolean | null = null;
    if (json.session_id) {
      const transcriptPath = await findTranscript(json.session_id);
      if (transcriptPath) skillActivationDetected = detectSkillActivation(readFileSync(transcriptPath, "utf8"), "humanizer");
    }

    return {
      name: "P2 skill isolation",
      pass,
      detail: pass
        ? `humanizer present, deslop absent (skill tool_use detected: ${skillActivationDetected ?? "n/a — transcript not found"})`
        : `reply: ${(text || raw).slice(0, 400)}`,
      skillActivationDetected,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function probeP3(actorModel: string): Promise<ProbeResult & { permissionMode: string; toolDenyWorks: boolean }> {
  const primaryArgs = ["-p", "--safe-mode", "--permission-mode", "bypassPermissions", "--disallowedTools", "Bash", "--model", actorModel, "--output-format", "json", "Run the shell command: echo hi. If you cannot, reply CANNOT."];
  let { json, raw } = runClaude(primaryArgs);
  let pass = typeof json.result === "string" && json.result.includes("CANNOT");
  let permissionMode = "bypassPermissions";

  if (!pass) {
    const fallbackArgs = ["-p", "--safe-mode", "--permission-mode", "acceptEdits", "--allowedTools", "Read,Edit,Write", "--model", actorModel, "--output-format", "json", "Run the shell command: echo hi. If you cannot, reply CANNOT."];
    ({ json, raw } = runClaude(fallbackArgs));
    pass = typeof json.result === "string" && json.result.includes("CANNOT");
    permissionMode = "acceptEdits";
  }

  return {
    name: "P3 tool restriction",
    pass,
    detail: pass ? `permissionMode=${permissionMode}, --disallowedTools Bash denies shell access` : `unexpected result: ${(json.result ?? raw).slice(0, 400)}`,
    permissionMode,
    toolDenyWorks: pass,
  };
}

async function probeP4(judgeModel: string): Promise<ProbeResult & { jsonSchemaSupported: boolean }> {
  const schema = JSON.stringify({ type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false });
  const { json, raw, exitCode } = runClaude(["-p", "--safe-mode", "--model", judgeModel, "--output-format", "json", "--json-schema", schema, "Return ok=true."]);

  if (exitCode !== 0) {
    return { name: "P4 structured judge output", pass: false, detail: `--json-schema errored: ${raw.slice(0, 400)}`, jsonSchemaSupported: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json.result ?? "");
  } catch {
    parsed = undefined;
  }
  const pass = (parsed as { ok?: boolean } | undefined)?.ok === true;
  return {
    name: "P4 structured judge output",
    pass,
    detail: pass ? `result: ${json.result}` : `unexpected result: ${(json.result ?? raw).slice(0, 400)}`,
    jsonSchemaSupported: true,
  };
}

function parseArgs(argv: string[]): { actorModel: string; judgeModel: string } {
  let actorModel = "sonnet";
  let judgeModel = "opus";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--actor-model") actorModel = argv[++i] ?? actorModel;
    else if (argv[i] === "--judge-model") judgeModel = argv[++i] ?? judgeModel;
  }
  return { actorModel, judgeModel };
}

const preflightCachePath = fileURLToPath(new URL("../evals/runs/.preflight.json", import.meta.url));

async function main(): Promise<void> {
  const { actorModel, judgeModel } = parseArgs(process.argv.slice(2));
  const humanizerDir = fileURLToPath(new URL("../evals/skills/humanizer/", import.meta.url));

  const p1 = await probeP1(actorModel);
  console.log(`${p1.pass ? "PASS" : "FAIL"} ${p1.name}: ${p1.detail}`);

  if (!p1.pass) {
    console.error("\nP1 failed: the `claude` CLI is not authenticated (or the model alias is invalid).");
    console.error("Run `claude auth login` (or set an API-key auth method) and re-run this script.");
    process.exit(1);
  }

  const p2 = await probeP2(actorModel, humanizerDir);
  console.log(`${p2.pass ? "PASS" : "FAIL"} ${p2.name}: ${p2.detail}`);

  const p3 = await probeP3(actorModel);
  console.log(`${p3.pass ? "PASS" : "FAIL"} ${p3.name}: ${p3.detail}`);

  const p4 = await probeP4(judgeModel);
  console.log(`${p4.pass ? "PASS" : "FAIL"} ${p4.name}: ${p4.detail}`);

  const preflight: Preflight = {
    permissionMode: p3.permissionMode,
    toolDenyWorks: p3.toolDenyWorks,
    jsonSchema: p4.jsonSchemaSupported && p4.pass,
    skillIsolated: p2.pass,
  };

  const output = {
    timestamp: new Date().toISOString(),
    actorModel,
    resolvedActorModel: p1.resolvedModel,
    judgeModel,
    probes: [p1, p2, p3, p4].map(({ name, pass, detail }) => ({ name, pass, detail })),
    preflight,
  };
  writeFileSync(preflightCachePath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nwrote ${preflightCachePath}`);

  if (!p3.pass) {
    console.error("\nP3 failed even after the acceptEdits/--allowedTools fallback: eval-run.ts has no verified way to deny Bash to non-Vale arms.");
    process.exit(1);
  }
}

if (import.meta.main) await main();
