#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveRuleTable, RULES_END, RULES_START } from "./rule-table.ts";
import { ruleNames, styleDir } from "../tests/helpers/vale.ts";

type Rule = { name: string; extends?: string; message?: string; level?: string };

function loadRules(): Rule[] {
  return ruleNames().map((name) => {
    const text = readFileSync(`${styleDir}${name}.yml`, "utf8");
    const parsed = Bun.YAML.parse(text) as Record<string, unknown>;
    return { name, ...parsed } as Rule;
  });
}

const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
const readme = readFileSync(readmePath, "utf8");

const startIdx = readme.indexOf(RULES_START);
const endIdx = readme.indexOf(RULES_END);
if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
  throw new Error(`README.md is missing ${RULES_START} / ${RULES_END} markers`);
}

const table = deriveRuleTable(loadRules());
const updated =
  readme.slice(0, startIdx + RULES_START.length) +
  "\n\n" +
  table +
  "\n\n" +
  readme.slice(endIdx);

writeFileSync(readmePath, updated);
console.log(`updated ${readmePath}`);
