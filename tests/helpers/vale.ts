import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Alert = {
  Check: string;
  Severity: "error" | "warning" | "suggestion";
  Line: number;
  Span: [number, number];
  Match: string;
  Message: string;
};
export type ValeResults = Record<string, Alert[]>;

const YML_EXTENSION = /\.yml$/;

export const fixturesRoot = fileURLToPath(new URL("../fixtures/", import.meta.url));
export const packageRoot = fileURLToPath(new URL("../../Deslop/", import.meta.url));
export const styleDir = fileURLToPath(new URL("../../Deslop/styles/Deslop/", import.meta.url));

/**
 * Runs `vale --output=JSON` once and parses the result. Never inspect `exitCode`: Vale exits 1
 * whenever any alert exists, even a suggestion, so a non-zero exit is not a failure signal here.
 */
export function valeJson(args: string[], cwd: string): ValeResults {
  const proc = Bun.spawnSync({
    cmd: ["vale", "--no-global", "--output=JSON", ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = proc.stdout.toString("utf8");
  if (!stdout.trim()) {
    throw new Error(`vale produced no output (cwd=${cwd}): ${proc.stderr.toString("utf8")}`);
  }
  return JSON.parse(stdout) as ValeResults;
}

// Vale 3.19.0 nondeterministically drops blocks of matches: repeated identical runs over the same
// fixture tree returned 255/258/262 total alerts, and undercounting is the only failure mode ever
// observed (never a phantom extra match). The union of `(file, check, line, span)` tuples across N
// runs is stable at 262 from N=3 upward; N=20 costs ~0.8s for the whole fixture tree and gives the
// widest safety margin measured this session.
export const UNION_RUNS = 20;

export function valeUnion(args: string[], cwd: string, runs: number = UNION_RUNS): ValeResults {
  const merged = new Map<string, { file: string; alert: Alert }>();
  for (let i = 0; i < runs; i++) {
    const results = valeJson(args, cwd);
    for (const [file, alerts] of Object.entries(results)) {
      for (const alert of alerts) {
        const key = `${file}\u0000${alert.Check}\u0000${alert.Line}\u0000${alert.Span[0]}\u0000${alert.Span[1]}`;
        if (!merged.has(key)) merged.set(key, { file, alert });
      }
    }
  }
  const out: ValeResults = {};
  for (const { file, alert } of merged.values()) {
    (out[file] ??= []).push(alert);
  }
  return out;
}

export function countsByCheck(alerts: Alert[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const alert of alerts) {
    counts[alert.Check] = (counts[alert.Check] ?? 0) + 1;
  }
  return counts;
}

export function ruleNames(): string[] {
  return readdirSync(styleDir)
    .filter((name) => name.endsWith(".yml"))
    .map((name) => name.replace(YML_EXTENSION, ""))
    .sort();
}
