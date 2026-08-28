import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "bun:test";
import { deriveRuleTable, RULES_END, RULES_START } from "../scripts/rule-table.ts";
import { ruleNames, styleDir } from "./helpers/vale.ts";

const VALID_LEVELS = new Set(["error", "warning", "suggestion"]);

const scriptsDir = fileURLToPath(new URL("../Deslop/styles/config/scripts/", import.meta.url));
const packageIniPath = fileURLToPath(new URL("../Deslop/.vale.ini", import.meta.url));
const metaPath = fileURLToPath(new URL("../Deslop/styles/Deslop/meta.json", import.meta.url));
const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));

type Rule = {
  name: string;
  extends?: string;
  message?: string;
  level?: string;
  script?: string;
};

function loadRules(): Rule[] {
  return ruleNames().map((name) => {
    const text = readFileSync(`${styleDir}${name}.yml`, "utf8");
    const parsed = Bun.YAML.parse(text) as Record<string, unknown>;
    return { name, ...parsed } as Rule;
  });
}

describe("style structure", () => {
  const rules = loadRules();

  it("every rule declares extends, message, and a valid level", () => {
    for (const rule of rules) {
      expect(rule.extends, `${rule.name}: extends`).toBeTruthy();
      expect(rule.message, `${rule.name}: message`).toBeTruthy();
      expect(VALID_LEVELS.has(rule.level ?? ""), `${rule.name}: level "${rule.level}"`).toBe(true);
    }
  });

  it("every extends:script rule names a script file that exists", () => {
    const scriptFiles = new Set(readdirSync(scriptsDir));
    for (const rule of rules) {
      if (rule.extends !== "script") continue;
      expect(rule.script, `${rule.name}: script`).toBeTruthy();
      expect(scriptFiles.has(rule.script ?? ""), `${rule.name}: script "${rule.script}" missing`).toBe(
        true,
      );
    }
  });

  it("no .tengo file is orphaned", () => {
    const referenced = new Set(
      rules.filter((r) => r.extends === "script" && r.script).map((r) => r.script as string),
    );
    const scriptFiles = readdirSync(scriptsDir);
    const orphans = scriptFiles.filter((f) => !referenced.has(f));
    expect(orphans).toEqual([]);
  });

  it("meta.json parses and pins vale_version", () => {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    expect(meta.vale_version).toBe(">=3.2.0");
  });

  it("Deslop/.vale.ini declares StylesPath = styles", () => {
    const ini = readFileSync(packageIniPath, "utf8");
    expect(ini).toContain("StylesPath = styles");
  });

  it("README rule table is in sync with the rule files", () => {
    const readme = readFileSync(readmePath, "utf8");
    const startIdx = readme.indexOf(RULES_START);
    const endIdx = readme.indexOf(RULES_END);
    expect(startIdx, "rules:start marker missing").toBeGreaterThanOrEqual(0);
    expect(endIdx, "rules:end marker missing").toBeGreaterThan(startIdx);
    const current = readme.slice(startIdx + RULES_START.length, endIdx).trim();
    const derived = deriveRuleTable(rules).trim();
    expect(current).toBe(derived);
  });
});
