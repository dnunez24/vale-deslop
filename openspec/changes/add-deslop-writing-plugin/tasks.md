# Tasks

## 1. Stop committing generated OpenSpec skills

- [x] 1.1 Add the OpenSpec CLI pin and an `openspec:init` task to `mise.toml`, make `setup` depend on it, and call it from `scripts/post-checkout.sh` with the same failure tolerance as the other steps; verify `mise install && mise run openspec:init` regenerates 33 `SKILL.md` files, and set `npm.package_manager = "bun"` if the install fails without Node
- [x] 1.2 Add the generated skill paths to `.gitignore` and `git rm --cached` the 34 tracked files; verify `git status` is clean after `mise run openspec:init`, and `npx skills add . --list` no longer lists any `openspec-*` skill
- [x] 1.3 Remove the three `openspec-*` excludes from `.rumdl.toml` and keep the `.vale.ini` section; verify `mise run lint:md` and `mise run lint:prose` pass with the regenerated skills on disk
- [x] 1.4 Update the `CONTRIBUTING.md` setup section to say that `setup` regenerates the OpenSpec skills; verify `mise run lint:prose -- CONTRIBUTING.md` passes

## 2. Move the Deslop package into the skill directory

- [x] 2.1 Record the current `Deslop.zip` file list (`mise run build && unzip -Z1 dist/Deslop.zip | sort`), then `git mv Deslop plugin/skills/deslop-writing/Deslop`
- [x] 2.2 Update the package path in `scripts/build-package.sh`, `scripts/lint-prose.sh`, `.vale.ini`, `tests/helpers/vale.ts`, `tests/style.test.ts`, `tests/fixtures/.vale.ini`, `scripts/eval-lib.ts`, and `.github/workflows/evals.yml`, then run `mise run eval:report` to pick up the new styles path in `REPORT.md`; verify `mise run ci` and `mise run eval:verify` pass and the new zip file list matches 2.1 exactly
- [x] 2.3 Update the `Deslop/` paths in `CONTRIBUTING.md` (layout, rule-change steps, registry notes) and `README.md` (the UnicodeDecoration reference); verify `mise run lint:prose` passes and a search for `Deslop/styles` outside `plugin/`, `evals/runs/`, and `openspec/` finds only intended references

## 3. Build the deslop-writing skill

- [x] 3.1 Add `plugin/skills/deslop-writing/deslop.vale.ini` (design decision 3); verify that `vale --no-global --config=<abs path> --output=JSON evals/corpus/exec-memo.md`, run from a read-only copy of the skill directory, reports 63 alerts from 31 checks
- [x] 3.2 Add a generator for `references/checks.md` that reuses `scripts/rule-table.ts`, plus a mise task, and add a test that fails when the catalog is stale; verify the test fails after a rule message edit and passes after regeneration
- [x] 3.3 Write `references/install-vale.md` with one verified command per platform, plus the GitHub release fallback; verify each package id resolves (`brew info vale`, the winget and Chocolatey package pages, `snap info vale`)
- [x] 3.4 Write `SKILL.md` with frontmatter (`name: deslop-writing`, plus a description that covers editing and writing prose) and the workflow from design decisions 3, 4, and 6: edit and write modes, draft naming, the whole-document rewrite first, at most two Vale passes, triage rules, Vale detection and the install offer, the inference-only fallback, and the summary format; verify it's under 500 lines and that `npx skills-ref validate plugin/skills/deslop-writing` (or the Agent Skills reference validator) passes
- [x] 3.5 Smoke-test edit mode in Claude Code with `claude --plugin-dir ./plugin` on a copy of `evals/corpus/saas-launch-post.md`; verify the draft appears at `<stem>.deslop.md`, the original checksum is unchanged, and the summary lists kept alerts
- [x] 3.6 Smoke-test write mode, and the fallback with `vale` removed from `PATH`; verify the new-file review runs Vale, the fallback reply states that Vale didn't run, and the install offer appears before any install command runs
- [x] 3.7 Lint the skill files with the house config; verify `mise run lint:md` and `mise run lint:prose` pass on `plugin/**/*.md` with no new exclusions

## 4. Publish the plugin

