# Handoff: eval v2, rule audit, and skill v2

This document is a self-contained brief for a new session.
It assumes no memory of the previous one.
Read it fully, then follow "Start here".

## Start here

0. Run the `openspec-explore` skill on this document first, to settle open questions, before creating any change.
   This file is temporary. As each change is proposed, move its content into that change and delete the matching section here. Delete the file when all four changes exist, and remove its two lint exclusions (`.vale.ini`, `.rumdl.toml`).
1. Read this file, then `openspec/changes/add-deslop-writing-plugin/design.md` and `evals/README.md`.
2. Work on branch `dnunez24/deslop-agent-plugin`, or a branch cut from it after it merges.
3. Create OpenSpec changes for the work (see "Work breakdown"), using the `openspec-new-change` skill.
   The change in `openspec/changes/add-deslop-writing-plugin/` is complete and must not be edited.
4. Resolve the open decisions in the last section with the user before spending money or sourcing data.
5. Do not change rules, prompts, the skill, or evaluation criteria after you have seen held-out results.
   That is a standing rule of this repo (`evals/README.md`).

## Why this work exists

The repo ships Deslop, a set of 48 Vale rules that flag the tells of AI-written prose.
It also ships `deslop-writing`, an agent skill that revises prose with those rules as advice.
The first plugin eval (run `20261107-210836-b7e8a5c`) did not support the hypothesis that the skill beats two popular baseline skills.
The user then asked how to make the skill better, and whether the eval measures anything real.
The answer to the second question is mostly no, so the eval comes first.

### What run 2 measured

Source: `evals/runs/20261107-210836-b7e8a5c/results.json` and `evals/REPORT.md`.

| Arm                     | Alerts per 1k words | Judge rubric (0 to 10) | Fidelity (0 to 5) | Judge win rate |
| ----------------------- | ------------------- | ---------------------- | ----------------- | -------------- |
| `control` (bare model)  | 19.7                | n/a                    | n/a               | n/a            |
| `skill-humanizer`       | 9.83                | 7.13                   | 4.54              | 0.33           |
| `skill-stephenturner`   | 5.6                 | 7.59                   | 3.87              | 0.44           |
| `plugin-deslop-writing` | 6.96                | 7.60                   | 4.41              | 0.61           |

- Pre-registered criteria: C1 failed (fewer alerts than `skill-stephenturner` on only 1 of 6 documents), C2 to C4 passed.
- The plugin ties the best baseline on judged quality and beats it on fidelity.
  It loses only on Vale alert density.
- The plugin's top remaining alerts were `VagueAttribution` (26), `BoldFirstBullet` (18), `ScareQuotes` (11), and `HashtagBlock` (6).
  Clearing them requires inventing a source, restructuring the document, or deleting a link, hashtag, or quote.
  The skill forbids all three, so on C1 it loses points for obeying the fidelity constraint.
  The corpus was written to contain these traps.
- Cost: $17.26 for 72 attempts plus 108 judge votes.
  Per attempt: about $0.14 to $0.19 for skill arms.

### Why the eval is not good enough

These are the verified problems.
Each maps to a workstream below.

1. **Circular metric.**
   C1 counts Vale alerts from the same rules the skill is told to satisfy.
   An arm can win by gaming the rules, and a skill that merely deletes content wins on density.
   The retention floor (0.70) only partly guards this.
2. **No human text anywhere.**
   The six corpus documents (`evals/corpus/*.md`) were authored as slop to trip at least 20 checks and 60 alerts each.
   Every arm output is AI-written.
   Nothing in the eval says what human writing looks like.
3. **Undefined "good".**
   The judge rubric (directness, rhythm, trust, authenticity, density) has no human anchor and no written definition beyond one-line questions.
4. **Same-family judge.**
   Opus 5.5 judges text written by Sonnet 5.5.
   LLM judges are known to favor LLM-style text.
   The previous change listed other-provider judges as a non-goal, so this is open for v2.
5. **Tiny, designed sample.**
   Six documents, three repeats.
   The corpus was built around the rules, so it cannot show that a rule fires wrongly on normal prose or misses a new tell.
6. **Rule quality is unknown.**
   False positives are guarded only by nine small fixtures in `tests/fixtures/clean/` (provenance not checked).
   False negatives are unmeasured.
   The rules were derived largely from published lists of older-model tells (for example `adamdunkels/deslop-text`), and current models have different habits.

## Principles and constraints

- **Pre-registration.**
  Criteria, prompts, skill, rules, and corpus selection are committed before the run that judges them.
  The run manifest must record a clean commit.
  The harness now computes the dirty flag excluding the run's own `evals/runs/<id>/` directory (fixed in commit `b7e8a5c`).
