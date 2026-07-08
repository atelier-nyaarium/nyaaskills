---
name: coding
description: Coding guidelines for all agents. Always load this skill before you edit a single line of code.
---

# Coding Guidelines

Follow guidelines when editing files or writing human-facing text.

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster.

## Refactoring

When refactoring clean-break style, try reducing surface area for problems and failing tests. Peel off independent clean break layers before adding code.

## Dont Use sed to Edit

You break shit a lot of the times you do this. Instead:

1. Find/Grep to locate
2. Tiny amounts: open files manually for edit. Many files: send a swarm at them.

**Remote files:** Temporarily mount the remote filesystem to local with sshfs to `/tmp/{foldername}` and edit using instructions above.

## Unit Tests

For complex systems, trend towards behavior testing, not plain internal state checks. Whenever the observable behavior of a unit can be expressed, assert on that rather than on plain state details.
- ❌ State: `expect(foo.a).toBe(42)`
- ✅ Behavior: After the user performs sequence A → B → C, `expect(foo).toEqual({ x, y, z })`

Rearrange by similarity or transition. Many tests in a file tends to have similarity and differences.

## Banned Symbols

In all files, including markdown, NEVER use em dashes, smart quotes, or zero-width characters. Use regular quotes. If you see smart quotes in existing code, replace them. Reword sentences to avoid lazy dash-joins. If you must use a dash, use a regular dash (-), BUT not before attempting a reword!

Don't use `sed` to replace. You need to read the sentence structures to reword it.

To check for lingering usages: `... | xargs grep -Pl '[\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}\x{200B}\x{200C}\x{200D}]' 2>/dev/null`

FYI: Some languages, like LaTeX and SQL, will crash if you put in a unicode character (like an `e2 80 94`). Overall, no matter the language, just avoid using unicode characters in code files, unless the user has established that pattern in their code already.

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

## Comments Must be Timeless

Comments must describe the code as it stands. Not some plan. Nor phase. Nor a migration. Nor what changed. NEVER write comments like:
- ❌ `// Phase D: seal directly to each Switch`
- ❌ `// Now it should be multi-home (was gateway)`
- ❌ `// New keyring sync`
- ❌ `// Per the plan, verify the admission here`
A reader a year from now has no memory of this work. Every comment has to earn its place based on intrinsic logic alone.

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

## Package Install and Update - 7-Day Maturity Rule

Due to dangers like Mini Shai-Hulud, you must proceed with caution when installing Node/Python packages. Follow /update-packages rule when touching packages and versions.
