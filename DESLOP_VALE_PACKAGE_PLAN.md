# Migrate Deslop into a standalone Vale package repo

## Context

`~/Projects/mi-casa` holds a 48-rule Vale style named `Deslop` (flags AI-written prose tells) under
`vale/styles/Deslop/*.yml` plus four Tengo scripts in `vale/styles/config/scripts/`.
It must move into `/Users/dnunez/Projects/vale-deslop` (git remote `git@github.com:dnunez24/vale-deslop.git`, currently
containing only `LICENSE`, `mise.toml`, `.gitignore`, `.claude/settings.json`, `.omp/`) and ship as a
distributable open-source Vale package.

End state: `vale-deslop` builds `Deslop.zip` (Vale "complete" package layout), publishes it on every
GitHub Release via release-please + conventional commits, self-lints its own Markdown with Vale
(`Vale` + `Microsoft` + `Deslop`) and rumdl, enforces commit format with commitlint, wires all of it
through Lefthook on `pre-commit`/`pre-push`/`commit-msg`, and runs the same checks in GitHub Actions
on pull requests.

Scope boundary: this plan changes only the `vale-deslop` repo. Rewiring `mi-casa` to consume the
published package (and deleting its local copy) is a separate change in a separate repo.

## Verified facts this plan depends on

Every item below was executed and observed this session; do not re-derive them.

- **Vale package zip layout.** A package zip must contain exactly one top-level directory whose name
  equals the zip basename. Verified by inspecting `Microsoft.zip` (`Microsoft/*.yml`),
  `Readability.zip`, `Hugo.zip` (`Hugo/.vale.ini`), `elastic-vale.zip`, and `Harper.zip`.
  Renaming the zip without renaming the inner directory fails with
  `lstat …/DeslopNoIni: no such file or directory`.
- **Deslop must be a "complete" package, not style-only.** Four rules use `extends: script` with
  `script: <Name>.tengo`, and Vale only resolves those from `StylesPath/config/scripts/`. A
  style-only zip extracts as `StylesPath/<Name>/`, which cannot carry `config/scripts`. Verified
  working layout:

  ```text
  Deslop.zip
  └── Deslop/
      ├── .vale.ini            # StylesPath = styles
      ├── LICENSE
      └── styles/
          ├── Deslop/*.yml + meta.json
          └── config/scripts/*.tengo
  ```

  `vale sync` on this zip produced `styles/Deslop/`, `styles/config/scripts/`, and
  `styles/.vale-config/0-Deslop.ini`, and `Deslop.AnaphoraRun` (a Tengo rule) fired correctly.
- **The packaged `.vale.ini` is mandatory.** Dropping it makes Vale treat the archive as style-only
  and linting dies with `style 'Deslop' does not exist on StylesPath`.
- **`Packages` accepts a relative directory.** `Packages = Microsoft, ./Deslop` synced both into
  `.vale/styles/` and both styles fired in one lint run. This is how the repo self-lints against its
  own package.
- **Vale 3.19.0 intermittently drops whole blocks of alerts.** Repeated identical runs over the same
  fixture tree returned 255/258/262 total alerts. It affects a single substitution rule in
  isolation (`Deslop.UnicodeDecoration` alone returned 3/6/10 across 20 runs) and is unaffected by
  `GOMAXPROCS=1`. Failures only ever *undercount*.
  Mitigation, measured: take the **union of `(file, check, line, span)` tuples across N runs**.
  Union totals by trial — N=1: `262 262 262 258 258 262 262 258 262 255`; N=3: `262` ×10;
  N=5: `262` ×12; N=10: `262` ×12. N=20 costs 0.8 s wall for the whole fixture tree. Use N=20.
- **mi-casa's committed expectations are stale/undercounted.** Diffing mi-casa's `EXPECTED` map
  against a union run on Vale 3.19.0 gives exactly two deltas, both increases:
  `rules/CurlyQuotes.md` `Deslop.CurlyQuotes` 8 → 9 and `rules/UnicodeDecoration.md`
  `Deslop.UnicodeDecoration` 9 → 10. All other 46 entries match. Use this as the acceptance check
  when regenerating.
- **Deslop does not depend on the House vocabulary.** No Deslop rule references a vocabulary; the
  only `House`/`vocab` hits in `vale/styles/Deslop/*.yml` are prose inside comments and messages.
  Dropping `Vocab = House` changed no counts. Do not migrate `config/vocabularies/`.
- **Clean-corpus baseline on Vale 3.19.0 with `BasedOnStyles = Deslop` and no `Vocab`:** exactly 9
  alerts, in 2 of 9 files — `clean/fiction.md` `Deslop.EmDashDocumentLimit` ×1 (error) and
  `Deslop.EmDashEmphasis` ×4 (warning); `clean/legal-policy.md` `Deslop.WordEcho` ×4 (suggestion).
