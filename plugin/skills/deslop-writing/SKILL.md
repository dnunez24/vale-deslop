---
name: deslop-writing
description: Revise prose so it reads as written by a specific person, and check new prose you write before you hand it over. Use when the user asks to edit, rewrite, tighten, humanize, or deslop a document, or asks you to write an article, post, memo, readme, email, or other prose. Uses the Deslop Vale rules as advice, never edits the original file.
license: MIT
compatibility: Works best with Vale 3.21.0 or newer on PATH. Without Vale it reviews against a bundled catalog of checks.
allowed-tools: Bash(vale *)
---

# Deslop writing

Make prose direct, specific, and varied, so it sounds like one person with something to say.
The Deslop Vale rules flag common AI-writing tells.
Treat each alert as a prompt for judgment, not a score to drive to zero.

This skill has two modes:

- **Edit mode**: the user points at a document that exists.
  You write a revised draft to a new file and leave the original untouched.
- **Write mode**: you compose new prose in this task.
  You review it before you hand it over.

## Locations

`<skill-dir>` is the directory that holds this `SKILL.md`.
Resolve it from the path your harness used to load this file.
Quote it in every command, because it can contain spaces, and on Windows it can contain backslashes.

- `<skill-dir>/deslop.vale.ini`: the only Vale config you use.
- `<skill-dir>/references/checks.md`: every check, with its level, message, and fix.
- `<skill-dir>/references/install-vale.md`: how to install Vale.

Never write inside `<skill-dir>`.
It can be read-only.

## Step 1: Rewrite the whole document

Read the source once, end to end.
Decide who the reader is and what they need to do or know.
Then rewrite the whole document for that reader:

- Lead with the point.
- Replace vague claims with the specific detail the source supports.
- Vary sentence length and openers.
- Prefer plain verbs to dressed-up ones.
- Rebuild a weak sentence instead of trimming the flagged words out of it.

Don't rewrite only the spans a checker would flag.
Don't run Vale on the original text.

Keep every factual claim, number, name, quotation, link, and hashtag from the source.
Never delete or invent content to satisfy a check.
A rhetorical question you rewrite must not become a claim the source doesn't make.

## Step 2: Name the output

In edit mode, write the draft next to the original.
Insert `.deslop` before the extension: `notes/memo.md` becomes `notes/memo.deslop.md`.
If that path exists, use `memo.deslop-2.md`, then `memo.deslop-3.md`, and continue the count.
Never overwrite an existing file.

- If the user names an output path other than the original, use it.
- If the user asks you to overwrite the original, write a draft anyway and say where it is.
- If the user asks you to add new prose to an existing file, write a draft of the whole file with the new prose in it.

In write mode:

- A file you created in this task: review it and revise it in place.
- Prose that goes only into the chat reply: create no file.
  Review the text and reply with the revised version.

## Step 3: Check Vale

Run `vale --version` once, before your first Vale run in the task.
You need 3.21.0 or newer.

If Vale is missing or older, read `references/install-vale.md`, show the user the command for their operating system, and ask for approval.
Run the command only after the user says yes.
If the user declines, or the install fails, say so once and go to the inference-only path below.
Don't retry an install that failed.

## Step 4: Run Vale and triage

Run Vale on the draft, with the bundled config and no other:

```sh
vale --no-global --config="<skill-dir>/deslop.vale.ini" --output=JSON "<draft path>"
```

For prose that exists only in the chat, pipe it on stdin and create no file:

```sh
vale --no-global --config="<skill-dir>/deslop.vale.ini" --ext=.md --output=JSON <<'DRAFT'
<the prose>
DRAFT
```

`--config` overrides `VALE_CONFIG_PATH` and any project `.vale.ini`, and `--no-global` drops the user's config.
That keeps the results limited to the Deslop checks.
If the file extension isn't `.md` or `.txt`, use the stdin form with `--ext=.md`.

For each alert, pick one:

- **Revise**: the flagged text is a real tell, and a better sentence exists.
- **Keep**: the text is correct for the reader.
  Record the check name and a one-line reason.

Rules for the choice:

- Keep an alert on a link, hashtag, quotation, or name that the source contains.
- Keep an alert when the fix would remove a fact or add an unsupported claim.
- Look up the check in `references/checks.md` when the fix isn't obvious.
- Don't suppress a check with Vale comments or markup.

Don't aim for zero alerts.
If you revised anything, run Vale a second time on the result and triage what's left.
Never run Vale more than twice on one draft.

## Inference-only path

When Vale isn't available, still do steps 1 and 2.
Then read `references/checks.md` and review the draft against it, one check at a time.
Apply the same revise-or-keep judgment.
Tell the user that Vale didn't run, and say why.

## Step 5: Tell the user what happened

End with a short summary:

- The draft path, when you wrote a file.
- Whether Vale ran, and how many passes.
- Each kept alert, as `Deslop.<Check>: <reason>`.

In chat mode, put the revised text first and the summary after it.

Example:

```text
Draft: notes/memo.deslop.md
Vale ran: 2 passes.
Kept:
- Deslop.HashtagBlock: the source's hashtags are part of the post.
- Deslop.RhetoricalSetup: the question restates the reader's own objection.
```
