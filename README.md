# Deslop

[![test](https://github.com/dnunez24/vale-deslop/actions/workflows/test.yml/badge.svg)](https://github.com/dnunez24/vale-deslop/actions/workflows/test.yml)
[![Latest release](https://img.shields.io/github/v/release/dnunez24/vale-deslop)](https://github.com/dnunez24/vale-deslop/releases/latest)

A [Vale](https://vale.sh) style that flags the tells of AI-written prose: buzzwords, em-dash habits,
hedging density, negative parallelism, and 44 more rules.

## What it catches

<!-- vale off -->

<!-- rules:start -->

| Rule                    | Level      | Flags                                                                                                                                                   |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AIBuzzWords`           | warning    | '%s' is an overused word in AI-generated writing.                                                                                                       |
| `AIReferrerParams`      | error      | A chatbot referrer/UTM parameter ('%s') leaked into this URL.                                                                                           |
| `AnaphoraRun`           | suggestion | 3+ sentences in a row open with the same word.                                                                                                          |
| `AnnouncementOpener`    | error      | '%s' is a press-release opener, not a plain statement.                                                                                                  |
| `BoldFirstBullet`       | suggestion | %d list items in a row open with a bold lead-in.                                                                                                        |
| `BusinessJargon`        | warning    | Use the plain word ('%s') instead of the corporate-jargon phrase ('%s').                                                                                |
| `ChatbotArtifacts`      | error      | '%s' is chatbot correspondence, not document prose.                                                                                                     |
| `CopulaAvoidance`       | warning    | Use the plain verb ('%s') instead of the dressed-up one ('%s').                                                                                         |
| `CurlyQuotes`           | error      | Use a straight quote ('%s') instead of the curly quote ('%s').                                                                                          |
| `DespiteChallenges`     | warning    | '%s' is the rigid "faces challenges, but the future looks bright"                                                                                       |
| `EmDashAside`           | warning    | %d em dashes in one sentence bracket an aside.                                                                                                          |
| `EmDashDocumentLimit`   | error      | %d em dashes in one document.                                                                                                                           |
| `EmDashEmphasis`        | warning    | Em dashes ('—') are overused in AI-generated writing to emphasize clauses or parallelisms. They are also a smell for overly complex sentence structure. |
| `EmDashParagraphLimit`  | error      | %d em dashes in one paragraph.                                                                                                                          |
| `Emoji`                 | warning    | Emoji are not appropriate for professional and formal writing. AI-generated                                                                             |
| `EmphasisCrutch`        | error      | '%s' asserts emphasis instead of earning it with evidence.                                                                                              |
| `ExclamationDensity`    | suggestion | %d exclamation points in one paragraph.                                                                                                                 |
| `FalseAgency`           | warning    | This gives an abstraction ('%s') human agency it doesn't have.                                                                                          |
| `FalseInclusivity`      | error      | This false-inclusivity opener flatters every reader instead of saying                                                                                   |
| `FalseRange`            | warning    | This isn't a real range -- it's an abstract-noun pair or chain dressed                                                                                  |
| `FillerTransitions`     | error      | '%s' is filler that adds no information.                                                                                                                |
| `GenericOpening`        | error      | '%s' is a stock scene-setting opener that fits any topic.                                                                                               |
| `GrandioseStakes`       | warning    | '%s' inflates this change's actual stakes.                                                                                                              |
| `HashtagBlock`          | error      | A run of social-media hashtags doesn't belong in this document.                                                                                         |
| `HedgingDensity`        | suggestion | %d hedges in one paragraph.                                                                                                                             |
| `InventedConcept`       | warning    | '%s' reads as an invented concept dressed up as an established one.                                                                                     |
| `KnowledgeCutoff`       | error      | '%s' is a model disclaiming its own knowledge, not document prose.                                                                                      |
| `ListicleInProse`       | suggestion | This ordinal ("The first/second/...") belongs in a list, not a sentence.                                                                                |
| `MagicAdverbs`          | warning    | '%s' asserts an effect instead of demonstrating it.                                                                                                     |
| `MarketingAdjectives`   | warning    | '%s' is an adjective that sells rather than describes.                                                                                                  |
| `MetaReference`         | warning    | '%s' narrates the document's own structure instead of writing content.                                                                                  |
| `NegativeParallelism`   | error      | This sets up a false "not X, but Y" contrast.                                                                                                           |
| `PairedAdjectives`      | warning    | A paired 'X yet/but Y' adjective contrast asserts a tension instead of showing it. Fix: cut one adjective, or show the specific tradeoff.               |
| `PedagogicalVoice`      | error      | '%s' is a classroom-teacher framing device.                                                                                                             |
| `RhetoricalSetup`       | warning    | This is a scripted rhetorical setup-and-payoff, not a real question.                                                                                    |
| `ScareQuotes`           | suggestion | This scare-quoted word signals ironic distance instead of a real quotation.                                                                             |
| `SentenceRhythm`        | suggestion | 4 sentences in a row land within 30%% of the same length.                                                                                               |
| `SignpostedConclusion`  | warning    | '%s' announces a conclusion instead of just concluding.                                                                                                 |
| `StaccatoFragments`     | suggestion | 3+ sentences in a row run 4 words or fewer.                                                                                                             |
| `Subjectivity`          | warning    | '%s' asserts a value judgment instead of demonstrating one.                                                                                             |
| `SuperficialParticiple` | warning    | This trailing '-ing' clause asserts significance instead of showing it.                                                                                 |
| `SweepingClaims`        | suggestion | '%s' is an absolute claim asserted without evidence.                                                                                                    |
| `ThroatClearing`        | error      | '%s' is throat-clearing before the actual point.                                                                                                        |
| `TricolonAbstract`      | suggestion | A three-abstract-noun list stands in for specifics.                                                                                                     |
| `UnicodeDecoration`     | error      | Use plain ASCII ('%s') instead of the decorative Unicode character ('%s').                                                                              |
| `VagueAttribution`      | warning    | '%s' attributes a claim to an unnamed authority.                                                                                                        |
| `WhOpener`              | suggestion | %d sentences in one paragraph open with a Wh- word.                                                                                                     |
| `WordEcho`              | suggestion | A word repeats 3+ times in one paragraph.                                                                                                               |

<!-- rules:end -->

<!-- vale on -->

## Requirements

Vale 3.2.0 or newer.
Four rules run as local Tengo scripts, and script-based rules that reference a local file only load correctly on Vale 3.2.0+.

## Install

Pick one of three ways to point Vale at this package, then enable it with `BasedOnStyles`.

### Pinned release (recommended)

```ini
StylesPath = styles
MinAlertLevel = suggestion
Packages = https://github.com/dnunez24/vale-deslop/releases/download/v0.1.0/Deslop.zip

[*.md]
BasedOnStyles = Deslop
```

Then run `vale sync`.

### Bare registry name

Valid once the `vale-cli/packages` submission in `CONTRIBUTING.md` merges:

```ini
StylesPath = styles
MinAlertLevel = suggestion
Packages = Deslop

[*.md]
BasedOnStyles = Deslop
```

### Local path

For vendoring a `.zip` or an unpacked directory:

```ini
StylesPath = styles
MinAlertLevel = suggestion
Packages = ./path/to/Deslop.zip

[*.md]
BasedOnStyles = Deslop
```

The package doesn't enable itself: `BasedOnStyles = Deslop` in the consuming project's own
`.vale.ini` is what turns it on.

## Configuration

Turn a single rule off:

```ini
[*.md]
BasedOnStyles = Deslop
Deslop.EmDashAside = NO
```

Or change its severity:

```ini
[*.md]
BasedOnStyles = Deslop
Deslop.EmDashAside = suggestion
```

### Linting source-code comments

When linting code comments as embedded Markdown (Vale's documented pattern via `[formats]`), turn off the nine rules that measure a whole document.
They misfire on a file fragment such as a single JSDoc comment:

```ini
StylesPath = vale/styles
MinAlertLevel = suggestion

[formats]
js = md
ts = md
tsx = md

[*.{js,ts,tsx}]
BasedOnStyles = Deslop
# Document-shape rules measure list formatting, paragraph rhythm, and word
# density across a whole document. A source comment is a fragment of a file,
# not a document, so these misfire on inline documentation. Word- and
# phrase-level Deslop rules still apply to comments.
Deslop.AnaphoraRun = NO
Deslop.BoldFirstBullet = NO
Deslop.ExclamationDensity = NO
Deslop.HedgingDensity = NO
Deslop.ListicleInProse = NO
Deslop.SentenceRhythm = NO
Deslop.StaccatoFragments = NO
Deslop.WhOpener = NO
Deslop.WordEcho = NO
```

## Known interactions

`Deslop.UnicodeDecoration` rewrites curly quotes, em dashes, and other typographic Unicode back to plain ASCII, while `proselint.Typography` rewrites the other direction.
A project running both must disable `proselint.Typography` (see the rationale in `Deslop/styles/Deslop/UnicodeDecoration.yml`).

## Evidence

[`evals/REPORT.md`](evals/REPORT.md) compares this package against two popular third-party deslop skills ([`blader/humanizer`](https://github.com/blader/humanizer) and [`stephenturner/skill-deslop`](https://github.com/stephenturner/skill-deslop)) on a pre-registered corpus, with a pre-registered pass-or-fail verdict.
No numbers here: they change on every re-measure.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