- **Local toolchain / mise availability.** `mise ls-remote` offers `vale` 3.19.0, `bun` 1.4.0,
  `rumdl` 0.2.62, `lefthook` 2.1.11 (2.1.12 exists but is withheld by mise's `minimum_release_age`).
  Installed: bun 1.4.0, vale 3.19.0, rumdl 0.2.62, mise 2026.8.14. Lefthook is not installed yet.
- **`bun test` works for this.** A prototype using `Bun.spawnSync({cmd:["vale","--output=JSON","."],
  cwd, stdout:"pipe", stderr:"pipe"})` + `describe`/`it.each`/`expect().toEqual` ran 4 tests in
  72 ms. Vale's JSON keys are **relative** to `cwd`, e.g. `"rules/AIBuzzWords.md"`. Vale exits
  non-zero whenever any alert exists, so read `proc.stdout`, never branch on `exitCode`.
- **`extends: script` with a local `.tengo` file requires Vale ≥ 3.2.0** (`vale-cli/vale` v3.2.0
  changelog: `feat: support script-based actions` + `feat: allow script-based rules to use local
  files`). That is the correct `meta.json` floor.
- **Action versions, checked against their repos today:** `actions/checkout@v7` (v7.0.1),
  `jdx/mise-action@v4` (v4.3.0), `googleapis/release-please-action@v5` (v5.0.0). release-please
  root-component outputs include `release_created`, `tag_name`, and `version`.
- **`Bun.YAML.parse` is available in Bun 1.4.0.** `bun -e 'Bun.YAML.parse("extends: script\nscript:
  A.tengo\n")'` returned `{"extends":"script","script":"A.tengo"}`, so no YAML dependency is needed.
- **The official registry** is `vale-cli/packages` (the `errata-ai` org now redirects to
  `vale-cli`); `library.json` is a flat array of
  `{name, description, homepage, url, logo, tags}` with `url` pointing at
  `…/releases/latest/download/<Name>.zip`.
- **mise task behaviour, exercised against mise 2026.8.14.** `[tasks."lint:prose"]` — a quoted,
  colon-bearing task name — is accepted and runs as `mise run lint:prose`. `depends` fans out and
  runs its dependencies. Extra arguments are appended to the task's `run` command, with or without
  a `--` separator: `mise run echoargs -- a.md b.md` reached the script as `$1 $2`. `sources`
  alone gives correct `sources up-to-date, skipping` invalidation, and adding `outputs` also forces
  a rerun when the output is deleted (tested by `rm -rf node_modules`); declaring `outputs` that
  the task never creates emits a `did not generate expected output` warning, so only list paths the
  command really writes. `mise run` executes inside the mise tool environment, so a task body sees
  the pinned binaries. `mise exec -- <cmd>` runs a one-off command in the same environment.
- **Lefthook supports `post-checkout`.** It appears in `AvailableHooks` in
  `evilmartians/lefthook/internal/config/available_hooks.go`, alongside the `pre-commit`,
  `commit-msg`, and `pre-push` hooks this plan uses. Lefthook 2.1.12 is the newest tag; mise offers
  up to 2.1.11.

## Approach

### 1. Toolchain pins and task definitions

`mise` is the single task runner and the single tool-version source for this repo. Nothing is
defined twice: `package.json` carries no `scripts` block, and every entry point below is a
`mise run <task>` invocation — from the shell, from Lefthook, and from CI.

Replace `mise.toml`:

```toml
[tools]
bun = "1.4.0"
lefthook = "2.1.11"
rumdl = "0.2.62"
vale = "3.19.0"

[tasks.deps]
description = "Install JavaScript dependencies with Bun"
run = "bun install"
sources = ["package.json", "bun.lock"]
outputs = ["node_modules/.bin/commitlint"]

[tasks."deps:ci"]
description = "Install JavaScript dependencies from the committed lockfile"
run = "bun install --frozen-lockfile"

[tasks.hooks]
description = "Install the Lefthook git hooks"
run = "lefthook install"

[tasks.sync]
description = "Download the Vale styles this repo lints itself with"
run = "vale sync"

[tasks.setup]
description = "Install dependencies, git hooks, and Vale styles"
depends = ["deps", "hooks", "sync"]

[tasks.test]
description = "Run the test suite"
run = "bun test"

[tasks."lint:prose"]
description = "Lint Markdown prose with the Vale, Microsoft, and Deslop styles"
run = "./scripts/lint-prose.sh"

[tasks."lint:md"]
description = "Lint Markdown structure with rumdl"
run = "rumdl check ."

[tasks.build]
description = "Build dist/Deslop.zip"
run = "./scripts/build-package.sh"

[tasks."expected:update"]
description = "Regenerate tests/expected-alerts.json from real Vale output"
run = "bun run scripts/regen-expected.ts"

[tasks."readme:update"]
description = "Regenerate the rule table in README.md"
run = "bun run scripts/regen-rule-table.ts"

[tasks.ci]
description = "Everything the pull-request workflow runs"
depends = ["test", "lint:prose", "lint:md", "build"]
```

`lint:prose` passes no path: `scripts/lint-prose.sh` defaults to the repo root and forwards any
extra arguments, so `mise run lint:prose README.md` lints one file (see step 7).

`deps` declares both `sources` and `outputs` on purpose: `sources` alone skips the task after a
`rm -rf node_modules`, whereas the missing `outputs` entry forces a reinstall. Verified both
behaviours against mise 2026.8.14.

Append to the existing `.gitignore` (keep the two `.omp/plugins` lines already there):

```gitignore
node_modules/
.vale/
dist/
```

Create `package.json` — private, never published. It exists for two reasons only: commitlint
resolves from `node_modules`, and release-please's `node` strategy bumps its `version`. It has no
`scripts` block; tasks live in `mise.toml`.

```json
{
  "name": "vale-deslop",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "A Vale style that flags the tells of AI-written prose.",
  "license": "MIT",
  "devDependencies": {
    "@commitlint/cli": "^21.2.0",
    "@commitlint/config-conventional": "^21.2.2"
  }
}
```

Run `mise run deps` and commit `bun.lock`.

`commitlint.config.js`:

```js
export default { extends: ["@commitlint/config-conventional"] };
```

### 2. Package source tree (`Deslop/`)

This directory is zipped verbatim, mirroring how `vale-cli/Microsoft` keeps `Microsoft/` at repo
root.

- `cp -R ~/Projects/mi-casa/vale/styles/Deslop Deslop/styles/Deslop` — all 48 `.yml`, unmodified.
- `cp -R ~/Projects/mi-casa/vale/styles/config/scripts Deslop/styles/config/scripts` — the four
  Tengo files `AnaphoraRun.tengo`, `SentenceRhythm.tengo`, `StaccatoFragments.tengo`,
  `WordEcho.tengo`.
- Do **not** copy `vale/styles/config/vocabularies/`, `vale/styles/House/`, or
  `vale/styles/Readability/`.
- `Deslop/.vale.ini`, exactly:

  ```ini
  # Marks this archive as a Vale "complete" package: the bundled styles live in
  # the sibling `styles/` folder. Deliberately does not set BasedOnStyles or
  # MinAlertLevel -- enabling Deslop and choosing a severity floor belong to the
  # consuming project, and a section here would silently merge with theirs.
  StylesPath = styles
  ```

- `Deslop/styles/Deslop/meta.json`:

  ```json
  {
    "feed": "https://github.com/dnunez24/vale-deslop/releases.atom",
    "vale_version": ">=3.2.0"
  }
  ```

### 3. Repo self-lint configuration

`.vale.ini` at repo root — Markdown only; there is no source code in this repo, so mi-casa's
`[formats]` block and its `[*.{js,jsx,ts,tsx}]` section do not carry over except for the tests,
which are TypeScript and are not prose-linted:

```ini
StylesPath = .vale/styles
MinAlertLevel = suggestion

# `./Deslop` is this repo's own package directory: `vale sync` copies it into
# StylesPath exactly as a consumer would, so the docs are linted by the artifact
# we ship rather than by loose source files.
Packages = Microsoft, ./Deslop

[*.md]
BasedOnStyles = Vale, Microsoft, Deslop

# Generated by release-please, not hand-authored prose.
[CHANGELOG.md]
BasedOnStyles =

# Deliberately slop-filled rule fixtures plus a clean multi-genre corpus, both
# inputs to tests/. The `**` is required: fixtures live in rules/ and clean/.
[tests/fixtures/**]
BasedOnStyles =
```

`.rumdl.toml` at repo root — flattened from mi-casa's `rumdl/base.toml` (no `extends`, since the
`@dnunez24/config` package is not a dependency here):

