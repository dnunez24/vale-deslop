# Deslop eval harness

Reproducible comparison of a treatment arm (this repo's Vale `Deslop` package, or its `deslop-writing`
plugin skill) against two popular agent "deslop" skills, on a fixed corpus, with a pre-registered
verdict. See [`../README.md`](../README.md#evidence) for the one-line summary and
[`REPORT.md`](REPORT.md) for the current results.

## Layout

- `corpus/`: six longform slop documents (~850-1,400 words each), authored for this eval. Every
  document trips at least 20 distinct `Deslop.*` checks and 60 total alerts (enforced by
  `tests/evals.test.ts`).
- `skills/`: vendored copies of the two competitor skills, pinned to a commit SHA and verified by
  sha256 (`skills/<name>/SOURCE.json`). Never hand-edit a vendored `SKILL.md`; re-run
  `mise run eval:vendor` after bumping the pin in `scripts/eval-vendor-skills.ts`.
- `prompts/`: the task text every arm receives. `shared.md` is byte-identical across arms and tells
  each arm to write its rewrite to `rewrite.md` and leave `deslop.md` unchanged; `control.md`,
  `skill.md`, and `vale-deslop.md` are each arm's extra instruction; `judge.md` is the blind-judging
  prompt. Each run copies this directory to `runs/<id>/prompts/`, and the report quotes the shared
  task text from that copy, so editing `prompts/` later never changes an earlier run's report.
- `runs/<id>/`: one directory per eval run — `results.json` (all metrics), `manifest.json` (the
  run's header: git sha, Vale version, package zip sha256, resolved writer and judge model ids, auth
  method, pinned skill shas, config including `treatmentArm`, preflight outcomes), `prompts/` (the
  prompts the run used), and `<doc>/<arm>/r<N>/{output.md,meta.json}` for every attempt (`output.md`
  is the attempt's `rewrite.md`), plus `judge/<doc>/<baselineArm>/r<N>/vote<K>.json` for every judge
  vote. `runs/LATEST` is a two-line text pointer to the most recent run id (not a symlink, so git
  handles it cleanly).
- `REPORT.md`: rendered from the latest run's `results.json`. Regenerate with `mise run eval:report`;
  never hand-edit it.
- `.scratch/`, `.measure-cache.json`, `.preflight.json`, and every `transcript.jsonl` are gitignored
  scratch/cache state, not eval artifacts.

## Reproducing

```sh
mise install
mise run setup
mise run eval:vendor
ANTHROPIC_API_KEY=op://automation/vale-deslop-anthropic-api-key/credential op run -- bun run scripts/eval-preflight.ts
ANTHROPIC_API_KEY=op://automation/vale-deslop-anthropic-api-key/credential op run -- mise run eval
mise run eval:report
mise run eval:verify
```

`mise run eval` runs `control`, both skill baselines, and the treatment arm
(`--treatment`, default `plugin-deslop-writing`). Pass options after `--`, for example
`mise run eval -- --arms control,skill-humanizer,skill-stephenturner,plugin-deslop-writing --repeats 3 --budget 70`.
`bun run scripts/eval-run.ts --help` lists them all.

### Auth and cost

Paid commands authenticate with an API key from the Claude Console organization linked to the Max
plan. That usage draws on the plan's monthly API credit, not its usage limits, so a run can't use up
the limits you need for normal work, and the `costUsd` figures match what the credit is charged. Pass
the key to one command with `op run`, as above. Never export it in a shell profile, set it in mise
`[env]`, or store it in GitHub: a set `ANTHROPIC_API_KEY` replaces the subscription login for
interactive Claude Code too. CI needs no key, because the `evals` workflow only runs `eval:verify`.
Preflight records the auth method (`api_key` under `op run`) and the model ids that served the writer
and judge calls, and the report shows them.

`mise run eval:measure` and `mise run eval:report` are deterministic and free: they recompute from
committed Markdown and `results.json` only, never call the `claude` CLI, and are safe to re-run any
time the corpus or a rule changes.

## Changing the corpus invalidates the current run

The corpus is a pre-registered instrument. If you edit a document in `corpus/`, every `runs/<id>/`
that measured against the old text is no longer comparable to the new one — redo the run
(`mise run eval`) rather than mixing old and new measurements in the same report. Never tune the
corpus toward a specific arm after seeing results; see the "Approach" notes in the design history for
why (`Do not tune the corpus, prompts, or criteria after seeing results`).

## Arms

| Arm id | Intervention |
| --- | --- |
| `control` | none (bare model) |
| `skill-humanizer` | [`blader/humanizer`](https://github.com/blader/humanizer), skill `humanizer` |
| `skill-stephenturner` | [`stephenturner/skill-deslop`](https://github.com/stephenturner/skill-deslop), skill `deslop` |
| `vale-deslop` | this package's built `Deslop.zip`, plus a `vale` fix loop |
| `plugin-deslop-writing` | the committed `plugin/skills/deslop-writing` skill, copied into the scratch project as written; the agent may run only `vale` as a shell command |

`control` is the floor, not a baseline: it shows what the base model does unaided, so a
treatment-vs-skill gap can't be mistaken for a gap the base model would have closed anyway. Each run
records its treatment arm in `results.config.treatmentArm`. The pre-registered criteria (C1-C4,
printed in `REPORT.md`'s Verdict section) compare that arm only against the two skill arms. Run 1
(`20260828-205343-dcc8eb2`) used `vale-deslop`.

Run 2 uses the arms `control`, `skill-humanizer`, `skill-stephenturner`, and `plugin-deslop-writing`
(the treatment), with 3 repeats, 3 judge votes, and a $70 budget. It re-runs every arm it compares,
because shared prompt v2 changed what the baselines do, and it leaves `vale-deslop` out: that arm's
result stands in run 1. A plugin-arm attempt fails as `skill-not-activated` if the transcript shows
no `deslop-writing` skill call, and as `config-tampering` if any file in the scratch copy of the skill
changed. Every arm fails as `source-modified` if it edits `deslop.md`, and as `no-output` if it never
writes `rewrite.md`.

## Preflight

`scripts/eval-preflight.ts` resolves four CLI/account unknowns before a run spends budget: auth and
model resolution, skill isolation (the vendored `humanizer` skill must be visible and a user-level
`deslop` skill must not leak in), the tool-deny mechanism, and structured judge output support. It
also records the resolved judge model id and the auth method from `claude auth status`. It writes
`runs/.preflight.json` (gitignored); `eval-run.ts` reads it rather than re-deciding. Re-run it
whenever the `claude` CLI version or your account's auth method changes.