- **Dev and held-out splits.**
  All rule discovery, rule tuning, and skill iteration happen on a dev split.
  The held-out split is touched once per pre-registered run.
  Without this, new rules overfit the eval corpus.
- **Licensing.**
  Every human document needs a recorded license that allows use, study, and measurement.
  Prefer public domain, CC0, and CC BY.
  See "Workstream A" for repo storage rules.
- **No metric is the verdict alone.**
  Vale alert density stays as a diagnostic, never as the sole pass condition.
- **Findings, not just numbers.**
  Report effect sizes with confidence intervals, bootstrapped by document.
- **Clean cutover.**
  Do not keep dead rules, prompts, or scripts.
  Migrate every caller (repo convention).

## Workstreams

Dependencies: A before B and C. B and C before D. E runs alongside A to D.

### Workstream A: Source real human text

**Goal.**
Build a diverse, high-quality, openly licensed human-written corpus with a per-document license ledger.

**Selection criteria.**

- Provenance: published before November 2022 only, with a verifiable date, so no author could have used a chat model.
  Record the date source in the ledger.
  Don't include later text from any source.
- Quality tiers, tagged per document: `edited` (professional editing, institutional voice) and `unedited` (blogs, forum answers, personal essays).
  Include both, because the skill should not push edited prose toward an unedited ideal or the reverse.
- Genres, aligned with the current six corpus documents and extended: executive memo, SaaS or product launch post, engineering blog, industry commentary, nonprofit newsletter, research summary, plus journalism, legal or policy, how-to, personal essay, fiction, technical reference, academic writing, Q&A.
- Length: 600 to 1,500 words per document, whole documents or whole sections, never fragments.
  The rules measure document shape.
- Size targets (adjust after the power analysis in Workstream E): at least 40 documents per genre for the dev split, and at least 10 per genre held out.
- Dedupe and near-dedupe by hash and by shingle similarity.

**Candidate sources.**
License claims below are from memory or from search snippets unless marked verified.
Verify each before use and record the verification date.

| Source                                                                                        | Typical license                                                            | Fit                                                                                     | Status                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common Pile v0.1 (EleutherAI, `huggingface.co/common-pile`, `github.com/r-three/common-pile`) | Per-document, public domain or open (Open Knowledge Foundation definition) | Best single access path: curated, license-vetted metadata across many genres            | Existence and purpose verified from the EleutherAI blog (June 2025). Its authors state that automatic license detection is unreliable and that they rely on source metadata and manual curation, so keep the per-document license field and spot-check it. Sub-source list to be confirmed from the paper (arXiv 2506.05209) |
| Project Gutenberg, Standard Ebooks                                                            | Public domain (US)                                                         | Fiction, essays, long-form; style skews old                                             | Unverified                                                                                                                                                                                                                                                                                                                   |
| US federal government works (GovInfo, CRS reports, NIH, NASA, CDC, agency blogs)              | Public domain (US government works)                                        | Policy, explanatory, institutional writing; check for contractor or third-party content | Unverified                                                                                                                                                                                                                                                                                                                   |
| Court opinions (CourtListener, Caselaw Access Project)                                        | Public domain                                                              | Legal                                                                                   | Unverified                                                                                                                                                                                                                                                                                                                   |
| Wikipedia, Wikinews, Wikibooks                                                                | CC BY-SA or CC BY, varies                                                  | Encyclopedic and news; share-alike applies to adaptations                               | Unverified                                                                                                                                                                                                                                                                                                                   |
| arXiv abstracts and PLOS or PubMed Central open access (CC BY subset)                         | CC0 metadata, CC BY full text                                              | Academic                                                                                | Unverified                                                                                                                                                                                                                                                                                                                   |
| OpenStax and other CC BY textbooks                                                            | CC BY                                                                      | Explanatory and technical                                                               | Unverified                                                                                                                                                                                                                                                                                                                   |
| Stack Exchange dumps                                                                          | CC BY-SA                                                                   | Q&A and how-to, informal                                                                | Unverified                                                                                                                                                                                                                                                                                                                   |
| UK Hansard and other open-government text                                                     | Open Government Licence                                                    | Speech and policy                                                                       | Unverified                                                                                                                                                                                                                                                                                                                   |
| Global Voices, Wikimedia and Mozilla annual reports and posts                                 | CC BY                                                                      | News, nonprofit, institutional                                                          | Unverified                                                                                                                                                                                                                                                                                                                   |

**Exclude.**
Anything with an NC or ND license, anything with unclear terms (most commercial blogs, Medium, Substack, news sites), and anything scraped without a license field.

**Existing detection benchmarks (RAID, MAGE, M4, HC3).**

- RAID (code under MIT), MAGE (Apache-2.0 on the Hugging Face card), and others ship human and machine text across several domains.
  The license on the repo or card does not cover the underlying human text.
  Those texts come from sources such as news sites, forums, review sites, and Wikipedia, each with its own terms.