```toml
[global]
exclude = [".git", ".github", ".vale", "dist", "node_modules", "CHANGELOG.md", "tests/fixtures"]
respect-gitignore = true
line-length = 100

[MD013]
code-blocks = false
tables = false
headings = false
paragraphs = false
reflow = true
reflow-mode = "sentence-per-line"

[MD060]
enabled = true
style = "aligned"
max-width = 0
```

### 4. Test fixtures

- `cp -R ~/Projects/mi-casa/fixtures/vale-deslop/rules tests/fixtures/rules` — 48 `.md`, one per
  rule, names must match `Deslop/styles/Deslop/*.yml` basenames exactly.
- `cp -R ~/Projects/mi-casa/fixtures/vale-deslop/clean tests/fixtures/clean` — 9 `.md`:
  `academic`, `business-memo`, `fiction`, `howto`, `journalism`, `legal-policy`,
  `marketing-honest`, `personal-essay`, `technical-reference`.
- `tests/fixtures/.vale.ini` (replaces mi-casa's, which pointed at a different tree and set
  `Vocab = House`):

  ```ini
  StylesPath = ../../Deslop/styles
  MinAlertLevel = suggestion

  [*.md]
  BasedOnStyles = Deslop
  ```

  Linting the package source directly (not the synced copy) keeps the rule tests independent of
  `vale sync`; step 7's package test covers the synced path.

### 5. Test harness

`tests/helpers/vale.ts`:

```ts
export type Alert = {
  Check: string;
  Severity: "error" | "warning" | "suggestion";
  Line: number;
  Span: [number, number];
  Match: string;
  Message: string;
};
export type ValeResults = Record<string, Alert[]>;
```

