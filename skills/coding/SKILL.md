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

Due to dangers like Mini Shai-Hulud, you must proceed with caution when installing Node/Python packages. Or really any package manager ecosystem with fast moving CI/CD. This skill will speak in terms of Bun.

When manually installing packages with bun (or any package manager really), only install versions that are **at least 7 days old** or **advisory urged**. The maturity window gives security researchers and automated audits time to flag a compromised or vulnerable release before it lands in your project.

***Be deliberately slow and careful. One package at a time:***

1. **Inspect the package**: `bun pm view <pkg>` for metadata, maintainers, and latest versions.
2. **Filter by age**: Select a version that was published 7+ days ago.
   - `npm view <pkg> time --json | jq 'to_entries | map(select(.key != "created" and .key != "modified")) | map(select(.key | test("-") | not)) | sort_by(.value) | .[-20:] | from_entries'`
3. **Audit before it touches node_modules**: `bun audit` only scans the lockfile, so it can't see a package you haven't added yet. Workaround: Manually add the pinned version to `package.json`, run `bun install --lockfile-only` to resolve it into `bun.lock` without installing, then run `bun audit`. Only proceed if clean.
4. **Pin it**: if the entry previously had a `^` (or `~`) range allowing automatic upgrades, strip it so the version stays exact. You should check if `bunfig.toml` specifies `minimumReleaseAge = 604800`, to automatically enforce this rule.
5. **Install the exact version**: `bun add <pkg>@<version>` (`-d` for devDependencies), or plain `bun install` if you already staged it in step 3 and pinned it in step 4.

If there is a tie-breaker between 7-day rule and advisory, use the advisory's judgement.
