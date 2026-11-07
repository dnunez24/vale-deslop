import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));

describe("plugin manifests", () => {
  const releaseVersion: string = readJson("package.json").version;

  // release-please bumps these through `extra-files`; a manifest it doesn't know about drifts
  // silently and ships a plugin that reports the wrong version.
  it("every plugin and marketplace version equals the package version", () => {
    expect(readJson("plugin/plugin.json").version).toBe(releaseVersion);
    expect(readJson("plugin/.claude-plugin/plugin.json").version).toBe(releaseVersion);
    expect(readJson(".claude-plugin/marketplace.json").plugins[0].version).toBe(releaseVersion);
  });
});