- `export function valeJson(args: string[], cwd: string): ValeResults` — runs
  `Bun.spawnSync({cmd: ["vale", "--no-global", "--output=JSON", ...args], cwd, stdout: "pipe",
  stderr: "pipe"})`, throws if `stdout` is blank (include `stderr` in the message), otherwise
  `JSON.parse`. `--no-global` keeps a developer's `~/.vale.ini` out of the run. Never inspect
  `exitCode`: Vale exits 1 on any alert.
- `export const UNION_RUNS = 20;`
- `export function valeUnion(args: string[], cwd: string, runs = UNION_RUNS): ValeResults` — calls
  `valeJson` `runs` times, dedupes into a `Map` keyed by
  `` `${file}\u0000${a.Check}\u0000${a.Line}\u0000${a.Span[0]}\u0000${a.Span[1]}` ``, and returns
  the merged results. Carry a comment recording the measurement: Vale 3.19.0 nondeterministically
  drops blocks of matches (255–262 alerts across identical runs); the union is stable at 262 from
  N=3 upward and N=20 costs ~0.8 s.
- `export function countsByCheck(alerts: Alert[]): Record<string, number>`.
- `export const fixturesRoot` / `styleDir` / `packageRoot` — absolute paths derived from
  `import.meta.dir`.
- `export function ruleNames(): string[]` — `readdirSync(styleDir)`, keep `*.yml`, strip the
  extension, **drop `meta.json`**, sort.

`scripts/regen-expected.ts` — `valeUnion(["."], fixturesRoot)`, reduce to
`{[file]: countsByCheck(alerts)}`, drop empty objects, write `tests/expected-alerts.json`
sorted by key with 2-space indent and a trailing newline. Wired to `mise run expected:update`.

`tests/expected-alerts.json` (committed) covers both `rules/*` and `clean/*` keys. Generate it, then
diff against mi-casa's `EXPECTED` map: the only differences must be
`rules/CurlyQuotes.md → Deslop.CurlyQuotes: 9` and
`rules/UnicodeDecoration.md → Deslop.UnicodeDecoration: 10`, plus the two `clean/*` entries. Any
third difference means the fixtures or rules were altered in transit — stop and reconcile.

### 6. Tests

Four files under `tests/`, all using `bun:test`. Each computes results from a single shared
`valeUnion` call per file scope, never per assertion.

`tests/rules.test.ts`:

1. `"has exactly one fixture per rule"` — `readdirSync(tests/fixtures/rules)` basenames equal
   `ruleNames()`.
2. `it.each(ruleNames())("Deslop.%s fires on its own fixture")` — the expected map has an entry for
   `rules/<Rule>.md` and `expected["Deslop." + rule] >= 1`. This is what catches a new rule landing
   without a fixture, or a rule that silently stops matching.
3. `"matches the committed alert-count map for every rule fixture"` — build
   `{file: countsByCheck}` for keys starting `rules/` and `toEqual` the same-prefixed slice of
   `tests/expected-alerts.json`.

`tests/clean.test.ts`:

1. `"covers all nine prose genres"` — basenames of `tests/fixtures/clean` equal the nine names.
2. `"matches the committed alert-count map for the clean corpus"` — `clean/`-prefixed slice
   `toEqual`s the expectations, i.e. exactly `clean/fiction.md` and `clean/legal-policy.md` carry
   alerts and the other seven files are absent from the map.
3. `"raises no error or warning outside the fiction em-dash allowance"` — the only non-suggestion
   alerts anywhere in `clean/` are `Deslop.EmDashDocumentLimit` and `Deslop.EmDashEmphasis` on
   `clean/fiction.md`. Comment why: `clean/fiction.md` is literary prose that uses em dashes on
   purpose, which is the honest scope boundary of the `EmDash*` family — a fiction author disables
   them.

`tests/style.test.ts` — structural validation, no Vale invocation. Parse each
`Deslop/styles/Deslop/*.yml` with `Bun.YAML.parse` (verified present in Bun 1.4.0; no dependency
needed):

1. every rule declares `extends`, `message`, and a `level` in `{error, warning, suggestion}`;
2. every `extends: script` rule's `script` value names a file that exists in
   `Deslop/styles/config/scripts/` — this is the check that would have caught a Tengo file left
   behind in the migration;
3. no `.tengo` file is orphaned (every script in `config/scripts/` is referenced by some rule);
4. `Deslop/styles/Deslop/meta.json` parses and its `vale_version` is `">=3.2.0"`;
5. `Deslop/.vale.ini` contains `StylesPath = styles`;
6. the README rule table is in sync (see step 9): re-derive the table rows from the rule files and
   compare against the block between the README markers.

`tests/package.test.ts` — distribution regression, the reason a broken zip cannot ship:

1. run `scripts/build-package.sh <tmpdir>` via `Bun.spawnSync`, assert exit 0 and that
   `<tmpdir>/Deslop.zip` exists;
