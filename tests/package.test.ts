import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "bun:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const buildScript = join(root, "scripts", "build-package.sh");

const buildDir = mkdtempSync(join(tmpdir(), "deslop-build-"));
const consumeDir = mkdtempSync(join(tmpdir(), "deslop-consume-"));

afterAll(() => {
  rmSync(buildDir, { recursive: true, force: true });
  rmSync(consumeDir, { recursive: true, force: true });
});

describe("distributable package", () => {
  it("builds Deslop.zip", () => {
    const proc = Bun.spawnSync({
      cmd: [buildScript, buildDir],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode, proc.stderr.toString("utf8")).toBe(0);
    expect(Bun.file(join(buildDir, "Deslop.zip")).size).toBeGreaterThan(0);
  });

  it("contains the expected archive shape", () => {
    const list = Bun.spawnSync({
      cmd: ["unzip", "-Z1", join(buildDir, "Deslop.zip")],
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(list.exitCode).toBe(0);
    const entries = list.stdout.toString("utf8").trim().split("\n");

    for (const entry of entries) {
      expect(entry.startsWith("Deslop/"), entry).toBe(true);
    }
    expect(entries.some((e) => e.endsWith(".DS_Store"))).toBe(false);

    expect(entries).toContain("Deslop/.vale.ini");
    expect(entries).toContain("Deslop/LICENSE");
    expect(entries).toContain("Deslop/styles/Deslop/meta.json");

    const ymlCount = entries.filter(
      (e) => e.startsWith("Deslop/styles/Deslop/") && e.endsWith(".yml"),
    ).length;
    expect(ymlCount).toBe(48);

    const tengoCount = entries.filter(
      (e) => e.startsWith("Deslop/styles/config/scripts/") && e.endsWith(".tengo"),
    ).length;
    expect(tengoCount).toBe(4);
  });

  it("syncs and lints as a consumer would", () => {
    const zipPath = join(buildDir, "Deslop.zip");
    const cfgPath = join(consumeDir, ".vale.ini");
    writeFileSync(
      cfgPath,
      `StylesPath = styles\nMinAlertLevel = suggestion\nPackages = ${zipPath}\n\n[*.md]\nBasedOnStyles = Deslop\n`,
    );

    const sync = Bun.spawnSync({
      cmd: ["vale", "--no-global", `--config=${cfgPath}`, "sync"],
      cwd: consumeDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(sync.exitCode, sync.stderr.toString("utf8")).toBe(0);

    const scriptPath = join(consumeDir, "styles", "config", "scripts", "AnaphoraRun.tengo");
    expect(Bun.file(scriptPath).size).toBeGreaterThan(0);

    const sample = "You should note this. You should note that. You should note the other.\n";
    writeFileSync(join(consumeDir, "sample.md"), sample);

    const lint = Bun.spawnSync({
      cmd: ["vale", "--no-global", `--config=${cfgPath}`, "--output=JSON", "sample.md"],
      cwd: consumeDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const results = JSON.parse(lint.stdout.toString("utf8")) as Record<
      string,
      Array<{ Check: string }>
    >;
    const checks = (results["sample.md"] ?? []).map((a) => a.Check);
    expect(checks).toContain("Deslop.AnaphoraRun");
  });
});
