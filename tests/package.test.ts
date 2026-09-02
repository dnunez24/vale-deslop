import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "bun:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const buildScript = join(root, "scripts", "build-package.sh");

const buildDir = mkdtempSync(join(tmpdir(), "deslop-build-"));
const consumeDir = mkdtempSync(join(tmpdir(), "deslop-consume-"));
const remoteDir = mkdtempSync(join(tmpdir(), "deslop-remote-"));
const mismatchDir = mkdtempSync(join(tmpdir(), "deslop-mismatch-"));

afterAll(() => {
  rmSync(buildDir, { recursive: true, force: true });
  rmSync(consumeDir, { recursive: true, force: true });
  rmSync(remoteDir, { recursive: true, force: true });
  rmSync(mismatchDir, { recursive: true, force: true });
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

describe("remote package install", () => {
  async function run(cmd: string[], cwd: string) {
    const proc = Bun.spawn({ cmd, cwd, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  }

  it("installs from an HTTP URL", async () => {
    const bytes = await Bun.file(join(buildDir, "Deslop.zip")).arrayBuffer();
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const pathname = new URL(req.url).pathname;
        if (pathname === "/Deslop.zip") {
          return new Response(bytes, { headers: { "content-type": "application/zip" } });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      const cfgPath = join(remoteDir, ".vale.ini");
      writeFileSync(
        cfgPath,
        `StylesPath = styles\nMinAlertLevel = suggestion\nPackages = http://127.0.0.1:${server.port}/Deslop.zip\n\n[*.md]\nBasedOnStyles = Deslop\n`,
      );

      const sync = await run(["vale", "--no-global", `--config=${cfgPath}`, "sync"], remoteDir);
      expect(sync.exitCode, sync.stderr).toBe(0);

      const scriptPath = join(remoteDir, "styles", "config", "scripts", "AnaphoraRun.tengo");
      expect(Bun.file(scriptPath).size).toBeGreaterThan(0);

      const sample = "You should note this. You should note that. You should note the other.\n";
      writeFileSync(join(remoteDir, "sample.md"), sample);

      const lint = await run(
        ["vale", "--no-global", `--config=${cfgPath}`, "--output=JSON", "sample.md"],
        remoteDir,
      );
      const results = JSON.parse(lint.stdout) as Record<string, Array<{ Check: string }>>;
      const checks = (results["sample.md"] ?? []).map((a) => a.Check);
      expect(checks).toContain("Deslop.AnaphoraRun");
    } finally {
      server.stop(true);
    }
  });

  it("fails when the URL file name doesn't match the archive root", async () => {
    const bytes = await Bun.file(join(buildDir, "Deslop.zip")).arrayBuffer();
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const pathname = new URL(req.url).pathname;
        if (pathname === "/vale-deslop-v1.0.0.zip") {
          return new Response(bytes, { headers: { "content-type": "application/zip" } });
        }
        return new Response("Not Found", { status: 404 });
      },
    });

    try {
      const cfgPath = join(mismatchDir, ".vale.ini");
      writeFileSync(
        cfgPath,
        `StylesPath = styles\nMinAlertLevel = suggestion\nPackages = http://127.0.0.1:${server.port}/vale-deslop-v1.0.0.zip\n\n[*.md]\nBasedOnStyles = Deslop\n`,
      );

      const sync = await run(["vale", "--no-global", `--config=${cfgPath}`, "sync"], mismatchDir);
      expect(sync.exitCode).not.toBe(0);
      expect(sync.stderr).toContain("no such file or directory");
    } finally {
      server.stop(true);
    }
  });
});

describe("install documentation", () => {
  const assetName = "Deslop.zip";
  const canonicalUrl = `https://github.com/dnunez24/vale-deslop/releases/latest/download/${assetName}`;

  it("uploads the asset the docs point at", () => {
    const workflowPath = join(root, ".github", "workflows", "release.yml");
    const workflowText = readFileSync(workflowPath, "utf8");
    expect(workflowText).toContain(`dist/${assetName}`);
  });

  it("points every documented install URL at the release asset", () => {
    const files = ["README.md", "CONTRIBUTING.md"];
    let foundCount = 0;

    for (const file of files) {
      const filePath = join(root, file);
      const fileText = readFileSync(filePath, "utf8");
      const urlRegex = /(?:^\s*Packages\s*=\s*|^\s*"url":\s*")([^"\s,]+)/gm;
      let match;

      while ((match = urlRegex.exec(fileText)) !== null) {
        const url = match[1];
        if (url.includes("github.com/dnunez24/vale-deslop")) {
          expect(url, `${file}: ${url}`).toBe(canonicalUrl);
          foundCount++;
        }
      }
    }

    expect(foundCount, "expected at least 2 documented install URLs").toBeGreaterThanOrEqual(2);
  });
});
