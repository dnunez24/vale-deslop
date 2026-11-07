# Proposal

## Why

People who write with AI help get prose that readers recognize as machine-written: stock phrasing, inflated stakes, metronomic rhythm ([issue #7](https://github.com/dnunez24/vale-deslop/issues/7)).
This repo ships a Vale style that detects those tells, but using it from an agent today means wiring Vale up by hand, and the one agent workflow we measured fails the readers it's for.
In run `20260828-205343-dcc8eb2`, a "fix every alert until Vale is clean" loop cut alerts to 0.68 per 1,000 words, lost every blind-judged pair against two popular deslop skills (win rate 0%), and had the worst fidelity score (3.29 of 5).
The judges' reasons name the loop itself: it trims instead of rebuilding sentences, deletes hashtags and links to silence rules, and invents claims to replace flagged rhetorical questions.

## What Changes

- Add a user-installable agent plugin under `plugin/`, with one skill named `deslop-writing`.
  The skill edits prose for a human reader first.
  It treats Deslop alerts as advice the model may accept or dismiss, not as a gate the draft must pass.
- Support two modes: editing an existing document, which writes a new draft beside the original and never changes the original, and checking new prose while the agent writes it.
- Bundle the Deslop rules inside the skill, so a run needs no network access and the rule version always equals the plugin version.
  Run Vale only with the bundled config and with global and project Vale config ignored.
- When Vale is missing, offer to install it.
  If the user declines or the install fails, fall back to an inference-only review that uses a bundled catalog of the same checks.
- Publish one marketplace manifest that works for Claude Code plugin installs and for skill installers that read plugin manifests (`npx skills add dnunez24/vale-deslop`).
  Add an Agent Plugins 1.0 `plugin.json` for clients that read that format.
- Move the Deslop Vale package source from `Deslop/` into the skill directory.
  The `Deslop.zip` release asset keeps its name and contents, so existing Vale users see no change.
- Stop committing the OpenSpec-generated skills (`.agents/`, `.claude/`, `.omp/` `skills/openspec-*`).
  `mise run setup` regenerates them, and the repo then offers exactly one installable skill.
- Add a pre-registered eval arm for the plugin (Claude only), and make the treatment arm a parameter of the harness instead of a hard-coded `vale-deslop`.
  Run it once and publish the report, whatever the verdict.

## Capabilities

### New Capabilities

- `deslop-writing-skill`: how the `deslop-writing` skill revises prose: edit and write modes, draft output, advisory Vale triage, fidelity limits, Vale detection and install offer, and the inference-only fallback.
- `plugin-distribution`: how users get the skill: plugin and marketplace manifests, skill-installer discovery, bundled rules, version alignment with releases, and the one-skill guarantee for the published repo.
- `deslop-eval`: how the eval harness compares a treatment arm against the baseline skills: treatment-arm selection, the plugin arm, output-file handling, and pre-registered criteria.

### Modified Capabilities

None. `openspec/specs/` has no capabilities yet.

## Impact

- **New files**: `plugin/` (manifests, skill, references, bundled Vale config), root `.claude-plugin/marketplace.json`.
- **Moved**: `Deslop/` to `plugin/skills/deslop-writing/Deslop/`.
  This affects `scripts/build-package.sh`, `scripts/lint-prose.sh`, `scripts/eval-lib.ts`, `tests/helpers/vale.ts`, `tests/style.test.ts`, `tests/fixtures/.vale.ini`, `.vale.ini`, `.github/workflows/evals.yml`, `CONTRIBUTING.md`, and `README.md`.
- **Release**: `release-please-config.json` gains `extra-files` so each release bumps the plugin manifest versions.
- **Contributor setup**: `mise.toml` pins the OpenSpec CLI and adds a regenerate task.
  `.gitignore`, `.rumdl.toml`, and the git index drop the generated skills.
- **Eval**: `scripts/eval-lib.ts`, `scripts/eval-run.ts`, `scripts/eval-report.ts`, `evals/prompts/`, `evals/README.md`, one new committed run (about $60 to $70 in API credit), and a regenerated `evals/REPORT.md`.
- **Users**: Vale users of `Deslop.zip` see no change.
  Contributors edit rules at the new path and need the pinned OpenSpec CLI for the planning skills.
