# Deslop eval report

Treatment arm `plugin-deslop-writing` vs. agent deslop skills, on a pre-registered corpus with a pre-registered verdict. See `evals/README.md` for how to reproduce this report.

## Run metadata

- Run id: `20261107-210836-b7e8a5c`
- Created: 2026-11-07T21:08:36.618Z
- Git: `b7e8a5c`
- Vale: vale version 3.26.0, 20 union runs per measurement
- Package zip sha256: `38a93a60429224c5a25a732225786f4547627e5e6b51c7b54e6be2efba990eac`
- Treatment arm: `plugin-deslop-writing`
- Actor model: `claude-sonnet-5-5`, judge model: `claude-opus-5-5`
- Auth method: `api_key`
- skill-humanizer: [`blader/humanizer`](https://github.com/blader/humanizer) @ `e2e92e7b4b8229253ed5c8e81dc65463fdeddda5`
- skill-stephenturner: [`stephenturner/skill-deslop`](https://github.com/stephenturner/skill-deslop) @ `a906154bef375d9d49ed2ad7da13b2db16f0d3d2`
- plugin-deslop-writing: [`dnunez24/vale-deslop`](https://github.com/dnunez24/vale-deslop) @ `b7e8a5c`
- Repeats: 3, judge votes: 3, budget: $70
- Total spend: $17.26

## Method

4 arms edit the same corpus document with the same shared task text. Only the intervention differs:

| Arm | Intervention |
| --- | --- |
| `control` | none (bare model) |
| `skill-humanizer` | [`blader/humanizer`](https://github.com/blader/humanizer), skill `humanizer` |
| `skill-stephenturner` | [`stephenturner/skill-deslop`](https://github.com/stephenturner/skill-deslop), skill `deslop` |
| `plugin-deslop-writing` | the committed `plugin/skills/deslop-writing` skill, which runs Vale as advice (at most two passes) |

Shared task text ([`runs/20261107-210836-b7e8a5c/prompts/shared.md`](runs/20261107-210836-b7e8a5c/prompts/shared.md), the copy this run used), identical across every arm:

> You are revising a single Markdown document: deslop.md, in your current working directory.
>
> Rewrite its prose so it no longer reads as AI-generated. Save the rewrite to rewrite.md. Leave
> deslop.md unchanged. Do not create any other file.
>
> Hard constraints:
> - Preserve every factual claim, number, name, quotation, and link in the source. Add no new facts.
> - Preserve the heading structure and all list, table, and code-block markup. Rewriting the text
>   inside those blocks is fine. Deleting a section is not.
> - Keep the document within 15% of its original word count.
> - Do not add HTML comments, linter-suppression markers, or configuration files.
>
> When rewrite.md is saved, reply with the single word DONE.

Every document is measured before and after with the same fixed Vale configuration — not the repo's own `.vale.ini`, and not any arm's scratch config:

```ini
StylesPath = <repo>/plugin/skills/deslop-writing/Deslop/styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Deslop
```

Metric formulas:

- `alertsPer1k = alerts / words * 1000`
- `reduction = (beforeAlertsPer1k - afterAlertsPer1k) / beforeAlertsPer1k`
- `rulesFiring` = distinct checks in the after document
- `rulesCleared` = size of (before check set minus after check set)
- `regressions` = sum over checks of max(0, afterCount - beforeCount)
- `retention = afterWords / beforeWords`

A run with `retention < 0.70` is flagged `over-deletion`: it counts as `ok` but is excluded from the headline means below (deleting content is the cheapest way to win an alert-density metric, so it must cost the arm its result rather than earn it one).

## Headline results

| Arm | Mean alerts/1k (min–max) | Mean reduction | Mean rules firing | Mean regressions | Mean retention | Judge win rate vs. counterpart | Mean rubric | Mean fidelity | Mean cost | Mean duration | ok/disqualified/failed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| control (bare model) | 19.70 (9.72–32.55) | 70% | 13.11 | 0.28 | 0.90 | n/a | n/a | n/a | $0.05 | 14180ms | 18/0/0 |
| skill-humanizer (blader/humanizer) | 9.83 (2.14–15.26) | 85% | 7.83 | 0.50 | 0.96 | 33% | 7.13 | 4.54 | $0.19 | 33397ms | 18/0/0 |
| skill-stephenturner (stephenturner/skill-deslop) | 5.60 (1.02–10.03) | 91% | 4.67 | 0.17 | 0.94 | 44% | 7.59 | 3.87 | $0.14 | 29391ms | 18/0/0 |
| plugin-deslop-writing (this plugin's skill) | 6.96 (2.09–12.09) | 90% | 5.50 | 0.33 | 0.93 | 61% | 7.60 | 4.41 | $0.16 | 34439ms | 18/0/0 |

"Judge win rate vs. counterpart": for `plugin-deslop-writing`, its win rate across every judged pair against both baselines; for each skill arm, its win rate against `plugin-deslop-writing` specifically. `control` is never judged (it has no plugin-deslop-writing pairing) and shows n/a.

## Per-document results

### engineering-blog

[before](corpus/engineering-blog.md) — 949 words, 63 alerts, 34 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 14.38 | 0.88 | 3/3 |
| skill-humanizer (blader/humanizer) | 3.32 | 0.96 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 1.47 | 0.97 | 3/3 |
| plugin-deslop-writing (this plugin's skill) | 2.61 | 0.95 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's data-driven world, every distributed system eventually has to answer the same question: what happens when producers outpace consumers. Rivergate Queue is our answer, and this post walks through how it works. We're excited to anno…
- **control (bare model)** ([after](runs/20261107-210836-b7e8a5c/engineering-blog/control/r1/output.md)): Every distributed system eventually has to answer one question: what happens when producers outpace consumers. Rivergate Queue is our answer, and this post walks through how it works. Rivergate Queue is now generally available after a year …
- **skill-humanizer (blader/humanizer)** ([after](runs/20261107-210836-b7e8a5c/engineering-blog/skill-humanizer/r1/output.md)): Every distributed system eventually has to decide what happens when producers send messages faster than consumers can process them. Rivergate Queue is how we decided to handle it, and this post explains how it works. After a year of interna…
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20261107-210836-b7e8a5c/engineering-blog/skill-stephenturner/r1/output.md)): Sooner or later, every distributed system has to decide what happens when producers send messages faster than consumers can process them. Rivergate Queue is how we answered that question, and after a year of internal use it is now generally…
- **plugin-deslop-writing (this plugin's skill)** ([after](runs/20261107-210836-b7e8a5c/engineering-blog/plugin-deslop-writing/r1/output.md)): Rivergate Queue is now generally available, after a year of internal use. It's our answer to a question every distributed system eventually faces: what happens when producers outpace consumers? This post explains how it works.

### exec-memo

[before](corpus/exec-memo.md) — 943 words, 63 alerts, 31 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 19.89 | 0.91 | 3/3 |
| skill-humanizer (blader/humanizer) | 10.62 | 0.93 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 6.53 | 0.92 | 3/3 |
| plugin-deslop-writing (this plugin's skill) | 6.85 | 0.93 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's competitive landscape, every quarter without a clear bet is a quarter we lose to faster-moving rivals. I'm thrilled to present our Q3 priorities after two weeks of planning sessions across every team.
- **control (bare model)** ([after](runs/20261107-210836-b7e8a5c/exec-memo/control/r1/output.md)): Every quarter without a clear bet is a quarter we lose to faster-moving rivals. I'm glad to present our Q3 priorities, which came out of two weeks of planning sessions across every team.
- **skill-humanizer (blader/humanizer)** ([after](runs/20261107-210836-b7e8a5c/exec-memo/skill-humanizer/r1/output.md)): Every quarter we spend without a clear bet is a quarter that faster-moving rivals use against us. After two weeks of planning sessions with every team, here are our Q3 priorities.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20261107-210836-b7e8a5c/exec-memo/skill-stephenturner/r1/output.md)): Each quarter we go without a clear bet, faster rivals take ground from us. After two weeks of planning sessions with every team, here are our Q3 priorities.
- **plugin-deslop-writing (this plugin's skill)** ([after](runs/20261107-210836-b7e8a5c/exec-memo/plugin-deslop-writing/r1/output.md)): We're making three bets in Q3, and this memo explains them. They came out of two weeks of planning sessions with every team. Each quarter we spend without a clear bet is a quarter that faster rivals take from us.

### industry-thought-piece

[before](corpus/industry-thought-piece.md) — 1144 words, 64 alerts, 32 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 19.69 | 0.91 | 3/3 |
| skill-humanizer (blader/humanizer) | 10.45 | 0.98 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 5.31 | 0.93 | 3/3 |
| plugin-deslop-writing (this plugin's skill) | 7.43 | 0.90 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's rapidly evolving business landscape, the conversation about artificial intelligence has shifted from whether to adopt it to how fast a company can claim it already has. Have you ever wondered why every company's AI strategy sound…
- **control (bare model)** ([after](runs/20261107-210836-b7e8a5c/industry-thought-piece/control/r1/output.md)): The conversation about artificial intelligence used to be about whether to adopt it. Now it is about how fast a company can claim it already has. Why does every company's AI strategy sound identical, word for word, quarter after quarter?
- **skill-humanizer (blader/humanizer)** ([after](runs/20261107-210836-b7e8a5c/industry-thought-piece/skill-humanizer/r1/output.md)): Companies used to argue about whether to adopt artificial intelligence. Now they argue about how fast they can say they already have. That may explain why every company's AI strategy sounds the same, word for word, quarter after quarter.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20261107-210836-b7e8a5c/industry-thought-piece/skill-stephenturner/r1/output.md)): Executives used to argue about whether to adopt artificial intelligence. Now they argue about how fast they can say they already have. Read a few quarterly reports in a row and you'll notice that the AI strategies match, sometimes word for …
- **plugin-deslop-writing (this plugin's skill)** ([after](runs/20261107-210836-b7e8a5c/industry-thought-piece/plugin-deslop-writing/r1/output.md)): Companies no longer debate whether to adopt artificial intelligence. They race to say they already have. That's why so many AI strategies read the same, word for word, quarter after quarter.

### nonprofit-newsletter

[before](corpus/nonprofit-newsletter.md) — 963 words, 63 alerts, 31 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 18.43 | 0.88 | 3/3 |
| skill-humanizer (blader/humanizer) | 10.87 | 0.96 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 7.90 | 0.97 | 3/3 |
| plugin-deslop-writing (this plugin's skill) | 9.26 | 0.93 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's fragile world, every well we drill changes a family's entire future. We're thrilled to share that Clearwater Relief crossed a major milestone this season: 500 wells across four countries, serving roughly 120,000 people.
- **control (bare model)** ([after](runs/20261107-210836-b7e8a5c/nonprofit-newsletter/control/r1/output.md)): Every well we drill changes a family's future. This season Clearwater Relief reached 500 wells across four countries, serving roughly 120,000 people.
- **skill-humanizer (blader/humanizer)** ([after](runs/20261107-210836-b7e8a5c/nonprofit-newsletter/skill-humanizer/r1/output.md)): Every well we drill changes what's possible for a family. This season Clearwater Relief reached 500 wells across four countries, serving roughly 120,000 people, and we're glad to be able to tell you about it.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20261107-210836-b7e8a5c/nonprofit-newsletter/skill-stephenturner/r1/output.md)): This season Clearwater Relief finished its 500th well. Those wells are spread across four countries and serve roughly 120,000 people, and we wanted you to hear the number from us first.
- **plugin-deslop-writing (this plugin's skill)** ([after](runs/20261107-210836-b7e8a5c/nonprofit-newsletter/plugin-deslop-writing/r1/output.md)): This season Clearwater Relief finished its 500th well. Those wells now span four countries and serve roughly 120,000 people, and each one changes what the next few decades look like for the families who use it.

### research-summary

[before](corpus/research-summary.md) — 1114 words, 71 alerts, 37 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 18.75 | 0.91 | 3/3 |
| skill-humanizer (blader/humanizer) | 9.67 | 0.99 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 6.56 | 0.91 | 3/3 |
| plugin-deslop-writing (this plugin's skill) | 4.98 | 0.96 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's fast-paced world, sleep is often the first thing people cut when life gets busy. We're excited to share the results of the Ridgeway Study, a three-year investigation into how sleep timing affects memory consolidation in adults ag…
- **control (bare model)** ([after](runs/20261107-210836-b7e8a5c/research-summary/control/r1/output.md)): Sleep is often the first thing people cut when life gets busy. Here are the results of the Ridgeway Study, a three-year investigation into how sleep timing affects memory consolidation in adults aged 40 to 65.
- **skill-humanizer (blader/humanizer)** ([after](runs/20261107-210836-b7e8a5c/research-summary/skill-humanizer/r1/output.md)): When life gets busy, sleep is often the first thing people cut. This summary covers the results of the Ridgeway Study, a three-year investigation into how sleep timing affects memory consolidation in adults aged 40 to 65.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20261107-210836-b7e8a5c/research-summary/skill-stephenturner/r1/output.md)): When life gets busy, sleep is often the first thing people cut. The Ridgeway Study spent three years examining how sleep timing affects memory consolidation in adults aged 40 to 65, and this summary reports what the team found.
- **plugin-deslop-writing (this plugin's skill)** ([after](runs/20261107-210836-b7e8a5c/research-summary/plugin-deslop-writing/r1/output.md)): When life gets busy, rest is often the first thing people cut. The Ridgeway Study spent three years asking how the timing of sleep affects memory consolidation in adults aged 40 to 65. Here is what it found.

### saas-launch-post

[before](corpus/saas-launch-post.md) — 862 words, 71 alerts, 36 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 27.05 | 0.89 | 3/3 |
| skill-humanizer (blader/humanizer) | 14.05 | 0.96 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 5.83 | 0.92 | 3/3 |
| plugin-deslop-writing (this plugin's skill) | 10.64 | 0.91 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's data-driven world, teams need tools that keep pace with how work actually happens. We're excited to announce Fluxframe Orbit, the newest addition to the Fluxframe platform, built for the 40,000 teams who already trust us to keep …
- **control (bare model)** ([after](runs/20261107-210836-b7e8a5c/saas-launch-post/control/r1/output.md)): Teams need tools that keep pace with how work actually happens. Today we're announcing Fluxframe Orbit, the newest addition to the Fluxframe platform. It's built for the 40,000 teams who already trust us to keep their approvals moving.
- **skill-humanizer (blader/humanizer)** ([after](runs/20261107-210836-b7e8a5c/saas-launch-post/skill-humanizer/r1/output.md)): Teams need tools that match how their work really gets done. Today we're announcing Fluxframe Orbit, the newest part of the Fluxframe platform. We built it for the 40,000 teams who already use us to keep their approvals moving.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20261107-210836-b7e8a5c/saas-launch-post/skill-stephenturner/r1/output.md)): Your team needs tools that match how work actually gets done. Today we're launching Fluxframe Orbit, the newest part of the Fluxframe platform. We built it for the 40,000 teams who already rely on us to keep their approvals moving.
- **plugin-deslop-writing (this plugin's skill)** ([after](runs/20261107-210836-b7e8a5c/saas-launch-post/plugin-deslop-writing/r1/output.md)): Fluxframe Orbit is out today. It's the newest part of the Fluxframe platform, and we built it for the 40,000 teams who already count on us to keep their approvals moving. Orbit is for teams whose tools haven't kept up with how their work ge…

## Validity

- Failed runs: 0
- Over-deletion flags (excluded from headline means): 0
- Skill-not-activated occurrences: 0
- Invalid judge votes: 0

## Verdict

- **C1** — FAIL: skill-humanizer: 6/6 docs; skill-stephenturner: 1/6 docs
- **C2** — PASS: plugin-deslop-writing mean retention = 0.93
- **C3** — PASS: skill-humanizer: plugin-deslop-writing 4.28 vs 4.54 - 0.5; skill-stephenturner: plugin-deslop-writing 4.54 vs 3.87 - 0.5
- **C4** — PASS: skill-humanizer: win rate 0.67; skill-stephenturner: win rate 0.56

Hypothesis held: no
