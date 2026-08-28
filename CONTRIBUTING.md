# Contributing

Thanks for considering a contribution to Deslop.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting a bug or a false positive

Open an issue with the `false_positive` template.
Include the exact sentence that tripped the rule and the rule name (`Deslop.<RuleName>`) from the Vale output.
A false-positive report needs the offending sentence, or nobody can reproduce or fix it.

## Proposing a new rule

Open an issue with the `rule_proposal` template.
Describe the AI-writing tell, two or three example sentences it should flag, and (just as important) two or three example sentences it must never flag.

## Setup

```sh
mise install
mise run setup
```

`setup` runs `deps` (Bun packages), `hooks` (installs lefthook), and `sync` (downloads the Vale styles this repo self-lints with).
Run `mise tasks ls` any time to see every entry point.

After `mise run hooks`, switching branches refreshes pinned tools and Bun packages automatically via the `post-checkout` hook.
You shouldn't need to re-run `mise install` by hand after a `git checkout`.

## Repository layout

- `Deslop/`: the package that ships.
  The build script zips everything under it verbatim into `Deslop.zip`.
- `tests/fixtures/rules/<Rule>.md`: the positive fixture for `Deslop/styles/Deslop/<Rule>.yml`,
  one file per rule, each containing sentences the rule must fire on.
- `tests/fixtures/clean/`: a nine-genre corpus of clean prose that must not trip false positives
  (aside from the documented fiction em-dash allowance).
- The Vale and rumdl configs skip `tests/fixtures/**` on purpose.
  It's slop-filled test input, not house-authored prose, so never reformat it to satisfy the linters.

## Changing or adding a rule

1. Edit or add the rule's `.yml` under `Deslop/styles/Deslop/`.
2. Add or update `tests/fixtures/rules/<Rule>.md` so the rule fires at least three times.
3. Run `mise run expected:update` to regenerate `tests/expected-alerts.json`.
4. Review the diff by hand.
   An unexpected change in another rule's counts means the new or edited rule overlaps an existing one, so reconcile before committing.
5. Run `mise run test`.
6. If the rule's `level` or the first line of its `message` changed, run `mise run readme:update`
   to keep the rule table in `README.md` in sync (`tests/style.test.ts` enforces this).

## Commits

Conventional Commits, enforced by commitlint on `commit-msg`:

- `feat:`: a new rule, or a broadened match on an existing one.
- `fix:`: a false-positive fix.
- `feat!:` or a `BREAKING CHANGE:` footer: removing or renaming a rule.
  This changes consumers' `.vale.ini`, so it's a breaking change even though the package's own code didn't break.

Never hand-edit `CHANGELOG.md` or `package.json`'s `version`. release-please owns both.

## Releasing (maintainers)

Merging to `main` makes release-please open or update a release pull request.
Merging that PR tags the release, cuts the GitHub Release, and uploads `Deslop.zip` as a release asset.

### One-time repository settings

Set these once in the GitHub UI, under Settings:

- **Actions, General, Workflow permissions**: **Read and write permissions**, and **let GitHub Actions create and approve pull requests**.
  Without the second option, release-please can't open its release PR.
- **Branches, branch protection rule for `main`**: **Require status checks to pass before merging**, with the `test` workflow selected.
  The `release` workflow's `publish` job builds and uploads `Deslop.zip` without re-running `test`/`lint:prose`/`lint:md`.
  It trusts that whatever reached `main` already passed CI on its pull request, and this setting is what makes that trust hold.
  Without it, a direct push to `main` could ship a broken archive.

### One-time registry submission

After the first release publishes `Deslop.zip`, open a pull request targeting
[`vale-cli/packages`](https://github.com/vale-cli/packages) adding this entry to `library.json` in
alphabetical position:

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

Once that PR merges, the bare registry name install form in `README.md` is valid without the caveat.