2. `unzip -Z1` the archive and assert every entry starts with `Deslop/`, that
   `Deslop/.vale.ini`, `Deslop/LICENSE`, `Deslop/styles/Deslop/meta.json`, all 48
   `Deslop/styles/Deslop/*.yml`, and all 4 `Deslop/styles/config/scripts/*.tengo` are present, and
   that no `.DS_Store` entry exists;
3. in a second temp directory, write a config whose `Packages` is the absolute path to that zip and
   whose `[*.md]` sets `BasedOnStyles = Deslop`, run `vale --no-global --config=<cfg> sync`, assert
   the sync succeeded and that `styles/config/scripts/AnaphoraRun.tengo` landed;
4. lint a three-line inline sample whose sentences all start with `You should note` and assert
   `Deslop.AnaphoraRun` fires — a Tengo rule resolved from the synced `config/scripts`, which is
   precisely what the style-only layout breaks.

Use `fs.mkdtempSync(join(tmpdir(), "deslop-"))` and clean up in `afterAll`.

### 7. Build and lint entry points

`scripts/build-package.sh` (mode 0755):

```bash
#!/usr/bin/env bash
# Builds the distributable Vale package. The archive is what users install, so
# the license travels inside it -- same reason vale-cli/Microsoft copies LICENSE
# into its style folder before zipping.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/dist}"
build="$(mktemp -d)"
trap 'rm -rf "$build"' EXIT
mkdir -p "$out"
rm -f "$out/Deslop.zip"
cp -R "$root/Deslop" "$build/Deslop"
cp "$root/LICENSE" "$build/Deslop/LICENSE"
( cd "$build" && zip -qr "$out/Deslop.zip" Deslop -x "*.DS_Store" )
echo "$out/Deslop.zip"
```

The inner directory name must stay `Deslop` because Vale resolves the archive's top-level directory
by the zip's basename.

`scripts/lint-prose.sh` (mode 0755) — `vale sync` needs the network for `Microsoft`, so running it
unconditionally would break offline commits; running it never would leave `.vale/styles/Deslop`
stale after a rule edit. With no arguments it lints the whole repo, so `mise run lint:prose` needs
no path and `mise run lint:prose README.md` still works:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
stamp=".vale/.synced"
needs_sync() {
  [ -d .vale/styles/Microsoft ] || return 0
  [ -f "$stamp" ] || return 0
  [ -n "$(find Deslop -newer "$stamp" -print -quit)" ] && return 0
  return 1
}
if needs_sync; then
  vale sync
  mkdir -p .vale && touch "$stamp"
fi
exec vale "${@:-.}"
```

`scripts/post-checkout.sh` (mode 0755) — brings a working copy up to date after a branch switch or
a fresh clone, without ever blocking the checkout:

```bash
#!/usr/bin/env bash
# git post-checkout args: $1 previous HEAD, $2 new HEAD, $3 is 1 for a branch
# checkout and 0 for a file checkout. Only branch checkouts can change
# mise.toml, package.json, or bun.lock, so file checkouts exit immediately.
#
# mise is optional tooling, not a hard dependency: a contributor without it on
# PATH still gets a working checkout, just without the refresh. Failures are
# reported but never fail the hook, because a checkout that aborts on a network
# blip is worse than a stale node_modules.
set -uo pipefail
[ "${3:-0}" = "1" ] || exit 0
command -v mise >/dev/null 2>&1 || exit 0
cd "$(git rev-parse --show-toplevel)" || exit 0
mise install || echo "post-checkout: 'mise install' failed; run it by hand" >&2
mise run deps || echo "post-checkout: 'mise run deps' failed; run it by hand" >&2
exit 0
```

It installs the pinned tools and the Bun packages, both through mise, and stops there. Vale styles
are deliberately not synced here: `scripts/lint-prose.sh` already re-syncs on demand when
`Deslop/` is newer than the last sync, so adding `mise run sync` would put a network round trip on
every `git checkout` for no gain. `mise run deps` is a no-op when `package.json` and `bun.lock` are
unchanged and `node_modules/.bin/commitlint` exists.

### 8. Git hooks

`lefthook.yml` (single file — mi-casa's `extends: ./lefthook/base.yml` split exists only to share
config across a monorepo and has no purpose here). Every job shells out through `mise run` so a
task has exactly one definition and resolves the pinned tool versions even when the developer's
shell has no mise activation:

```yaml
assert_lefthook_installed: true

# Pre-commit autofixes Markdown, then re-lints it, then runs the suite. `piped`
# makes the order load-bearing: rumdl reflows prose to sentence-per-line, so
# Vale must see the reflowed text. `skip` keeps autofixes out of conflict
# resolution.
pre-commit:
  piped: true
  skip:
    - merge
    - rebase
  jobs:
    - name: rumdl
      glob: "*.md"
      run: mise exec -- rumdl check --fix {staged_files}
      stage_fixed: true
    - name: vale
      glob: "*.md"
      run: mise run lint:prose -- {staged_files}
    - name: test
      run: mise run test

commit-msg:
  jobs:
    - name: commitlint
      run: mise exec -- bunx commitlint --edit {1}

