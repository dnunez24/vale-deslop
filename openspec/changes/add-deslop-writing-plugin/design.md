# Design

## Context

See `proposal.md` for why.
These verified facts shape the approach:

- `npx skills add` copies only the skill directory into the user's project.
  A test install of `plugin/skills/deslop-writing/` left out a sibling `plugin/Deslop/` directory.
  So everything the skill uses at run time must live inside the skill directory.
- `npx skills add <repo> --list` uses `.claude-plugin/marketplace.json` when that file declares `skills`.
  It also lists every skill in the standard folders, including `.agents/skills` and `.claude/skills`.
  The worktree listed 11 OpenSpec skills, and `main` lists the two vendored eval skills from `evals/skills/` through a fallback recursive search.
- Vale runs with `--no-global --config=<abs path>` from a read-only copy of the skill directory.
  On `evals/corpus/exec-memo.md` that copy reported 63 alerts from 31 checks, including all four Tengo-script checks, which matches the committed report.
  Text on stdin also works with `--ext=.md`.
- `claude plugin validate` (Claude Code 2.1.318) passes a draft of the marketplace layout and the plugin layout below.
- The Agent Plugins spec makes only skills and `mcp.json` portable, and forbids symlinks that escape the plugin root.
  The Agent Skills spec fixes the frontmatter fields to `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`.
- `openspec init --tools claude,agents,oh-my-pi --no-animation .` on a clean clone writes the 33 skill files and leaves `openspec/config.yaml` unchanged.
  A second run exits 0.
  `openspec update` does nothing on a clean clone, because it only refreshes files that already exist.
- The eval harness hard-codes `vale-deslop` as the treatment in `ARMS` handling, `summarize()`, `verdict()`, and the judge loop in `eval-run.ts`.

## Goals / Non-Goals

**Goals:**

- One skill that works the same through Claude Code plugins, Agent Plugins clients, and standalone skill installers.
- One copy of the Deslop rules in the repository.
- A measured answer, under the existing pre-registered criteria, to whether advisory Vale use beats the baseline skills.

**Non-Goals:**

- Hooks and LSP integration.
  See decision 9.
- Changing any Deslop rule, its level, or its message, in the package or in the plugin config.
- An eval writer or judge from a provider other than Anthropic.
- Cheaper judging (direct API calls or decision models such as `typesafe/jev-1.14`) and moving the eval to another harness such as Pi or OpenCode.
  Both belong to a separate eval-framework change, whose main goal is support for other model providers.
- Gating the merge or the release on the eval verdict.

## Decisions

### 1. Layout

```text
.claude-plugin/marketplace.json        marketplace "vale-deslop" -> plugin "deslop" at ./plugin
plugin/
+-- plugin.json                        Agent Plugins 1.0 manifest
+-- .claude-plugin/plugin.json         Claude Code manifest
+-- skills/deslop-writing/
    +-- SKILL.md                       workflow (under 500 lines)
    +-- deslop.vale.ini                runtime config: StylesPath = Deslop/styles
    +-- references/
    |   +-- checks.md                  generated catalog of every Deslop check
    |   +-- install-vale.md            install commands per OS
    +-- Deslop/                        canonical Vale package source (moved from ./Deslop)
        +-- .vale.ini                  package marker, unchanged
        +-- styles/Deslop/*.yml        48 rules
        +-- styles/config/scripts/     4 Tengo scripts
```

The plugin name is `deslop` and the skill name is `deslop-writing`, so Claude Code shows `deslop:deslop-writing`.
The skill directory name matches the skill name, as the Agent Skills spec requires.

### 2. The rules move into the skill directory

The canonical package moves to `plugin/skills/deslop-writing/Deslop/`.
`build-package.sh` zips that directory as `Deslop/`, so `Deslop.zip` keeps its name and contents.

Alternatives considered:

- Keep `Deslop/` at the root and commit a generated copy inside the skill, with a test that fails on drift.
  This keeps a short path for contributors, but every rule edit becomes two committed copies and one more regenerate step.
- Symlink the skill's copy to `Deslop/`.
  Agent Plugins forbids symlinks that escape the package, and installers that copy files may not follow them.

The cost is a longer path for contributors.
`CONTRIBUTING.md` documents it.

### 3. Runtime config and invocation

`deslop.vale.ini` sets `StylesPath = Deslop/styles`, `MinAlertLevel = suggestion`, and `BasedOnStyles = Deslop` for Markdown and plain text.
It turns off no rule.
The skill always runs:

```text
vale --no-global --config="<skill-dir>/deslop.vale.ini" --output=JSON <file>
vale --no-global --config="<skill-dir>/deslop.vale.ini" --ext=.md --output=JSON   (chat prose on stdin)
```

