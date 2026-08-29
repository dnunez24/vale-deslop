#!/usr/bin/env bun
// Vendors the pinned competitor "deslop" skills into evals/skills/. Vendoring (not run-time fetch)
// keeps the eval offline-reproducible and records exactly what was tested. Re-running this script
// re-downloads each pinned SHA's tarball (which is content-addressed and therefore stable) and
// verifies every already-vendored file still matches its recorded sha256, failing loudly if a
// vendored file was hand-edited since the last vendor run.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "./eval-lib.ts";

type SourceSpec = {
  vendorDir: string;
  repo: string;
  sha: string;
  skillName: string;
  files: string[];
};

const SOURCES: SourceSpec[] = [
  {
    vendorDir: "humanizer",
    repo: "blader/humanizer",
    sha: "e2e92e7b4b8229253ed5c8e81dc65463fdeddda5",
    skillName: "humanizer",
    files: ["SKILL.md", "LICENSE"],
  },
  {
    vendorDir: "stephenturner",
    repo: "stephenturner/skill-deslop",
    sha: "a906154bef375d9d49ed2ad7da13b2db16f0d3d2",
    skillName: "deslop",
    files: [
      "SKILL.md",
      "LICENSE",
      "references/examples.md",
      "references/phrases.md",
      "references/structures.md",
      "references/tropes.md",
    ],
  },
];

const skillsRoot = fileURLToPath(new URL("../evals/skills/", import.meta.url));


function verifyExistingFiles(targetDir: string, source: SourceSpec): void {
  const sourceJsonPath = join(targetDir, "SOURCE.json");
  if (!existsSync(sourceJsonPath)) return;
  const recorded = JSON.parse(readFileSync(sourceJsonPath, "utf8")) as {
    files: Record<string, string>;
  };
  const drifted: string[] = [];
  for (const [relPath, expectedSha] of Object.entries(recorded.files)) {
    const filePath = join(targetDir, relPath);
    if (!existsSync(filePath)) {
      drifted.push(`${relPath}: missing (recorded ${expectedSha})`);
      continue;
    }
    const actualSha = sha256Hex(readFileSync(filePath));
    if (actualSha !== expectedSha) {
      drifted.push(`${relPath}: recorded ${expectedSha}, found ${actualSha}`);
    }
  }
  if (drifted.length > 0) {
    throw new Error(
      `${source.vendorDir}: vendored files drifted from their recorded sha256 (hand-edited?):\n` +
        drifted.map((d) => `  - ${d}`).join("\n"),
    );
  }
  console.log(`${source.vendorDir}: ${Object.keys(recorded.files).length} files match recorded sha256`);
}

function vendorOne(source: SourceSpec): void {
  const targetDir = join(skillsRoot, source.vendorDir);
  verifyExistingFiles(targetDir, source);

  const url = `https://codeload.github.com/${source.repo}/tar.gz/${source.sha}`;
  const staging = mkdtempSync(join(tmpdir(), "eval-vendor-"));
  try {
    const fetchAndExtract = Bun.spawnSync({
      cmd: ["bash", "-c", `curl -fsSL '${url}' | tar xz -C '${staging}' --strip-components=1`],
      stdout: "pipe",
      stderr: "pipe",
    });
    if (fetchAndExtract.exitCode !== 0) {
      throw new Error(
        `${source.vendorDir}: failed to fetch/extract ${url}: ${fetchAndExtract.stderr.toString("utf8")}`,
      );
    }

    const files: Record<string, string> = {};
    for (const relPath of source.files) {
      const stagedPath = join(staging, relPath);
      if (!existsSync(stagedPath)) {
        throw new Error(`${source.vendorDir}: expected file missing from tarball: ${relPath}`);
      }
      const data = readFileSync(stagedPath);
      const destPath = join(targetDir, relPath);
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, data);
      files[relPath] = sha256Hex(data);
    }

    const sourceJson = {
      repo: source.repo,
      sha: source.sha,
      url,
      fetchedAt: new Date().toISOString(),
      files,
    };
    writeFileSync(join(targetDir, "SOURCE.json"), `${JSON.stringify(sourceJson, null, 2)}\n`);
    console.log(`${source.vendorDir}: vendored ${Object.keys(files).length} files from ${source.repo}@${source.sha}`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

for (const source of SOURCES) {
  vendorOne(source);
}