# Refresh pinned tools and Bun packages after a branch switch or clone.
post-checkout:
  jobs:
    - name: mise-setup
      run: ./scripts/post-checkout.sh {1} {2} {3}

pre-push:
  piped: true
  jobs:
    - name: ci
      run: mise run ci
```

`rumdl` and `commitlint` use `mise exec` rather than `mise run` because both need per-invocation
arguments that a fixed task body cannot carry (`{staged_files}` and the commit-message path). The
`--` before `{staged_files}` keeps mise from parsing a leading-dash filename as one of its own
flags. `pre-push` runs the single `ci` task so the hook and the pull-request workflow can never
drift.

### 9. Documentation

`README.md`:

- Title, one-line description, and badges for the `test` workflow and the latest release.
- **What it catches** — a table of all 48 rules (`Rule | Level | Flags`) inside
  `<!-- rules:start -->` / `<!-- rules:end -->` markers, generated by
  `scripts/regen-rule-table.ts` (`mise run readme:update`) from each rule's `level` and the first
  line of its `message`, and asserted in sync by `tests/style.test.ts`. Generating it is what keeps
  a 48-row table from rotting.
- **Requirements** — Vale 3.2.0 or newer, because the Tengo rules load a local script file.
- **Install** — three forms, all real: the pinned release URL
  (`Packages = https://github.com/dnunez24/vale-deslop/releases/download/v<X.Y.Z>/Deslop.zip`), the
  bare registry name `Deslop` (valid only after the `vale-cli/packages` PR in step 11 merges — say
  so), and a local `.zip`/directory path. Show the full consumer `.vale.ini`, including
  `BasedOnStyles = Deslop` (the package deliberately does not enable itself) and `vale sync`.
- **Configuration** — turning a rule off (`Deslop.EmDashAside = NO`), changing severity, and the
  source-comment caveat: when linting code comments as Markdown, disable the nine document-shape
  rules that measure a whole document and misfire on a file fragment —
  `AnaphoraRun`, `BoldFirstBullet`, `ExclamationDensity`, `HedgingDensity`, `ListicleInProse`,
  `SentenceRhythm`, `StaccatoFragments`, `WhOpener`, `WordEcho` — with mi-casa's `[formats]` block
  as the worked example.
