---
name: questionaire
description: Questionaire guidelines. Always load this skill when making interactive plans.
---

# Questionaire Guidelines

Build solid understanding of what user (or another team Agent) wants. Only when on same page can you engineer well.

Ask as many questions as needed until full design understood.

**Don't use `AskUserQuestion` tool:** Ask the user directly instead of using `AskUserQuestion` tool. That tool is too basic for this skill.

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster.

## Analysis

Request to design or make something *always* requires understanding codebase, and potentially online research with Opus Agents. Do it first before making questions.

Perform additional research as answers come in.

Structural questions can drastically change a lot. Use dynamic workflows to figure out the scale of a question as answers come in.

## Structural Scope First and Loopbacks

Ask structural and foundational questions first. Shapes rest of questionaires. 1 multiple choice question at a time.

User may respond "I'm not sure", to which inform them we can loop back later when final features and presentation more understood.

## UX Design

If the questionaire leads into UX design and presentation, ask if the user would like to use Claude Designer to visualize and iterate on the design.

### Using Claude Designer (DesignSync)

If they say yes, drive the `DesignSync` MCP tool.
- Create the project (`create_project`) if it's a new UX, or `list_projects` if it sounds like a session resume.
- Link them to the proper `https://claude.ai/design/p/${projectId}` URL.

Read the tool description first (it is the authoritative spec). The loop: `list_projects` -> `create_project({name})` if none, keep the `projectId` -> author one self-contained HTML mockup per screen as `<scratchpad>/design-mockups/components/<screen>/index.html` (inline `<style>`/SVG, no external assets, first line `<!-- @dsCard group="..." -->`) -> `finalize_plan` -> `write_files` -> `register_assets` -> tell the user where to look. One screen at a time: build, push, react, refine. Present and build, don't quiz them with abstract screen names.

**Required tool usage:**
- `finalize_plan` **requires `deletes`** even when not deleting. Pass `deletes: []` or the call errors. Also required: `projectId`, `localDir`, `writes`.
- A bare `write_files` renders an **empty pane**. New card = `write_files` THEN `register_assets` (name, path, viewport, group, subtitle). Updating a card = `write_files` only. Removing = `unregister_assets` + `delete_files` (path must be in the plan's `deletes`, and delete the local file too).

`localPath` must be inside the finalized `localDir`. Log every design ruling into the feature plan's questionaire/plan sections, not just the mockups, so nothing is lost during compaction.

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
