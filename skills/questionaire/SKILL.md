---
name: questionaire
description: Questionaire guidelines. Always load this skill when making interactive plans.
---

# Questionaire Guidelines

Build solid understanding of what user (or another team Agent) wants. Only when on same page can you engineer well.

Ask as many questions as needed until full design understood.

## Concise Messaging

Use /caveman skill to communicate with user and all Agents to save token costs. Caveman your own inner thought monologues too. Don't prefix the sentence with "caveman" though.

Don't caveman actual code.

## Analysis

Request to design or make something *always* requires understanding codebase, and potentially online research with Agents. Do it first before making questions. May also perform additional research as questions answered.

## Structural Scope First and Loopbacks

Ask structural and foundational questions first. Shapes rest of questionaires. 1 question at a time.

User may respond "I'm not sure", to which inform them we can loop back later when final features and presentation more understood.

## Plan File

Decide on a name and write to `./plans/*.md`, a first section of `## Questionaire`.

Capture questionaire as you go.

Only capture:
- Questions that got a response. Skip any that were invalidated or superceded by another.
- Only the selected answer for the question.
- Only if your recommendation was chosen, capture your recommendation reason.
- If given, quotes of user's reasonings.

Once the questionaire is finally complete, write a rough `## Plan` section based on the questionaire. Then ask if they want to start cycles of plan refinement.

## Example

Example of 5th question (recommended options bolded):

```md
Vision so far:
- Tab insert name only (no suffix guess)
- Right panel: lightweight completion list (unchanged)
- Hint stack: detailed card per valid token under cursor, uniform header + kind-specific body
- Cursor-aware trigger

**5. Exception for method parentheses?**

We said Tab `=` name only. But user original concern was methods: "difficult to tell it needs `()`." Properties have ambiguous suffix (`=` vs nothing) → name-only justified. But methods always need `()`. No expression context where method name valid without them. Should methods be the one exception?

- A) No exceptions - Tab always name only. Hint card makes parens need obvious. Consistent, user learns one rule.
- **B) Methods get `()`** - If takes params, tab insert `name()` cursor inside. If zero-args, cursor after `)`. Properties and entities stay name-only. One exception, matches user original request exactly.
- C) Methods get `()`, zero-arg methods auto-execute - `console.clear` Tab becomes `console.clear()` cursor after. Saves keystroke for fire-and-forget commands.

**Recommendation: B.** Ambiguity argument only applies to properties. Methods always need parens → inserting never wrong. Cursor-inside-vs-after small detail, prevents "forgot parens" problem.
```