- [x] 4.1 Add `plugin/plugin.json` (Agent Plugins 1.0), `plugin/.claude-plugin/plugin.json`, and the root `.claude-plugin/marketplace.json` (design decision 7); verify `claude plugin validate .` and `claude plugin validate ./plugin` pass, and `plugin/plugin.json` validates against `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`
- [x] 4.2 Add a local marketplace in Claude Code and install `deslop`; verify `deslop-writing` is listed exactly once, and switch to `skills.sh.json` (design decision 7) if it's listed twice
- [ ] 4.3 Verify discovery from the branch: `npx skills add dnunez24/vale-deslop#<branch> --list` lists only `deslop-writing`, and a `--copy` install contains `SKILL.md`, `deslop.vale.ini`, `references/`, and `Deslop/`
- [x] 4.4 Add `extra-files` for the three version fields to `release-please-config.json`, set them to the current version, and add a test that every plugin and marketplace version equals `package.json`; verify the test fails when one manifest version is changed by hand
- [x] 4.5 Add an install section to `README.md` for Claude Code (`/plugin marketplace add dnunez24/vale-deslop`), Agent Plugins clients, and `npx skills add dnunez24/vale-deslop`, and add a `CONTRIBUTING.md` note on the skill layout; verify `mise run lint:prose` and the `install documentation` test pass

## 5. Make the eval harness compare a plugin arm

- [x] 5.1 Add `config.treatmentArm` to results, migrate the run-1 `results.json` to `"vale-deslop"`, and replace the hard-coded `vale-deslop` in `summarize()`, `verdict()`, and the judge loop; verify `bun run scripts/eval-measure.ts --run 20260828-205343-dcc8eb2 --check` passes and `mise run eval:verify` is unchanged for run 1
- [x] 5.2 Snapshot `evals/prompts/` into `runs/<id>/prompts/` at run start, and render the shared task text in the report from that snapshot; add the run-1 snapshot from the current prompts, and verify `mise run eval:report` reproduces the committed `REPORT.md`
- [x] 5.3 Write the shared prompt v2 (output to `rewrite.md`, source unchanged), measure `rewrite.md`, and add the `source-modified` and `no-output` failure reasons; add `tests/evals.test.ts` cases for both reasons, and verify they fail before the change and pass after it
- [x] 5.4 Add the `plugin-deslop-writing` arm (design decision 11): copy the committed skill into the scratch `.claude/skills/`, use skill isolation and `Bash(vale *)` permissions, detect skill activation, and fail on skill-file tampering; ask the user for approval before the dry run, because it spends API credit, and run it with the key from 1Password (design decision 11); verify with a paid dry run on one doc with one repeat (`--arms plugin-deslop-writing,skill-humanizer --docs exec-memo --repeats 1`, under $3) that the skill activates, Vale runs, `rewrite.md` is measured, and the per-attempt costs keep the full-run estimate under the $70 cap
- [x] 5.5 Record the resolved judge model and the auth method in preflight, the manifest, and the report, reusing `resolveModel()` for the judge probe and reading `authMethod` from `claude auth status`; verify with a `tests/evals.test.ts` case that picks the `claude-opus-*` entry from a recorded multi-entry `modelUsage` sample
- [x] 5.6 Update `evals/README.md`: the arm table, the per-run treatment arm, the prompt snapshots, the run-2 arm set and budget, and the auth setup (an API key from the Console organization linked to the Max plan, passed per command with `op run`, never exported or stored in GitHub); verify each documented command runs as written with `--help` or a dry run

## 6. Run the pre-registered plugin eval

- [ ] 6.1 Commit groups 1 to 5, then run `ANTHROPIC_API_KEY=op://automation/vale-deslop-anthropic-api-key/credential op run -- bun run scripts/eval-preflight.ts` from a clean tree; verify that preflight passes, records auth method `api_key` and a `claude-opus-*` judge model, and that `git status` is clean.
      Run 1 was recorded with a dirty working tree; the clean commit is what proves the criteria, prompts, skill, and config were fixed before the run
- [ ] 6.2 Ask the user for approval before running, because this spends API credit; then run `ANTHROPIC_API_KEY=op://automation/vale-deslop-anthropic-api-key/credential op run -- mise run eval` with arms `control,skill-humanizer,skill-stephenturner,plugin-deslop-writing`, treatment `plugin-deslop-writing`, 3 repeats, and a $70 budget; verify that the manifest records the clean commit from 6.1, with no failed attempts other than the documented failure reasons
- [ ] 6.3 Run `mise run eval:report` and `mise run eval:verify`, and update the evidence section of `README.md` to describe the advisory run and link the report, whatever the verdict; verify `mise run ci` passes

## 7. Integration checks

- [ ] 7.1 On a fresh clone of the branch, run `mise install && mise run setup && mise run ci`; verify it passes, `git status` is clean, and the OpenSpec skills exist
- [x] 7.2 Run `openspec validate add-deslop-writing-plugin --strict`; verify it passes

## Workflow follow-up

- Archive the change after review and merge, then confirm the first release publishes `Deslop.zip` and bumps all three manifest versions.
