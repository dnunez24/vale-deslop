# Spec Delta

## Purpose

Defines how the `deslop-writing` agent skill revises AI-assisted prose so it reads as written by a specific person, using Deslop alerts as advice and never changing the user's original document.

## ADDED Requirements

### Requirement: Edit mode writes a new draft

When the user asks the skill to revise a document that already exists, the skill SHALL write the revision to a new draft file and SHALL leave the original file byte-for-byte unchanged.

#### Scenario: Default draft path

- **GIVEN** an existing file `notes/memo.md` and no output path named by the user
- **WHEN** the skill revises it
- **THEN** the revision is written to `notes/memo.deslop.md`
- **AND** `notes/memo.md` has the same bytes as before the skill ran

#### Scenario: Default draft path already taken

- **GIVEN** `notes/memo.deslop.md` already exists
- **WHEN** the skill revises `notes/memo.md`
- **THEN** the revision is written to `notes/memo.deslop-2.md`, or the next unused number
- **AND** no existing file is overwritten

#### Scenario: User names the output path

- **WHEN** the user names an output path that isn't the original file
- **THEN** the skill writes the draft to that path

#### Scenario: User asks for an in-place edit

- **WHEN** the user asks the skill to overwrite the original file
- **THEN** the skill writes a draft instead and tells the user the draft path

#### Scenario: New content for an existing file

- **WHEN** the user asks for new prose to be added to a file that existed before the skill ran
- **THEN** the skill writes a draft of the whole file that includes the new prose, and leaves the original unchanged

### Requirement: Write mode checks new prose

When the agent composes new prose with the skill active, the skill SHALL review that prose before it hands the prose to the user.
The skill MAY revise files it created during the same task.

#### Scenario: New file

- **WHEN** the user asks for a new document and the agent creates the file
- **THEN** the skill reviews the file and revises it in place before reporting it done

#### Scenario: Prose in the chat reply

- **WHEN** the requested prose goes only into the chat reply and no file exists
- **THEN** the skill reviews the text without creating any file and replies with the revised text

### Requirement: Rewrite for the reader before checking

The skill SHALL revise the whole document for directness, varied rhythm, and a specific voice before it runs any Vale check.
It SHALL NOT revise only the spans that Vale flags.

#### Scenario: Order of work

- **WHEN** the skill revises a document with Vale available
- **THEN** its first Vale run checks the rewritten draft, not the original text

### Requirement: Vale alerts are advisory

The skill SHALL treat each Deslop alert as a prompt for judgment.
For each alert it SHALL either revise the text or keep it, and it SHALL NOT aim for zero alerts.

#### Scenario: Alert kept

- **WHEN** an alert flags text that the skill judges correct for the reader
- **THEN** the skill keeps the text and records the check name and a one-line reason in its summary to the user

#### Scenario: Bounded Vale passes

- **WHEN** the skill revises one draft
- **THEN** it runs Vale on that draft at most two times

### Requirement: Fixes preserve facts

The skill SHALL preserve every factual claim, number, name, quotation, link, and hashtag from the source.
It SHALL NOT resolve an alert by deleting or inventing content.

#### Scenario: Alert on required content

- **WHEN** an alert flags a link, a hashtag, a quotation, or a name that the source contains
- **THEN** the skill keeps that content and records the alert as kept

#### Scenario: Flagged rhetorical question

- **WHEN** an alert flags a rhetorical question
- **THEN** any rewrite states only what the source supports and adds no new claim

### Requirement: Bundled config only

The skill SHALL run Vale only with the configuration bundled in the skill directory.
It SHALL ignore the user's global Vale config, any project Vale config, and `VALE_CONFIG_PATH`.

#### Scenario: Project has its own Vale config

- **GIVEN** the working directory contains a `.vale.ini` that enables other styles
- **WHEN** the skill runs Vale
- **THEN** only checks from the bundled Deslop rules appear in the results

#### Scenario: Skill directory is read-only

- **GIVEN** the installed skill directory isn't writable
- **WHEN** the skill runs Vale
- **THEN** the check completes and the skill writes nothing inside its own directory

### Requirement: Vale detection and install offer

Before its first Vale run in a task, the skill SHALL check for Vale 3.21.0 or newer on `PATH`, the same minimum the Deslop package documents.
If Vale is missing or older, the skill SHALL offer the install command for the user's operating system and SHALL install only after the user approves.

#### Scenario: Vale missing

- **WHEN** `vale` isn't on `PATH`
- **THEN** the skill shows an install command for the current operating system and asks for approval before it runs it

#### Scenario: Vale too old

- **WHEN** the installed Vale reports a version older than 3.21.0
- **THEN** the skill treats Vale as missing and offers an upgrade

### Requirement: Inference-only fallback

When Vale is unavailable, the skill SHALL complete the revision without Vale by reviewing the draft against the bundled catalog of Deslop checks, and SHALL tell the user that no Vale check ran.

#### Scenario: User declines the install

- **WHEN** the user declines the Vale install
- **THEN** the skill completes the revision with the check catalog and states that Vale didn't run

#### Scenario: Install fails

- **WHEN** the approved install command fails
- **THEN** the skill reports the failure once, then completes the revision with the check catalog

### Requirement: Summary to the user

After each revision the skill SHALL tell the user the draft location, if a file was written, whether Vale ran, and each kept alert with its reason.

#### Scenario: Edit mode summary

- **WHEN** an edit-mode revision finishes
- **THEN** the reply names the draft path, states whether Vale ran, and lists the kept alerts