- Use them for method reference and for a cross-check on rule false-positive rates, not as the main corpus, unless each document's original license is confirmed.
- Their machine text comes from older models, so it does not show current quirks.

**Ledger.**
One row per document in a committed `evals/human-corpus/ledger.jsonl` (or equivalent), with: `id`, `source`, `url`, `retrieved_at`, `license` (SPDX id), `license_evidence_url`, `author_or_publisher`, `published_date`, `genre`, `quality_tier`, `words`, `sha256`, `split` (`dev` or `heldout`), and `attribution_text`.

**Repo storage policy (settled, see "Decisions").**
The repo is MIT.
Commit the ledger as plain `jsonl`, and the texts as immutable compressed archives, one per genre and split.
Decompress into a gitignored cache when needed.
Commit public domain, CC0, and CC BY text with attribution files.
Share-alike text (CC BY-SA) is allowed, used as-is, in its own archive with a license notice.
See "CC BY-SA handling" below.
Keep NC, ND, and unlicensed text out entirely.
Verify the built corpus by `sha256` against the ledger.

**CC BY-SA handling.**
Share-alike applies to "adapted material" that you share, not to using or aggregating a work unchanged.
The user's reading (use as-is, attribute, no modification) is right in principle.
Conditions to keep it true, from my reading of the license, which I haven't reviewed with a lawyer:

- **Store the text unaltered.**
  Whole documents, byte-for-byte after extraction.
  Trimming a section out of a longer work, normalizing whitespace or Markdown, or rewriting any wording counts as a change.
  Changes must be indicated, and a substantial edit could make the result adapted material, which would then have to be shared under the same license.
  Compressing the archive is a technical change and is fine.
- **Never feed human text to an arm for revision, and never publish revised human text.**
  Human texts are only used for measurement, judge anchors, and statistics.
  Numbers computed from the text (stylometric features, rule hit rates) are facts about it, not adaptations.
- **Keep derived briefs minimal.**
  The AI-input prompt uses the human document's title and topic.
  Don't commit a paraphrased summary of the document's content, because a close summary may be adapted material.
