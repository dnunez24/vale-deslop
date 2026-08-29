# Deslop eval harness

Reproducible comparison of this repo's Vale `Deslop` package against two popular agent "deslop"
skills, on a fixed corpus, with a pre-registered verdict. See [`../README.md`](../README.md#evidence)
for the one-line summary and [`REPORT.md`](REPORT.md) for the current results.

## Layout

- `corpus/`: six longform slop documents (~850-1,400 words each), authored for this eval. Every
  document trips at least 20 distinct `Deslop.*` checks and 60 total alerts (enforced by
  `tests/evals.test.ts`).
- `skills/`: vendored copies of the two competitor skills, pinned to a commit SHA and verified by
  sha256 (`skills/<name>/SOURCE.json`). Never hand-edit a vendored `SKILL.md`; re-run
  `mise run eval:vendor` after bumping the pin in `scripts/eval-vendor-skills.ts`.
- `prompts/`: the task text every arm receives. `shared.md` is byte-identical across arms;
  `control.md`, `skill.md`, and `vale-deslop.md` are each arm's extra instruction; `judge.md` is the
  blind-judging prompt.
- `runs/<id>/`: one directory per eval run — `results.json` (all metrics), `manifest.json` (the
  run's header: git sha, Vale version, package zip sha256, resolved models, pinned skill shas,
  config, preflight outcomes), and `<doc>/<arm>/r<N>/{output.md,meta.json}` for every attempt, plus
  `judge/<doc>/<baselineArm>/r<N>/vote<K>.json` for every judge vote. `runs/LATEST` is a two-line
  text pointer to the most recent run id (not a symlink, so git handles it cleanly).
- `REPORT.md`: rendered from the latest run's `results.json`. Regenerate with `mise run eval:report`;
  never hand-edit it.
- `.scratch/`, `.measure-cache.json`, `.preflight.json`, and every `transcript.jsonl` are gitignored
  scratch/cache state, not eval artifacts.

## Reproducing

```sh
mise install
mise run setup
claude auth login   # or another supported claude CLI auth method
mise run eval:vendor
bun run scripts/eval-preflight.ts
mise run eval                 # spends real API credit
mise run eval:report
mise run eval:verify
```

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

`control` is the floor, not a baseline: it shows what the base model does unaided, so a Vale-vs-skill
gap can't be mistaken for a gap the base model would have closed anyway. The pre-registered criteria
(C1-C4, printed in `REPORT.md`'s Verdict section) compare `vale-deslop` only against the two skill
arms.

## Preflight

`scripts/eval-preflight.ts` resolves four CLI/account unknowns before a run spends budget: auth and
model resolution, skill isolation (the vendored `humanizer` skill must be visible and a user-level
`deslop` skill must not leak in), the tool-deny mechanism, and structured judge output support. It
writes `runs/.preflight.json` (gitignored); `eval-run.ts` reads it rather than re-deciding. Re-run it
whenever the `claude` CLI version or your account's auth method changes.
