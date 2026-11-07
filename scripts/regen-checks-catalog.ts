#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { checksCatalogPath, deriveChecksCatalog, loadRules } from "./rule-table.ts";

mkdirSync(dirname(checksCatalogPath), { recursive: true });
writeFileSync(checksCatalogPath, deriveChecksCatalog(loadRules()));
console.log(`updated ${checksCatalogPath}`);
