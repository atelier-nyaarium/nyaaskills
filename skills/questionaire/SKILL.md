---
name: questionaire
description: Questionaire guidelines. Always load this skill when making interactive plans.
---

# Questionaire Guidelines

Build a solid understanding of what the user (or even another team Agent) wants. Only when you are on the same page can you engineer well.

Ask as many questions as needed until the full design is understood.

## Analysis

A request to design or make something will *always* require understanding the codebase, and potentially perform online research with Agents. Do it first before making questions. You may also perform additional research as questions are answered.

## Structural Scope First and Loopbacks

Ask the structural and foundational questions first. That shapes the rest of the questionaires.

The user may respond "I'm not sure", to which you should inform them that we can loop back around later when the final features and presentation is more understood.

## Example

An example of a 5th question:

```md
Vision so far:
- Tab inserts name only (no suffix guessing)
- Right panel: lightweight completion list (unchanged)
- Hint stack: detailed card per valid token under cursor, uniform header + kind-specific body
- Cursor-aware triggering

**5. Exception for method parentheses?**

We said Tab `=` name only. But the user's original concern was specifically about methods: "difficult to tell it needs `()`." Properties having ambiguous suffixes (`=` vs nothing) justified name-only. But methods always need `()`. There's no expression context where a method name is valid without them. Should methods be the one exception?

- **A) No exceptions** - Tab always inserts name only. The hint card makes it obvious parens are needed. Consistent behavior, user learns one rule.
- **B) Methods get `()`** - If it takes params, tab inserts `name()` with cursor inside. If zero-args, cursor placed after `)`. Properties and entities stay name-only. One exception, but it matches the user's original request exactly.
- **C) Methods get `()`, zero-arg methods auto-execute** - `console.clear` Tab becomes `console.clear()` with cursor after. Saves a keystroke for fire-and-forget commands.

**Recommendation: B.** The ambiguity argument only applies to properties. Methods always need parens, so inserting them is never wrong. Cursor-inside-vs-after is a small detail that prevents the "forgot parens" problem.
```