`--config` wins over `VALE_CONFIG_PATH` and project config discovery, and `--no-global` drops the user config.
The skill tells the agent to resolve `<skill-dir>` from where the harness loaded `SKILL.md`, and to quote it for paths with spaces and for Windows.

No rule changes in v1: run 1 compared whole arms, so it can't show that any single rule hurts.
Changing rules from that run would also break the repo's rule against tuning after seeing results.
The kept-alert lines in each summary give per-rule evidence for a later change.

### 4. Advisory workflow

```text
  read source --> rewrite whole doc for the reader --> Vale pass 1 --> triage each alert
                                                                      |-- revise
                                                                      |-- keep + reason
                                                       (if revised) --> Vale pass 2 --> final triage
                                                                      v
                                       write draft (edit mode) / reply (chat) + summary
```

The triage guidance comes from the run-1 judge reasons.
It states that the skill never deletes a link, hashtag, quotation, or name to clear an alert.
It states that a rewritten rhetorical question must not become a claim the source doesn't make.
It states that the skill rebuilds a sentence rather than trimming the flagged words.
Two passes is a cost bound, not a quality target.

### 5. Generated check catalog

`references/checks.md` lists each check with its level, message, and what a good fix looks like.
It serves two purposes: triage reference when Vale runs, and the review checklist in inference-only mode.
A script generates it from the rule YAML, reusing `scripts/rule-table.ts`, and a test fails when it's stale.
This follows the existing `readme:update` pattern.

### 6. Vale install offer

The skill runs `vale --version` and compares the result with 3.21.0, the minimum in the package's `meta.json`.
`references/install-vale.md` lists one command per platform:

- macOS and Linux: Homebrew.
- Windows: winget or Chocolatey.
- Linux: Snap.
- Any platform: the GitHub release binary as a fallback.

The skill runs the chosen command only after the user approves.
On refusal or failure it switches to inference-only mode and says so once.

### 7. Manifests and discovery

- Root `.claude-plugin/marketplace.json` has the name `vale-deslop`, an owner, a description, and one entry: `{name: "deslop", source: "./plugin", skills: ["./skills/deslop-writing"]}`.
  The `skills` key is what `npx skills` reads.
- `plugin/.claude-plugin/plugin.json` and `plugin/plugin.json` carry the same name, version, description, author, homepage, repository, and license.

Alternative: a `skills.sh.json` with `paths: ["./plugin/skills"]`.
That works only for the `skills` CLI.
It stays the fallback if the entry's `skills` key makes Claude Code list the skill twice.
`plugin/skills/` is already scanned by default, and the entry adds the same path.

### 8. Versions

`release-please-config.json` adds `extra-files` with JSON paths for `$.version` in both plugin manifests and `$.plugins[0].version` in the marketplace.
A test asserts that every one of them equals the `package.json` version, which catches a manifest that release-please doesn't update.

### 9. No hooks or LSP in this change

The write mode works in every harness because the skill runs Vale on its own new prose.
Hooks and LSP would add only Claude-specific automation, with these costs:

- **Skill frontmatter hooks**: these fire after the skill activates, so their scope is right.
  But `hooks` isn't an Agent Skills frontmatter field, and strict validators may reject the skill for other harnesses.
- **Hook scripts**: a hook needs a script that parses JSON on stdin and runs on Windows without Git Bash.
  Claude Code then runs hooks in PowerShell, so the hook would need two scripts or a bundled runtime.
- **Plugin-level hooks and `lspServers`**: these have no off switch for users.
  They would fire on every Markdown edit in coding sessions.
