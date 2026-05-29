---
name: coding
description: Coding guidelines for all agents. Always load this skill before you edit a single line of code.
---

# Coding Guidelines

Follow guidelines when editing files or writing human-facing text.

## Concise Messaging

Use /caveman skill to communicate with user and all Agents to save token costs. Caveman your own inner thought monologues too. Don't prefix the sentence with "caveman" though.

Don't caveman actual code.

## Banned Symbols

In all files, including markdown, NEVER use em dashes, smart quotes, or zero-width characters. Use regular quotes. If you see smart quotes in existing code, replace them. Reword sentences to avoid lazy dash-joins. If you must use a dash, use a regular dash (-).

To check for lingering usages: `... | xargs grep -Pl '[\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}\x{200B}\x{200C}\x{200D}]' 2>/dev/null`

FYI: Some languages, like LaTeX and SQL, will crash if you put in a unicode character (like an `e2 80 94`). Overall, no matter the language, just dont use unicode characters unless the user has established that pattern in their code already.

## Documentation Style

No tricolons (three adjectives/bullets/examples), punchlines, rhythm, cadence, rhetorics, flair, or puffery. Write concise, accurate sentences like a human would. Instead of em dashes joining sentences and fragments, form proper sentences.

## Comment Discipline

Only comment when something non-obvious happens. Do not narrate code.

Don't comment:
- What types already say (`User | null` needs no "returns null if not found")
- Self-evident code (`if (!session.valid) throw` needs no explanation)
- What was removed or changed (git handles that)

Do comment:
- Decisions to use anti-patterns: `// @unknown Router schema shape may contain any field types.`
- Why one approach chosen over another: `// Use executeToolCall so Discord flows can have their own handlers`
- Why block intentionally empty: `// Tests will trigger recreates multiple times. Silently pass / continue.`

## Git Hygiene

### Consent

Did the user ask you to commit?
Just once? Or was it implied they want you committing from now on?
Did they even ask you to push/PR?

❓ Ask before firing away.

### Message

One short phrase or sentence. Verb first, no prefixes. Do not use words like \"fix\" unless the human has confirmed the change is the correct solution; for unverified attempts, use words like \"attempt\" or \"try\" instead. If related to issues, end with (fixes #N) for bugfixes, (closes #N) for completed tasks, (related #N) to link without closing.

### Dont Spam Commits

Typically I have you execute a plan with phases, so all slices in a phase must be committed together.

Audit thoroughly before committing. Our typical Red Team workflow depend on unstaged diffs.

Found a bug after commiting? gitCommit(amend:true) to keep commits consolidated. If amending, merge messages intelligently.

If you are working on phases of work, finish ALL phases before making a PR. Don't PR incomplete plans.