- **Known interactions** — `Deslop.UnicodeDecoration` rewrites Unicode to ASCII while
  `proselint.Typography` rewrites the other way, so a project running both must disable
  `proselint.Typography` (the rationale is already in the rule's header comment).
- Links to `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `LICENSE`.

`CONTRIBUTING.md` — covers the three things GitHub's contributor-guidelines doc asks for (how to
file good issues and PRs, links to external docs and a code of conduct, behavioural expectations):

- Code of conduct link; how to report a bug, a false positive, and propose a new rule (a false
  positive report must include the sentence that tripped it and the rule name).
- **Setup**: `mise install`, then `mise run setup` (`deps` + `hooks` + `sync`). Note that
  `mise tasks ls` lists every entry point, and that after `mise run hooks` a branch checkout
  refreshes tools and packages on its own via the `post-checkout` hook.
- **Repo layout**: `Deslop/` is the shipped package; `tests/fixtures/rules/<Rule>.md` is the
  positive fixture for `Deslop/styles/Deslop/<Rule>.yml`; `tests/fixtures/clean/` is the
  false-positive guard.
- **Changing or adding a rule**: edit or add the `.yml`; add or update
  `tests/fixtures/rules/<Rule>.md` so the rule fires at least three times; run
  `mise run expected:update`; review the `tests/expected-alerts.json` diff by hand — an unexpected
  change in another rule's counts means the new rule overlaps an existing one; run `mise run test`;
  run `mise run readme:update` if the rule's `level` or first `message` line changed. State that
  `tests/fixtures/**` is excluded from both Vale and rumdl on purpose and must not be reformatted.
- **Commits**: Conventional Commits, enforced by commitlint on `commit-msg`; `feat:` for a new rule
  or a broadened match, `fix:` for a false-positive fix, `feat!:`/`BREAKING CHANGE:` for removing or
  renaming a rule (it changes consumers' `.vale.ini`). Never hand-edit `CHANGELOG.md` or
  `package.json`'s `version`.
- **Releasing** (maintainers): merging to `main` makes release-please open or update a release PR;
  merging that PR tags, cuts the GitHub Release, and uploads `Deslop.zip`. Include the exact
  `library.json` entry from step 11 for the one-time registry submission.

`CODE_OF_CONDUCT.md` — Contributor Covenant 2.1 verbatim, with the maintainer's contact address in
the enforcement section.

`.github/PULL_REQUEST_TEMPLATE.md` and `.github/ISSUE_TEMPLATE/` with `bug_report.md`,
`false_positive.md`, and `rule_proposal.md`.

Everything written here is itself linted by `Vale` + `Microsoft` + `Deslop` and by rumdl, so expect
to iterate on the prose until `mise run lint:prose` and `mise run lint:md` are clean. That is the
point: the package dogfoods itself.

### 10. GitHub Actions

`.github/workflows/test.yml`:

```yaml
name: test

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: test-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: jdx/mise-action@v4
      - run: mise run deps:ci
      - run: mise run sync
      - run: mise run ci
```

`mise-action` installs every tool pinned in `mise.toml`, so there is no separate `setup-bun` or Vale
download step. CI uses `deps:ci` rather than `deps` because `bun install --frozen-lockfile` must
fail on a stale `bun.lock` instead of silently updating it. `mise run sync` runs before `ci` so the
`lint:prose` task never has to decide whether to hit the network mid-run; `ci` then fans out to
`test`, `lint:prose`, `lint:md`, and `build`, the exact set `pre-push` runs locally.

`.github/workflows/release.yml`:

```yaml
name: release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - uses: googleapis/release-please-action@v5
        id: release
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  publish:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ needs.release-please.outputs.tag_name }}
      - uses: jdx/mise-action@v4
      - run: mise run build
      - run: gh release upload "$TAG" dist/Deslop.zip --clobber
        env:
          TAG: ${{ needs.release-please.outputs.tag_name }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The `publish` job installs mise too, so the archive is built by the same `build` task developers run
locally rather than by a second, drifting copy of the command.

`release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md"
    }
  }
}
```

`.release-please-manifest.json`:

```json
{ ".": "0.0.0" }
```

`release-type: node` bumps `package.json`'s `version` — the version field already there — so no
extra `version.txt` is introduced. Starting the manifest at `0.0.0` makes the first `feat:` release
`0.1.0`, matching the 0.x line every official Vale package sits on (`Microsoft` v0.15.1,
`Readability` v0.1.1).

Repository settings this depends on, to be set once in the GitHub UI: Settings → Actions → General →
Workflow permissions → **Read and write permissions** and **Allow GitHub Actions to create and
approve pull requests**. Without the second, release-please cannot open its release PR. Also set
Settings → Branches → branch protection rule for `main` → **Require status checks to pass before
merging**, with the `test` workflow selected. The `release` workflow's `publish` job builds and
uploads `Deslop.zip` without re-running `test`/`lint:prose`/`lint:md`; it trusts that whatever
reached `main` already passed CI on its pull request, and this setting is what makes that trust
hold — without it, a direct push to `main` bypasses CI and can ship a broken archive.

### 11. Registry submission

After the first release publishes `Deslop.zip`, open a PR against `vale-cli/packages` adding this
object to `library.json` in alphabetical position:

```json
{
  "name": "Deslop",
  "description": "Flags the tells of AI-written prose: buzzwords, em-dash habits, hedging density, negative parallelism, and 44 more rules.",
  "homepage": "https://github.com/dnunez24/vale-deslop",
  "url": "https://github.com/dnunez24/vale-deslop/releases/latest/download/Deslop.zip",
  "logo": "https://github.com/dnunez24.png",
  "tags": ["style"]
}
```

Record this in `CONTRIBUTING.md`'s release section rather than leaving it undocumented.

## Critical files & anchors

| Path | Why it is non-obvious |
| --- | --- |
| `Deslop/.vale.ini` | One line, but omitting it makes the whole archive unusable — Vale falls back to the style-only layout and cannot find the style. |
| `~/Projects/mi-casa/tests/vale-deslop.test.ts` | Source of the fixture assertions and the clean-corpus allowance. Its `EXPECTED` map is stale by exactly two entries; treat it as a reference, not as truth. |
| `Deslop/styles/Deslop/{AnaphoraRun,SentenceRhythm,StaccatoFragments,WordEcho}.yml` | The four `extends: script` rules. Their `script:` values are bare filenames resolved against `StylesPath/config/scripts/`, which is why the package cannot be style-only. |
| `scripts/lint-prose.sh` | Encodes the offline-versus-stale tradeoff for `vale sync`. Replacing it with a bare `vale` call silently lints against stale rules after every rule edit. |
| `scripts/post-checkout.sh` | Must exit 0 on every failure path. A post-checkout hook that returns non-zero after `git checkout` leaves the developer staring at an error for a branch that already switched. |
| `tests/helpers/vale.ts` | The `valeUnion` retry is load-bearing, not defensive padding: a single Vale run is measurably nondeterministic and the suite is flaky without it. |

## Verification

Run from `/Users/dnunez/Projects/vale-deslop` with `mise install` already done.

1. **Task inventory.** `mise tasks ls` lists `build`, `ci`, `deps`, `deps:ci`, `expected:update`,
   `hooks`, `lint:md`, `lint:prose`, `readme:update`, `setup`, `sync`, and `test`, each with a
   description. `grep -c '"scripts"' package.json` returns 0 — there is one task runner, not two.
2. **Suite.** `mise run setup && mise run test` — all tests pass. `tests/package.test.ts` is the
   end-to-end proof: it builds `Deslop.zip`, syncs it into a scratch directory, and asserts
   `Deslop.AnaphoraRun` fires on `You should note this. / You should note that. / You should note
   the other.` — a Tengo rule loaded from the synced `config/scripts`, which is exactly what a
   wrong zip layout breaks.
3. **Fixture parity with the source repo.** After `mise run expected:update`, diff
   `tests/expected-alerts.json` against mi-casa's `EXPECTED`. Expect exactly two `rules/` deltas
   (`CurlyQuotes` 8 → 9, `UnicodeDecoration` 9 → 10) plus the two `clean/` entries. A third delta
   means the migration altered a rule or fixture.
4. **Union stability.** `for i in 1 2 3 4 5; do bun test tests/rules.test.ts; done` — five
   consecutive green runs. This is the check that the N=20 union actually absorbs Vale's
   nondeterminism; a single un-unioned run fails roughly 40% of the time.
5. **Self-lint.** `mise run lint:prose && mise run lint:md` — zero alerts across `README.md`,
   `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and the `.github/` templates, with `Vale`, `Microsoft`,
   and `Deslop` all loaded. Confirm all three are active by checking that
   `.vale/styles/{Microsoft,Deslop,config/scripts}` exist after the run.
6. **Archive shape.** `mise run build && unzip -l dist/Deslop.zip` — every path is under
   `Deslop/`; the listing includes `Deslop/.vale.ini`, `Deslop/LICENSE`, 48
   `Deslop/styles/Deslop/*.yml`, `Deslop/styles/Deslop/meta.json`, and 4
   `Deslop/styles/config/scripts/*.tengo`; nothing else.
7. **Consumer smoke test, outside the repo.**

   ```bash
   d=$(mktemp -d) && cd "$d"
   printf 'StylesPath = styles\nMinAlertLevel = suggestion\nPackages = %s\n\n[*.md]\nBasedOnStyles = Deslop\n' \
     "$OLDPWD/dist/Deslop.zip" > .vale.ini
   printf 'This is a comprehensive, robust solution that will utilize synergy.\n' > t.md
   vale --no-global sync && vale --no-global t.md
   ```

   Expect a successful sync and at least one `Deslop.BusinessJargon` alert on `utilize`.
8. **Hooks.** `mise run hooks`, then stage a Markdown file containing `→` and commit with the
   message `bad message`. The commit must be rejected by commitlint; retrying with
   `docs: check hook wiring` must run rumdl, Vale, and the tests in that order and fail on
   `Deslop.UnicodeDecoration` until the arrow is fixed. Then `lefthook run pre-push` passes.
9. **Post-checkout hook.** With hooks installed, `rm -rf node_modules && git checkout -b
   scratch-check && git checkout -` reinstalls `node_modules` on the first checkout — confirm
   `node_modules/.bin/commitlint` exists afterwards — and prints `sources up-to-date, skipping` on
   the second, proving the mise `sources`/`outputs` cache short-circuits the common case. Then
   `PATH=/usr/bin:/bin git checkout -b scratch-nomise` must succeed silently with no mise output,
   proving the `command -v mise` guard. Delete both scratch branches.
10. **CI, on the migration pull request.** The `test` workflow is green: `mise run ci` runs `test`,
    `lint:prose`, `lint:md`, and `build`. After merge, the `release` workflow opens a release PR;
    merging it produces tag `v0.1.0`, a GitHub Release, a populated `CHANGELOG.md`, and a
    `Deslop.zip` asset. Download that asset and re-run check 7 against the released URL rather than
    the local file.

## Assumptions & contingencies

- **Rule content is migrated verbatim.** No rule is retuned, renamed, or dropped as part of this
  move. If a fixture's counts differ from the two documented deltas, reconcile rather than
  rubber-stamping the regenerated JSON.
- **Rule files stay parseable as plain YAML.** `Bun.YAML.parse` handles the current 48 files. If a
  future rule needs a YAML feature Bun rejects, add `yaml` to `devDependencies` rather than
  hand-rolling a parser or dropping the structural test.
- **`bunx commitlint` resolves the local install.** If the `commit-msg` hook cannot find it, change
  the job to `mise exec -- bun run --bun commitlint --edit {1}` — do not fall back to a network
  `bunx` installation, which breaks offline commits.
- **The `post-checkout` hook stays advisory.** It never fails a checkout and never touches the
  network beyond what `mise install` and `bun install` already need. If a contributor wants Vale
  styles refreshed on checkout too, that is a `mise run sync` line they add locally, not a default —
  `scripts/lint-prose.sh` already re-syncs on demand.
- **release-please can open PRs.** If the first `main` push produces no release PR, the repository
  setting from step 10 is missing; enable it and re-run the workflow rather than switching release
  tooling.
- **The `Deslop` registry name is unclaimed.** `vale-cli/packages/library.json` currently holds 18
  entries and none is `Deslop`. If the maintainers reject or rename it, the pinned-URL and
  local-path install paths in the README still work unchanged; only the "bare name" paragraph needs
  editing.
- **Vale's dropped-alert bug may be fixed upstream.** If a future Vale release makes single runs
  deterministic, lower `UNION_RUNS` — do not remove `valeUnion`, since the union is also what makes
  the counts reproducible across machines.
