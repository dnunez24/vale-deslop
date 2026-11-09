# plugin-distribution Specification

## Purpose

Defines how users install the `deslop-writing` skill from this repository, as a plugin or as a standalone skill, and what each install method guarantees about contents and versions.

## Requirements

### Requirement: Claude Code marketplace install

The repository SHALL be a Claude Code plugin marketplace that offers one plugin, and that plugin SHALL provide the `deslop-writing` skill.

#### Scenario: Add marketplace and install

- **WHEN** a user runs `/plugin marketplace add dnunez24/vale-deslop` and installs the listed plugin
- **THEN** the `deslop-writing` skill is available in their sessions, listed once

#### Scenario: Manifests validate

- **WHEN** `claude plugin validate` runs on the repository root and on `plugin/`
- **THEN** both report that validation passed

### Requirement: Agent Plugins manifest

The `plugin/` directory SHALL contain an Agent Plugins 1.0 `plugin.json`, and every file the plugin uses SHALL resolve inside `plugin/` without symlinks.

#### Scenario: Schema-valid manifest

- **WHEN** `plugin/plugin.json` is validated against the Agent Plugins 1.0.0 plugin schema
- **THEN** it passes

#### Scenario: Self-contained package

- **WHEN** `plugin/` is copied alone to another location
- **THEN** the skill and its bundled Vale assets work from the copy

### Requirement: Skill-installer discovery

Skill installers that read plugin manifests SHALL find exactly one skill in the published repository: `deslop-writing`.

#### Scenario: Listing skills

- **WHEN** a user runs `npx skills add dnunez24/vale-deslop --list`
- **THEN** the output lists `deslop-writing` and no other skill

#### Scenario: Standalone skill install

- **WHEN** a user installs only the skill directory, without the rest of the plugin
- **THEN** the installed directory contains the skill instructions, the check catalog, the bundled Vale config, and the Deslop rules

### Requirement: Rules bundled with the skill

The skill directory SHALL contain the complete Deslop rule set and a Vale config that enables it, so that a Vale check needs no network access and no `vale sync`.

#### Scenario: Offline check

- **WHEN** Vale runs with the bundled config on a machine without network access
- **THEN** every Deslop check, including the four script-based checks, can fire

#### Scenario: Same rules as the release asset

- **WHEN** a release is built
- **THEN** the rule files in the skill directory and in `Deslop.zip` are identical

### Requirement: Vale package asset unchanged

The `Deslop.zip` release asset SHALL keep its name, its top-level `Deslop/` directory, and its file set, so existing `vale sync` users see no change.

#### Scenario: Existing consumer

- **GIVEN** a `.vale.ini` with `Packages = https://github.com/dnunez24/vale-deslop/releases/latest/download/Deslop.zip`
- **WHEN** the user runs `vale sync` after this change is released
- **THEN** the sync succeeds and installs the same 48 rules and 4 scripts as before

### Requirement: Versions follow releases

Every plugin and marketplace version field SHALL equal the repository release version.

#### Scenario: Release bump

- **WHEN** a release raises the version in `package.json`
- **THEN** the same release raises every plugin manifest version to the same value

### Requirement: Dev-only skills not published

The published repository SHALL NOT contain committed copies of the OpenSpec-generated skills.
The project setup SHALL regenerate them for contributors.

#### Scenario: Fresh clone setup

- **WHEN** a contributor clones the repository and runs `mise install && mise run setup`
- **THEN** the OpenSpec skills exist under `.agents/skills/`, `.claude/skills/`, and `.omp/skills/`
- **AND** `git status` reports none of them as untracked
