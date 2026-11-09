# deslop-eval Specification

## Purpose

Defines how the eval harness compares one treatment arm against the baseline deslop skills on the fixed corpus, with criteria fixed before any paid run.

## Requirements

### Requirement: Treatment arm is recorded per run

Each eval run SHALL record which arm is the treatment.
The verdict and judge pairings SHALL use that recorded arm.

#### Scenario: Existing run keeps its verdict

- **WHEN** `bun run scripts/eval-measure.ts --run 20260828-205343-dcc8eb2 --check` runs, and the verdict for that run is recomputed
- **THEN** the check passes, and the verdict names `vale-deslop` as the treatment with the same C1 to C4 results as the committed report

#### Scenario: Plugin run

- **WHEN** a run records `plugin-deslop-writing` as its treatment
- **THEN** the judge pairs each baseline skill arm with `plugin-deslop-writing`, and C1 to C4 evaluate `plugin-deslop-writing`

### Requirement: Plugin arm uses the shipped skill

The `plugin-deslop-writing` arm SHALL install the `deslop-writing` skill directory from `plugin/` into the arm's scratch project, exactly as committed, and SHALL allow the agent to run only `vale` as a shell command.

#### Scenario: Skill not activated

- **WHEN** the transcript of a plugin-arm attempt shows that the `deslop-writing` skill never activated
- **THEN** the attempt is marked failed with reason `skill-not-activated`

#### Scenario: Skill files changed during a run

- **WHEN** any file in the scratch copy of the skill differs from the committed skill after the attempt
- **THEN** the attempt is marked failed with reason `config-tampering`

### Requirement: Separate output file

For runs that use the plugin arm, the shared task text SHALL tell every arm to write its rewrite to a separate output file and leave the source file unchanged.
The harness SHALL measure that output file.

#### Scenario: Source modified

- **WHEN** an attempt changes the source file
- **THEN** the attempt is marked failed with reason `source-modified`

#### Scenario: Output missing

- **WHEN** an attempt ends and the output file doesn't exist
- **THEN** the attempt is marked failed with reason `no-output`

### Requirement: Prompts are stored with each run

Each run SHALL store a copy of the prompts it used, and the report for a run SHALL quote the shared task text from that copy.

#### Scenario: Prompts change after a run

- **WHEN** `evals/prompts/shared.md` changes after a run is committed
- **THEN** the report for the earlier run still shows the task text that run used

### Requirement: Resolved models are recorded

Each run SHALL record the exact model IDs that served the writer and judge calls, not only the aliases it requested, and the report SHALL show those IDs.

#### Scenario: Judge alias resolves

- **GIVEN** a run requests the judge model by the alias `opus`
- **WHEN** preflight completes
- **THEN** the manifest and the report name a model ID that starts with `claude-opus-`

### Requirement: Auth method is recorded

Each run SHALL record the Claude CLI auth method it used, so that readers can tell whether its cost figures were charged to API credit.

#### Scenario: API key run

- **WHEN** a run is started with `ANTHROPIC_API_KEY` set for that command only
- **THEN** the manifest records the auth method `api_key`

### Requirement: Criteria fixed before the paid run

The plugin run SHALL use the existing C1 to C4 criteria and thresholds unchanged, with the treatment arm in place of `vale-deslop`.
The criteria, prompts, skill, and bundled config SHALL be committed before the run starts, and the run SHALL record that commit.

#### Scenario: Pre-registration check

- **WHEN** the plugin run's manifest is inspected
- **THEN** it records a git commit, with a clean working tree, that contains the criteria, prompts, skill, and bundled config the run used

#### Scenario: Verdict published either way

- **WHEN** the plugin run finishes
- **THEN** the regenerated report states the verdict, and the evidence section of `README.md` links to it, whether the hypothesis held or not