- **`vale-ls`**: `configPath` must be an absolute path.
  Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` in LSP `command`, `args`, `env`, and `workspaceFolder` only, not in `initializationOptions`.
  The workaround through `VALE_CONFIG_PATH` in `env` is unverified.

The issue lists LSP as a SHOULD.
This change defers it, and a follow-up can take it once an opt-in mechanism exists.

### 10. Generated OpenSpec skills

- `.gitignore` adds `.agents/skills/openspec-*/`, `.agents/skills/.openspec-target`, `.claude/skills/openspec-*/`, and `.omp/skills/openspec-*/`.
  `git rm --cached` removes the 34 tracked files.
- `mise.toml` pins `"npm:@fission-ai/openspec" = "1.16.0"`.
  It adds `openspec:init`, which runs `openspec init --tools claude,agents,oh-my-pi --no-animation .`, and `setup` depends on it.
  `scripts/post-checkout.sh` also runs it and tolerates failure, like its other steps.
- `.rumdl.toml` drops its three `openspec-*` excludes, because `respect-gitignore = true` already skips them.
  `.vale.ini` keeps its section, because `vale .` doesn't read `.gitignore` and the files stay on disk.

The OpenSpec skills that already exist in a contributor's checkout are overwritten in place.
Git treats ignored files as expendable on checkout, so switching to an older branch that still tracks them works.

### 11. Eval changes

- `results.config.treatmentArm` records the treatment.
  The committed run-1 `results.json` gets `"treatmentArm": "vale-deslop"` once, as a data migration, so the code has no implicit default.
- A new arm `{id: "plugin-deslop-writing", kind: "plugin", skillName: "deslop-writing"}`.
  It uses skill isolation (`--setting-sources project`) and the Vale arm's tool permissions (`Read,Edit,Write,Bash(vale *)`).
  It reuses `skill.md` as its arm prompt, so it gets the same "Use the {{SKILL_NAME}} skill" text as the baselines.
- `shared.md` v2 tells every arm to write the result to `rewrite.md` and leave `deslop.md` unchanged, which matches the plugin's own "never edit the original" rule.
  The harness measures `rewrite.md`.
  An attempt that changes `deslop.md` fails as `source-modified`, and an attempt with no `rewrite.md` fails as `no-output`.
- Each run copies `evals/prompts/` into `runs/<id>/prompts/`, and the report quotes the shared task from there.
  This replaces the hard-coded summary line in `eval-report.ts`.
- The plugin run uses the arms `control`, `skill-humanizer`, `skill-stephenturner`, and `plugin-deslop-writing`, with the same repeats (3), judge votes (3), and model aliases as run 1.
  `vale-deslop` is left out: its result stands in run 1, and leaving it out saves about $22.
  Estimated cost at list price: about $48 to $60 at Sonnet 5.5 and Opus 5.5 prices (run 1 cost $70.96 on Sonnet 5 and Opus 5), so $70 stays the budget cap.
- Paid runs and preflight authenticate with an API key from the Claude Console organization linked to the Max plan.
  That usage draws on the plan's $100 monthly API credit, not its usage limits, so a run can't use up the limits needed for normal work, and the budget guard's `costUsd` matches what the credit is charged.
  The key comes from 1Password for one command only: `ANTHROPIC_API_KEY=op://automation/vale-deslop-anthropic-api-key/credential op run -- <command>`.
  Never export it in a shell profile, set it in mise `[env]`, or store it in GitHub, because a set `ANTHROPIC_API_KEY` replaces the subscription login for interactive Claude Code too.
  CI needs no key: the `evals` workflow only runs `eval:verify`.
- Preflight records the resolved judge model, as it already does for the writer model, and the auth method from `claude auth status` (`api_key` under `op run`).
  Run 1 recorded only the alias `opus`, so its report can't say which Opus version judged.

## Risks / Trade-offs

- [Advisory mode still loses the judged comparison] -> The report publishes the verdict either way.
  A loss stops further rule work, and the next step is changing the skill prompt, not adding more rules.
- [Claude Code lists the skill twice because of the marketplace `skills` key] -> Check it with a local marketplace install.
  If it happens, switch to `skills.sh.json` (decision 7).
- [Models in other harnesses resolve `<skill-dir>` incorrectly] -> SKILL.md gives one explicit instruction and a test command (`vale --no-global --config=... --version`).
  A failure there sends the skill to the install or fallback path, not to a broken run.
- [The shared prompt v2 changes what the baselines do, so run 2 isn't comparable with run 1] -> Run 2 re-runs every arm it compares, and stores its own prompts (decision 11).
  The report never mixes runs.
- [The mise npm installer needs Node] -> Set `npm.package_manager = "bun"` in `mise.toml` if `mise install` fails on a machine without Node.
- [The deeper rule path makes contributing harder] -> `CONTRIBUTING.md` and the rule-change steps state the new path.
  The tests fail fast on a wrong path.
- [Winget or Chocolatey package ids are wrong] -> Verify each command before committing `install-vale.md`.
  The GitHub release binary stays as a fallback for every platform.

## Migration Plan

1. Stop tracking the OpenSpec skills and add the mise bootstrap.
   Contributors run `mise install && mise run setup` once.
2. Move `Deslop/` and update every path.
   `mise run ci` must pass, and `Deslop.zip` must have the same file list as before the move.
3. Add the plugin, manifests, and release config.
   Releases after this merge publish the plugin and the zip from the same tag.
4. Change the eval harness, commit it, then run the paid eval from a clean tree.

Rollback: revert the merge commit.
The `Deslop.zip` asset name and contents never change, so Vale users need no rollback steps.
