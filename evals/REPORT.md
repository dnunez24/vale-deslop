# Deslop eval report

Vale Deslop vs. agent deslop skills, on a pre-registered corpus with a pre-registered verdict. See `evals/README.md` for how to reproduce this report.

## Run metadata

- Run id: `20260828-205343-dcc8eb2`
- Created: 2026-08-28T20:53:43.120Z
- Git: `dcc8eb2` (dirty working tree)
- Vale: vale version 3.19.0, 20 union runs per measurement
- Package zip sha256: `89a55325690581e2bb94be756b79fcc545451d4b9fcef8222ab18ec561da2126`
- Actor model: `claude-sonnet-5`, judge model: `opus`
- skill-humanizer: [`blader/humanizer`](https://github.com/blader/humanizer) @ `e2e92e7b4b8229253ed5c8e81dc65463fdeddda5`
- skill-stephenturner: [`stephenturner/skill-deslop`](https://github.com/stephenturner/skill-deslop) @ `a906154bef375d9d49ed2ad7da13b2db16f0d3d2`
- Repeats: 3, judge votes: 3, budget: $25
- Total spend: $70.96

## Method

Four arms edit the same corpus document with the same shared task text. Only the intervention differs:

| Arm | Intervention |
| --- | --- |
| `control` | none (bare model) |
| `skill-humanizer` | [`blader/humanizer`](https://github.com/blader/humanizer), skill `humanizer` |
| `skill-stephenturner` | [`stephenturner/skill-deslop`](https://github.com/stephenturner/skill-deslop), skill `deslop` |
| `vale-deslop` | this package's built `Deslop.zip`, plus a `vale` fix loop (max 8 iterations) |

Shared task text (`evals/prompts/shared.md`), identical across every arm:

> Rewrite deslop.md's prose so it no longer reads as AI-generated, preserving every factual claim, heading, list, table, and code block, within 15% of the original word count.

Every document is measured before and after with the same fixed Vale configuration — not the repo's own `.vale.ini`, and not any arm's scratch config:

```ini
StylesPath = <repo>/Deslop/styles
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
| control (bare model) | 21.01 (11.07–33.37) | 68% | 11.28 | 3.61 | 0.88 | n/a | n/a | n/a | $0.32 | 92925ms | 18/0/0 |
| skill-humanizer (blader/humanizer) | 10.28 (2.30–17.22) | 84% | 7.44 | 0.33 | 0.92 | 100% | 7.86 | 4.74 | $0.81 | 134768ms | 18/0/0 |
| skill-stephenturner (stephenturner/skill-deslop) | 6.74 (2.36–19.59) | 90% | 5.17 | 0.17 | 0.93 | 100% | 7.89 | 4.44 | $0.86 | 163554ms | 18/0/0 |
| vale-deslop (this package) | 0.68 (0.00–2.64) | 99% | 0.56 | 0.00 | 0.87 | 0% | 6.76 | 3.29 | $1.23 | 269494ms | 18/0/0 |

"Judge win rate vs. counterpart": for `vale-deslop`, its win rate across every judged pair against both baselines; for each skill arm, its win rate against `vale-deslop` specifically. `control` is never judged (it has no vale-deslop pairing) and shows n/a.

## Per-document results

### engineering-blog

[before](corpus/engineering-blog.md) — 949 words, 63 alerts, 34 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 15.61 | 0.86 | 3/3 |
| skill-humanizer (blader/humanizer) | 4.32 | 0.90 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 3.39 | 0.92 | 3/3 |
| vale-deslop (this package) | 0.00 | 0.87 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's data-driven world, every distributed system eventually has to answer the same question: what happens when producers outpace consumers. Rivergate Queue is our answer, and this post walks through how it works. We're excited to anno…
- **control (bare model)** ([after](runs/20260828-205343-dcc8eb2/engineering-blog/control/r1/output.md)): Every distributed system eventually has to answer the same question: what happens when producers outpace consumers? Rivergate Queue is our answer, and this post walks through how it works. It's now generally available after a year of intern…
- **skill-humanizer (blader/humanizer)** ([after](runs/20260828-205343-dcc8eb2/engineering-blog/skill-humanizer/r1/output.md)): Every distributed system eventually has to answer the same question: what happens when producers outpace consumers. Rivergate Queue is our answer. It's generally available now, after a year of internal use, and this post walks through how i…
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20260828-205343-dcc8eb2/engineering-blog/skill-stephenturner/r1/output.md)): Every distributed system eventually has to answer the same question: what happens when producers outpace consumers? Rivergate Queue is the answer we landed on. It has been running inside our own infrastructure for a year, and with this rele…
- **vale-deslop (this package)** ([after](runs/20260828-205343-dcc8eb2/engineering-blog/vale-deslop/r1/output.md)): Every distributed system eventually has to answer the same question: what happens when producers outpace consumers. Rivergate Queue is our answer, and this post walks through how it works. It's now generally available after a year of intern…

### exec-memo

[before](corpus/exec-memo.md) — 943 words, 63 alerts, 31 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 27.55 | 0.91 | 3/3 |
| skill-humanizer (blader/humanizer) | 10.01 | 0.92 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 5.14 | 0.90 | 3/3 |
| vale-deslop (this package) | 0.00 | 0.87 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's competitive landscape, every quarter without a clear bet is a quarter we lose to faster-moving rivals. I'm thrilled to present our Q3 priorities after two weeks of planning sessions across every team.
- **control (bare model)** ([after](runs/20260828-205343-dcc8eb2/exec-memo/control/r1/output.md)): Every quarter we go without a clear bet, faster-moving rivals close the gap. After two weeks of planning sessions across every team, here are our Q3 priorities.
- **skill-humanizer (blader/humanizer)** ([after](runs/20260828-205343-dcc8eb2/exec-memo/skill-humanizer/r1/output.md)): Every quarter we enter without a clear bet is a quarter we lose to rivals moving faster than we are. After two weeks of planning sessions with every team, here are our Q3 priorities.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20260828-205343-dcc8eb2/exec-memo/skill-stephenturner/r1/output.md)): A quarter without a clear bet is a quarter we lose to rivals who move faster. Our Q3 priorities are below. They came out of two weeks of planning sessions with every team.
- **vale-deslop (this package)** ([after](runs/20260828-205343-dcc8eb2/exec-memo/vale-deslop/r1/output.md)): Every quarter without a clear bet is a quarter we lose to faster-moving rivals. Here are our Q3 priorities, the result of two weeks of planning sessions across every team.

### industry-thought-piece

[before](corpus/industry-thought-piece.md) — 1144 words, 64 alerts, 32 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 19.95 | 0.91 | 3/3 |
| skill-humanizer (blader/humanizer) | 11.66 | 0.95 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 11.33 | 0.96 | 3/3 |
| vale-deslop (this package) | 0.33 | 0.88 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's rapidly evolving business landscape, the conversation about artificial intelligence has shifted from whether to adopt it to how fast a company can claim it already has. Have you ever wondered why every company's AI strategy sound…
- **control (bare model)** ([after](runs/20260828-205343-dcc8eb2/industry-thought-piece/control/r1/output.md)): The conversation about artificial intelligence has shifted from whether to adopt it to how fast a company can claim it already has. Every company's AI strategy now sounds identical, word for word, quarter after quarter.
- **skill-humanizer (blader/humanizer)** ([after](runs/20260828-205343-dcc8eb2/industry-thought-piece/skill-humanizer/r1/output.md)): The question is no longer whether a company will adopt artificial intelligence. It is how fast that company can claim it already has. Which is probably why every AI strategy I read sounds like every other AI strategy I read, word for word, …
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20260828-205343-dcc8eb2/industry-thought-piece/skill-stephenturner/r1/output.md)): The conversation about artificial intelligence has moved from whether to adopt it to how fast a company can claim it already has. Sit through enough of them and every company's AI strategy sounds identical, word for word, quarter after quar…
- **vale-deslop (this package)** ([after](runs/20260828-205343-dcc8eb2/industry-thought-piece/vale-deslop/r1/output.md)): The conversation about artificial intelligence used to be about whether to adopt it. Now it's about how fast a company can claim it already has. Every company's AI strategy sounds identical, word for word, quarter after quarter.

### nonprofit-newsletter

[before](corpus/nonprofit-newsletter.md) — 963 words, 63 alerts, 31 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 19.19 | 0.88 | 3/3 |
| skill-humanizer (blader/humanizer) | 11.29 | 0.92 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 5.55 | 0.93 | 3/3 |
| vale-deslop (this package) | 1.61 | 0.87 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's fragile world, every well we drill changes a family's entire future. We're thrilled to share that Clearwater Relief crossed a major milestone this season: 500 wells across four countries, serving roughly 120,000 people.
- **control (bare model)** ([after](runs/20260828-205343-dcc8eb2/nonprofit-newsletter/control/r1/output.md)): Every well we drill changes a family's future. This season, Clearwater Relief crossed a big milestone: 500 wells across four countries, serving roughly 120,000 people.
- **skill-humanizer (blader/humanizer)** ([after](runs/20260828-205343-dcc8eb2/nonprofit-newsletter/skill-humanizer/r1/output.md)): Clearwater Relief passed 500 wells this season, spread across four countries and serving roughly 120,000 people. Every one of those wells changes what a family's future looks like.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20260828-205343-dcc8eb2/nonprofit-newsletter/skill-stephenturner/r1/output.md)): Clearwater Relief crossed a milestone this season: 500 wells across four countries, serving roughly 120,000 people. Each of those wells changes a family's entire future.
- **vale-deslop (this package)** ([after](runs/20260828-205343-dcc8eb2/nonprofit-newsletter/vale-deslop/r1/output.md)): Every well we drill changes a family's future. Clearwater Relief crossed a real milestone this season: 500 wells across four countries, serving roughly 120,000 people.

### research-summary

[before](corpus/research-summary.md) — 1114 words, 71 alerts, 37 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 19.28 | 0.81 | 3/3 |
| skill-humanizer (blader/humanizer) | 9.67 | 0.90 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 6.36 | 0.94 | 3/3 |
| vale-deslop (this package) | 0.35 | 0.86 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's fast-paced world, sleep is often the first thing people cut when life gets busy. We're excited to share the results of the Ridgeway Study, a three-year investigation into how sleep timing affects memory consolidation in adults ag…
- **control (bare model)** ([after](runs/20260828-205343-dcc8eb2/research-summary/control/r1/output.md)): Sleep is often the first thing people cut when life gets busy. This is a plain-language summary of the Ridgeway Study, a three-year investigation into how sleep timing affects memory consolidation in adults aged 40 to 65.
- **skill-humanizer (blader/humanizer)** ([after](runs/20260828-205343-dcc8eb2/research-summary/skill-humanizer/r1/output.md)): Sleep is usually the first thing people cut when life gets busy. The Ridgeway Study spent three years on a narrower question: how sleep timing affects memory consolidation in adults aged 40 to 65. Here are the results.
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20260828-205343-dcc8eb2/research-summary/skill-stephenturner/r1/output.md)): Sleep is usually the first thing people cut when life gets busy. The Ridgeway Study spent three years measuring what that costs, and more precisely, how sleep timing affects memory consolidation in adults aged 40 to 65. Here is what we foun…
- **vale-deslop (this package)** ([after](runs/20260828-205343-dcc8eb2/research-summary/vale-deslop/r1/output.md)): Sleep is often the first thing people cut when life gets busy, even though it plays a direct role in how well the brain holds onto new information. This is a summary of the Ridgeway Study's results: a three-year investigation into how timin…

### saas-launch-post

[before](corpus/saas-launch-post.md) — 862 words, 71 alerts, 36 distinct checks

| Arm | Mean alerts/1k | Mean retention | Eligible/total runs |
| --- | --- | --- | --- |
| control (bare model) | 24.50 | 0.88 | 3/3 |
| skill-humanizer (blader/humanizer) | 14.75 | 0.94 | 3/3 |
| skill-stephenturner (stephenturner/skill-deslop) | 8.68 | 0.89 | 3/3 |
| vale-deslop (this package) | 1.78 | 0.87 | 3/3 |

**Sample transformation** (first paragraph, repeat 1):

- **Source** (r1): In today's data-driven world, teams need tools that keep pace with how work actually happens. We're excited to announce Fluxframe Orbit, the newest addition to the Fluxframe platform, built for the 40,000 teams who already trust us to keep …
- **control (bare model)** ([after](runs/20260828-205343-dcc8eb2/saas-launch-post/control/r1/output.md)): We're announcing Fluxframe Orbit, the newest addition to the Fluxframe platform. It's built for the 40,000 teams who already rely on us to keep their approvals moving, and it's meant to keep pace with how work actually happens on a growing …
- **skill-humanizer (blader/humanizer)** ([after](runs/20260828-205343-dcc8eb2/saas-launch-post/skill-humanizer/r1/output.md)): Work today runs on data, and teams need tools that keep pace with how that work actually happens. So we're glad to announce Fluxframe Orbit, the newest addition to the Fluxframe platform. We built it for the 40,000 teams who already trust u…
- **skill-stephenturner (stephenturner/skill-deslop)** ([after](runs/20260828-205343-dcc8eb2/saas-launch-post/skill-stephenturner/r1/output.md)): Teams need tools that keep pace with how work actually happens. Today we're launching Fluxframe Orbit, the newest addition to the Fluxframe platform, built for the 40,000 teams who already trust us to keep their approvals moving.
- **vale-deslop (this package)** ([after](runs/20260828-205343-dcc8eb2/saas-launch-post/vale-deslop/r1/output.md)): Fluxframe Orbit is now live, the newest addition to Fluxframe's product line, and it's built for the 40,000 teams who already trust us to keep their approvals moving day to day.

## Validity

- Failed runs: 0
- Over-deletion flags (excluded from headline means): 0
- Skill-not-activated occurrences: 0
- Invalid judge votes: 0

## Verdict

- **C1** — PASS: skill-humanizer: 6/6 docs; skill-stephenturner: 6/6 docs
- **C2** — PASS: vale-deslop mean retention = 0.87
- **C3** — FAIL: skill-humanizer: vale 3.3 vs 4.74 - 0.5; skill-stephenturner: vale 3.28 vs 4.44 - 0.5
- **C4** — FAIL: skill-humanizer: win rate 0; skill-stephenturner: win rate 0

Hypothesis held: no