- **Attribute properly, per document.**
  The ledger carries creator, source link, license name and version, and a note of any change.
  Wikipedia and Stack Exchange need extra care: attribution by a link to the revision or post history, or to the post itself, plus author names where the site's terms require them.
  The license version depends on the date (older Wikipedia revisions and Stack Exchange posts use CC BY-SA 3.0, newer ones 4.0).
  Record the version per document. [INFERENCE: from memory; verify each site's current attribution terms.]
- **Segregate the archive.**
  Put CC BY-SA text in its own archive and directory with a `LICENSE` or `NOTICE` file that states its license and attribution.
  The MIT license of the repo code doesn't cover it.
- **Quote sparingly in reports.**
  Short excerpts with attribution only.
- **Skip it if unsure.**
  A document with unclear license version, unclear authorship, or a mixed-license page is dropped.

**Deliverables.**

- `scripts/human-corpus-fetch.ts` (or similar), the ledger, and a license-audit test that fails on a missing or disallowed license.
- A short `evals/human-corpus/README.md` with source list, per-source license evidence, and exclusions.

**Acceptance.**

- Every document passes the license audit.
- Genre and quality-tier counts meet the targets.
- A reviewer can rebuild the corpus byte-for-byte from the fetch script.

### Workstream B: Define "good" and redesign the eval

**Goal.**
Replace the Vale-centric verdict with measures that do not depend on the rules, anchored to real human text.

**Step 1: write the definition before touching data.**
Write `evals/GOOD.md` (or an OpenSpec spec) that states, in testable terms, what a successful revision is.
Starting point to refine with the user:

- It keeps every claim, number, name, quotation, and link (fidelity).
- It reads like a specific person wrote it for a specific reader.
- A skilled reader cannot reliably tell it from human writing of the same genre and quality tier.
- It sounds consistent with the document's genre (a legal memo should not become a blog post).
- It stays close to the original length and structure unless the structure is itself the problem.

**Step 2: new measures, all independent of Vale rules.**

1. **Blind human-likeness test.**
   A judge sees one human reference text and one revised text on the same topic, in random order, and picks the human one.
   The metric is how often the revised text is mistaken for the human one, compared with the unrevised AI text and with every baseline.
   The human anchor also calibrates the judge: if it cannot pick the human text from raw AI text, its scores are meaningless.
2. **Pairwise quality judging** with the rubric, as in v1, but with the human text as one of the candidates in a control pairing.
3. **Stylometric distance** to the human reference distribution for the genre.
   Use simple features computed on the human corpus: sentence-length mean and variance, paragraph-length distribution, type-token ratio, function-word frequencies, punctuation rates, list and heading density.
   Report the distance of each arm's output to the human distribution, versus the input.
   This is a second, cheap, deterministic signal.
   It can be gamed in principle, so keep it beside the judged measures.
4. **Fidelity.**
   Keep the judge's 0 to 5 score.
   Add a deterministic check: extract numbers, URLs, hashtags, and quoted strings from the source and the output, and report what was lost or added.
5. **Retention and edit size** as now.
6. **Vale alert density**, as a diagnostic only, plus a held-out rule check.

**Step 3: judges.**

- Use at least two judge families, one of them not Anthropic, all through `pi`.
  This reverses the v1 non-goal, so record the reversal in the spec.
- No human rater panel (the user declined).
  The user spot-checks a sample of judged pairs, and the report states that no human agreement figure exists.
  Because of that, lean harder on the human-anchor calibration and on cross-judge agreement.
- Report judge agreement (Cohen's kappa or similar) and position-bias checks (swap A and B).

**Step 4: AI inputs.**

- Generate the AI documents from current models, with realistic prompts, not by authoring them to trip rules.
  Use at least three families, such as Claude, GPT, Gemini, plus one open-weight model.
  Record model id, date, and prompt.
- Make each AI document topic-matched to a human document: prompt from the human document's title and a short brief.
  This gives a paired design with a human reference for every topic.
- Include several prompt styles: plain request, "write like a professional", and a request with the house guidance present.
- Keep a separate fidelity-safe set: inputs where no rule can be cleared only by deleting content.
  The v1 corpus mixed unfixable traps with fixable text, which inflates density differences.

**Step 5: pre-register run 3.**
In one committed document, fix the hypothesis, the primary metric (recommend the blind human-likeness rate), the thresholds, the arms, the held-out split, the statistics, and the budget.
Run a power analysis from dev-split variance before choosing sizes.

**Deliverables.**

- `GOOD.md`, a new spec delta for the eval capability, and the pre-registration document.
- Harness changes (see Workstream E).

**Acceptance.**

- Before any paid run: the human-likeness judge picks the human text over raw AI text well above chance on the dev split.
  If it does not, the judge or prompt is not usable.

### Workstream C: Audit existing rules and discover new ones

**Goal.**
Decide, with data, which rules to keep, loosen, downgrade, or retire, and which new rules to add.
Do the work on the dev split only.

**Step 1: false-positive audit (no API cost).**

- Run all 48 rules over every human dev document.
- Per rule and per genre and quality tier, report alerts per 1,000 words, the number of documents with at least one hit, and a sample of hits.
- Pay special attention to: the nine `scope: raw` shape rules (`AnaphoraRun`, `BoldFirstBullet`, `ExclamationDensity`, `HedgingDensity`, `ListicleInProse`, `SentenceRhythm`, `StaccatoFragments`, `WhOpener`, `WordEcho`), the four Tengo scripts, `EmDash*`, `CurlyQuotes`/`UnicodeDecoration` (fiction and legal text use curly quotes legitimately), `VagueAttribution`, `ScareQuotes`, `MarketingAdjectives`, and `AIBuzzWords`.
- Flag any rule whose human-text hit rate is high, or whose level is `error` or `warning` with any meaningful hit rate.

**Step 2: recall and lift audit.**

- Run the rules on the AI dev documents (all models and prompt styles).
- Per rule: hit rate on AI text, hit rate on human text, and the lift (ratio or log-odds).
  Also report per model, because tells differ by model and by version.
- A rule with near-zero lift is noise.
  A rule that fires only on one old-model habit may be retired.

**Step 3: discover candidate tells.**

- Lexical: n-gram and word log-odds, AI versus human, with an informative prior (Monroe et al. style), per genre and per model.
- Structural: paragraph and sentence length distribution, opener patterns, list and heading use, em-dash and colon use, contrastive framing ("not X, but Y"), rule-of-three, summary-sentence endings, rhetorical-question use, hedging, stock transitions.
  These are hypotheses from past experience, not findings.
  Confirm each on data.
- Cluster the top-lift candidates by pattern and write each up with 5 to 10 real examples.
- Check each candidate against the existing rules to avoid duplicates.

**Step 4: decision rules (set before looking at results).**

Add a new rule only when all hold:

- lift on AI text above a threshold you fix in advance (for example at least 5 times the human rate);
- false-positive rate on the human dev set below a threshold (for example under 0.5 hits per 1,000 words, and zero for `error` level);
- support across at least 3 genres and at least 2 model families;
- not already covered by an existing rule;
- it can be expressed in Vale (existence, substitution, occurrence, or script) with a clear message and fix.

Retire or demote an existing rule when its human false-positive rate exceeds the threshold, or its lift is near 1 across models.

**Step 5: implement under the repo's rule workflow.**
Follow `CONTRIBUTING.md` "Changing or adding a rule", with the new package path `plugin/skills/deslop-writing/Deslop/styles/Deslop/`:

1. Edit or add the `.yml` rule.
2. Add or update `tests/fixtures/rules/<Rule>.md` so the rule fires at least three times.
   Add a negative fixture drawn from the human corpus (short, license-safe excerpt or a paraphrase).
3. `mise run expected:update`, then review the diff by hand.
4. `mise run readme:update` and `mise run checks:update` when a level or message changed.
5. `mise run test`, `mise run lint:prose`, `mise run lint:md`.

Commit type matters for release-please.
Adding rules is a feature.
Disabling or removing a rule changes what consumers see, so treat it as a breaking change and use the matching commit type.

**Deliverables.**

- `evals/rule-audit/` with the audit script, a report (per-rule table with FP rate, lift, per-model lift, verdict), and the candidate-tell write-ups.
- A proposed rule changes list with the decision-rule evidence.
- The rule changes themselves, with fixtures and tests.

**Acceptance.**

- Every one of the 48 rules has a recorded verdict and the evidence behind it.
- The clean-prose fixtures and the human dev set show no new false-positive regressions.
- New rules meet the pre-set thresholds on dev, and are then confirmed once on held-out data.

### Workstream D: Improve the skill

Start only after A, B, and C have produced a defensible eval and a revised rule set.
All hypotheses below are untested.
Evaluate each as a separate arm on the dev split.

**Principle.**
Do not copy rule content into `SKILL.md`.
Vale and the generated catalog own the "what".
The skill owns the "how to revise" and the judgment Vale can't make.

**Hypotheses.**

1. **Class-aware triage.**
   Generate a class for each check from the rule YAML (`extends` type and scope), and show it in `references/checks.md`.
   For example: substitution rules (`BusinessJargon`, `CopulaAvoidance`, `CurlyQuotes`) get "apply the listed replacement"; density and shape rules get "rebuild the paragraph"; semantic rules get "decide, and record a reason".
   This takes judgment away from where a machine already decides.
   Check whether Vale's JSON `Action` field carries usable replacements, and whether `vale fix` exists in the pinned version (3.26.0); [INFERENCE] I did not verify either.
2. **Bounded keeps.**
   Limit kept alerts to cases where the fix would remove or invent a fact.
   Anything else must be revised.
3. **Use the human reference per genre.**
   Derive a few genre-level positive targets from the human corpus statistics (for example, typical sentence-length spread) and cite them in a reference file.
   Test whether this helps without duplicating rules, and whether it overfits.
4. **Where the rewrite effort goes.**
   Run 2 shows the whole-document rewrite already ties the best baseline on judged quality.
   Test a stronger first pass (reader, purpose, specifics before any Vale run) against the current one.
5. **Pass policy.**
   Test a mandatory second pass, a different pass cap, and Vale-free inference mode.

**Ablation arms (all on the dev split).**

- `plugin-v1` (current).
- `plugin-v1-no-vale` (same skill without Vale, to measure what Vale adds).
- `plugin-v2` variants for the hypotheses above, one change per arm.
- The two baseline skills and `control`, unchanged.

**Process.**
Iterate cheaply on the dev split with one repeat and a small document sample.
Freeze one candidate.
Run the pre-registered held-out run once.

**Deliverables.**

- Updated `plugin/skills/deslop-writing/SKILL.md` and references, kept under 500 lines, passing `npx skills-ref validate`.
- The ablation results in a committed dev report.

**Acceptance.**

- The frozen candidate beats `plugin-v1` on the pre-registered primary metric on dev, with fidelity within the pre-set margin.

### Workstream E: Harness changes

All in `scripts/eval-*.ts`, `evals/prompts/`, and `tests/evals.test.ts`.

- Corpus loader that reads the human ledger and the generated AI documents, with the dev and held-out split enforced in code (the held-out split must require an explicit flag).
- New runner stage to generate AI inputs from current models, recording model id, date, prompt, and cost.
- New judging stages: blind human-likeness, cross-family judge, position swap, control pairings with the human anchor.
- Deterministic stylometric and fidelity-extraction metrics in `eval-lib.ts`, with unit tests (follow the repo convention: test behavior and invariants, not wiring).
- Power analysis script that reads dev results and outputs the sample sizes for the pre-registration.
- Report changes: per-genre breakdown, confidence intervals, judge agreement, the human-anchor calibration, and a section stating what each metric can and cannot show.
- Keep runs 1 and 2 immutable and verifiable (`mise run eval:verify`).
  Decide whether `REPORT.md` shows only the latest run or a registry of runs.
- Prompts remain snapshotted per run (already implemented).
- Cost: run 2 cost $17.26 for 72 attempts and 108 votes. A design with 8 genres by 10 held-out documents, 5 arms, 1 repeat is about 400 attempts, roughly $55 to $75 at those per-attempt costs, before extra judge families and generation.
  This is an extrapolation, so re-estimate from dev-run costs.
- **Migrate the harness from `claude -p` to `pi`.**
  What I verified in a one-off probe (`pi -p --mode json --no-session --no-skills --no-context-files --no-extensions --tools read --model anthropic/claude-haiku-4-5`, key through `op run`):
  - Pi reads `ANTHROPIC_API_KEY` and other provider keys from the environment, and `--model provider/id` switches model.
  - `--mode json` streams events that carry per-message `usage` with token counts and a computed `cost.total`.
    The budget guard can sum these.
    The event also marks whether cost came from the provider (`totalFromProvider`), so check that flag.
  - `--skill <path>` loads a skill, `--no-skills` and `--no-context-files` isolate a run, and `--tools` and `--exclude-tools` restrict tools by name.
    What I did not verify, and the next session must test before committing to the migration:
  - Pi has no per-command shell permission like `Bash(vale *)`.
    The v1 plugin arm and the Vale arm relied on it.
    Options: an extension that wraps the bash tool and rejects commands other than `vale`, a restricted `PATH` in the arm's shell, or a custom `vale` tool.
    Whichever you pick, add a test that a non-`vale` command is refused.
  - Skill activation detection.
    Claude Code logs a `Skill` tool call.
    Pi loads a skill as files, so detection probably means "the agent read `SKILL.md`", which is weaker.
    Decide how to define and test "skill activated".
  - Structured judge output.
    The v1 judge used `--json-schema`.
    Pi has no such flag in the help, so use prompt-level JSON with validation and one retry, as the v1 fallback did.
  - How pi's default system prompt and tool set change baseline behavior.
    Run 3 re-runs every arm anyway, so run 1 and run 2 numbers are not comparable.
    Record the pi version, system prompt, and tool list in the manifest.
  - Thinking level: set it explicitly per role (`--thinking`) and record it.
  - CI: pi should install and run non-interactively (`pi -p`), but CI should still run only `eval:verify`, with no key.
    Keep `eval-measure.ts` and the report generator, which work on stored `output.md` files and do not depend on the harness.
    Preflight probes (auth, model resolution, skill isolation, tool restriction, structured output) need to be rewritten for pi, including recording the resolved model id and the auth method.

### Workstream F: Release and docs

- Update `README.md` evidence section and `evals/README.md` to describe the new method and the corpus ledger.
- Update `CONTRIBUTING.md` for the rule audit workflow.
- Confirm release-please bumps all manifests (`plugin/plugin.json`, `plugin/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`); `tests/plugin.test.ts` guards that they match `package.json`.

## Work breakdown (suggested OpenSpec changes)

| Change                   | Scope                                                           | Depends on |
| ------------------------ | --------------------------------------------------------------- | ---------- |
| `human-reference-corpus` | Workstream A                                                    | none       |
| `eval-v2-human-anchored` | Workstreams B and E (definition, harness, pre-registration doc) | A          |
| `rule-audit-v2`          | Workstream C                                                    | A          |
| `skill-v2`               | Workstream D                                                    | B, C       |

Use the existing `spec-driven` schema.
Cross-change ordering is not supported by OpenSpec 1.16, so record dependencies in each `proposal.md` and in this table. (A global `spec-driven-deps` schema exists on the user's machine for this purpose.
Check `${XDG_DATA_HOME:-~/.local/share}/openspec/schemas/` before relying on it.)

## Sequencing and cost

1. **Free, no API (days):** Workstream A sourcing and ledger; Workstream C steps 1 and 3 on human text only.
2. **Small API spend (about $5 to $20):** generate the AI dev documents; Workstream C steps 2 and 3 with model comparisons; judge calibration from Workstream B.
3. **Medium spend (about $20 to $60):** dev-split arm ablations for Workstream D.
4. **One large, pre-registered run (about $55 to $100 plus second-provider judging):** held-out run 3.
5. Publish the report, whatever the verdict.

Estimates are extrapolations from run 2, not quotes.

## Operational notes for the next session

- Tools: run `mise install` and `mise run setup` first.
  Pinned tools are in `mise.toml` (Bun 1.4.0, Vale 3.26.0, rumdl, lefthook, OpenSpec 1.16.0).
- The `claude` CLI lives in `~/.local/bin`; add it to `PATH` in non-login shells.
  Homebrew tools are in `/opt/homebrew/bin`, including `op` (1Password CLI).
  Never overwrite `PATH` in a persistent shell; a previous session did and lost `op`.
- Paid commands: pass the API key for one command only: `ANTHROPIC_API_KEY=op://automation/vale-deslop-anthropic-api-key/credential op run -- <command>`.
  Never export it, never store it in a file or in GitHub.
  A set `ANTHROPIC_API_KEY` replaces the subscription login for interactive Claude Code.
- Always ask the user before any paid run, and state the estimate.
  OpenRouter runs use `OPENROUTER_API_KEY` from the shell environment, with no `op run` wrapper.
  The Anthropic key via `op run` still applies only to the existing Claude Code harness (runs 1 and 2).
- Preflight: `bun run scripts/eval-preflight.ts` (also under `op run`) writes `evals/runs/.preflight.json`, which `eval-run.ts` requires.
  It records resolved model ids and the auth method.
- Full-run recipe used for run 2: `mise run eval -- --arms control,skill-humanizer,skill-stephenturner,plugin-deslop-writing --treatment plugin-deslop-writing --repeats 3 --judge-votes 3 --budget 70`, from a clean tree.
  The run takes about 50 minutes.
  Do not edit tracked files while it runs.
- Run artifacts live in `evals/runs/<id>/`; `mise run eval:report` and `mise run eval:verify` regenerate and check `evals/REPORT.md`.
- Commits run lefthook: rumdl (autofix), vale, then `bun test`.
  `rumdl` reflows Markdown to one sentence per line.
  Generated Markdown (such as `references/checks.md`) uses fenced blocks so reflow does not alter it.
- The OpenSpec skills under `.agents`, `.claude`, and `.omp` are git-ignored and regenerated by `mise run openspec:init`.
- Outside the repo directory, mise shims lose Node and Bun.
  Use `mise x -- <cmd>` from the repo, or run `skills` and `npx` commands with the repo as the working directory.
- File map:
  - Rules: `plugin/skills/deslop-writing/Deslop/styles/Deslop/*.yml` and `.../config/scripts/*.tengo`
  - Skill: `plugin/skills/deslop-writing/SKILL.md`, `references/checks.md` (generated), `references/install-vale.md`, `deslop.vale.ini`
  - Eval harness: `scripts/eval-{run,lib,measure,report,preflight,vendor-skills}.ts`
  - Prompts: `evals/prompts/`; corpus (v1): `evals/corpus/`; baselines: `evals/skills/`
  - Rule tests: `tests/fixtures/rules/`, `tests/fixtures/clean/`, `tests/expected-alerts.json`

## Decisions

Settled by the user:

1. **Human text storage:** commit the texts, as compressed archives, unless the size turns out large.
   Scale estimate: the v1 corpus is 6 documents, about 6,000 words, 48 KB on disk, and `.git` is about 3 MB today.
   At about 6.7 bytes per word, 12 genres by 50 dev documents plus 12 by 10 held-out, at 1,000 words each, is about 720 documents and 5 MB raw, roughly 1.5 to 2 MB compressed.
   Even 10 times that stays under 20 MB compressed, so no Git LFS is needed.
   Keep one archive per genre and split, treat each archive as immutable once pre-registered (rewrites bloat history), and commit the ledger as plain `jsonl` so diffs stay readable.
   The fetch script reads only selected documents, never whole source dumps.
   Re-check the license rule in Workstream A before committing share-alike text.
2. **Harness and providers:** move the whole eval to the `pi` coding agent (installed at `/opt/homebrew/bin/pi`, v1.5.0), for every model, instead of Claude Code for writers and a second harness for other providers.
   See "Workstream E".
3. **Human raters:** none.
   The user spot-checks samples, and the report says so.

Also settled by the user (latest):

4. **Providers and keys:** use OpenRouter through `pi`, with a cheaper capable model.
   The user named MiMo-V2.6-Pro and GLM-5.3-Flash.
   `pi --list-models` shows `xiaomi/mimo-v2.6-pro` (1.0M context), `xiaomi/mimo-v2.6-flash`, and the aliases `~z-ai/glm-flash-latest` and `~z-ai/glm-latest`.
   I did not find an exact `glm-5.3-flash` id, so confirm the id and its price with `pi --list-models` before use.
   The key is `OPENROUTER_API_KEY`, already set in the user's shell and defined in `~/.env` (generated by 1Password).
   Use it from the environment.
   Don't print it, copy it, or write it anywhere.
5. **Budget:** keep total spend under $50 if possible, covering dev iteration, AI-input generation, the held-out run, and judging.
6. **Rule changes:** breaking changes are acceptable.
   That means modifying, demoting, or removing Vale rules.
   Use the matching conventional-commit type so release-please bumps the major version.
7. **"Human" means pre-2022 text only.**
   Use text published before November 2022 (before ChatGPT's public release), with a verifiable date.
   Drop the "trusted later editorial source" option.
   Record the era mismatch as a limitation, and weight the more modern pre-2022 sources (2015 to 2022 blogs, government and agency writing, Wikipedia revisions dated before the cutoff, Stack Exchange posts before the cutoff) over Project Gutenberg.
   For Wikipedia and Stack Exchange, pin to a dump or revision dated before the cutoff.
8. **CC BY-SA text is allowed**, used as-is with attribution.
   See "CC BY-SA handling" in Workstream A for the conditions that keep it safe.
9. **Model decisions are deferred** to the new session: writer, judge, and AI-input generator model ids, prices, and roles.
   See the budget plan below for the constraints.

Still open (not blocking the handoff):

10. **Primary metric and pass thresholds** for run 3.
    A concrete proposal is in "Proposed run 3 verdict" below.
    The user approves or changes it after the dev-split calibration shows what the measurements look like.

### Proposed run 3 verdict (default, to confirm or change)

Context: run 3 needs a written definition of "the skill is better", fixed before the run, so we can't adjust it after seeing results.
Proposal:

- **Primary metric.**
  The human-pick rate: in blind pairs of one real human document and one revised document on the same topic, how often the judge picks the revised one as the human-written one.
  Higher means the revision is harder to tell from human writing.
  Compute it per arm, over all held-out documents, with both judges and with A/B positions swapped.
- **The skill passes when all three hold.**
  1. Its human-pick rate beats the best baseline skill by at least 10 percentage points, and the 95% bootstrap interval (resampling documents) excludes zero.
  2. Mean fidelity is no lower than the best baseline's mean fidelity minus 0.5 (the same margin as v1's C3).
  3. Mean retention is at least 0.85 (the same as v1's C2).
- **Reported, but not part of the verdict:** pairwise judge win rate against each baseline, stylometric distance to human text, Vale alert density, per-genre breakdown, per-judge results.
- **Why 10 points.**
  A rough illustration, not a power analysis: with 120 held-out documents and a pick rate near 30%, one arm's rate has a standard error of about 4 to 5 points.
  A paired difference of 10 points would then be about 1.8 standard errors, borderline.
  The new session should run the real power analysis on dev-split variance and adjust the document count or the margin before pre-registering.
- **What the user decides, when asked.** (a) Is "fooling a blind judge into picking it as human" the right primary measure, or would they rather rank on blind quality preference?
  (b) What gap over the best baseline would make shipping the skill worthwhile: 5, 10, or 15 points?
  (c) Is the fidelity floor (minus 0.5) acceptable, or should it be stricter?

### Budget plan under $50 (proposal, unverified)

Run 2 cost $17.26 on Sonnet 5.5 and Opus 5.5, for 72 attempts and 108 votes.
Cheaper OpenRouter models should cost a fraction per call, but I haven't checked prices, so get them from `pi --list-models` or the OpenRouter model pages first.
Suggested split, to adjust once prices are known:

| Stage                                                      | Share     | Notes                                                                                                |
| ---------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Judge calibration on dev (human anchor vs raw AI text)     | about 5%  | Proves a cheap judge can tell human from raw AI text. If it can't, switch judge before spending more |
| AI-input generation (3 or more families, dev and held-out) | about 15% | Use the cheap models plus one or two others for variety                                              |
| Dev-split arm iteration (one repeat, small sample)         | about 30% | The `plugin-v1`, no-Vale, and v2 variants                                                            |
| Held-out run 3 (all arms, pre-registered)                  | about 40% | Two judges, position swap                                                                            |
| Reserve                                                    | about 10% | Retries and the second pass on any failed attempt                                                    |

Levers if the estimate runs over: fewer held-out documents per genre, one repeat instead of three, one judge on the dev split, a smaller baseline set, and `--budget` caps (the harness already enforces one).
A cheap writer model changes how every arm behaves, so run 3 stays a fresh comparison and is not comparable with runs 1 and 2.

## Risks

- **License uncertainty.**
  Source metadata can be wrong.
  Spot-check licenses, record evidence, and drop a document at the first doubt.
- **Era mismatch.**
  Pre-2022 human text may differ from how people write now, and Project Gutenberg skews old.
  Weight modern sources and report results per era.
- **Judge self-preference.**
  Mitigate with the human anchor, a cross-family judge, and swap tests.
- **Overfitting new rules.**
  Mitigate with the dev and held-out split and pre-set decision thresholds.
- **A skill that wins on a new metric and loses on the user's real documents.**
  Keep a small set of the user's own writing as an informal qualitative check, never as a scored benchmark.
- **Scope creep.**
  The four changes can ship separately, and each stops with a useful result: a licensed corpus, an audited rule set, a better eval, a better skill.
