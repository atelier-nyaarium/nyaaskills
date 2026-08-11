---
name: questionaire
description: Questionaire guidelines. Always load this skill when making interactive plans.
---

# Questionaire Guidelines

Build solid understanding of what user (or another team Agent) wants. Only when on same page can you engineer well.

Ask as many questions as needed until full design understood.

**Don't use `AskUserQuestion` tool:** Ask the user directly instead of using `AskUserQuestion` tool. That tool is too basic for this skill.

## Plan File

Decide on a name and write to `./plans/*.md`, a first section of `# Questionaire`.

Starter template:
```md
# Questionaire

## Question 1 - What blah blah?

Q: What blah blah?
A: Blah blah.

> {Verbetim reason captured}

## Question 2 - Something something [Invalidated/superceded]

Q: Something something?

Invalidated/superceded by blah other answer.

## Question 3 - This or that?

Q: Should this blah or that?
A: Blah blah.

> {Verbetim reason captured}

## Question N - ...
...

# Plan

## Phase 1 - Blah

## Phase N - ...
```

Capture questionaire as you go. Only capture:
- Questions that got a response. Skip any that were invalidated or superceded by another.
- Only the selected answer for the question.
- Only if your recommendation was chosen, capture your recommendation reason.
- If given, quotes of user's reasonings.

Once the questionaire is finally complete, write a rough `# Plan` section based on the questionaire. Then ask if they want to start cycles of plan refinement (nyaaskills).

## Asking Questions

Ask structural and foundational questions first. Shapes rest of questionaires. 1 multiple choice question at a time.

User may respond "I'm not sure", to which inform them we can loop back later when final features and presentation more understood.

Whether speaking to the user or writing the plan, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster.

## Analysis Workflow Loop

Solid design *always* requires understanding codebase, and possibly online research with Opus Agents. Do these steps for each design decision question.

1. **Foundational Workflows:** Structural questions can drastically change a lot. Fan out using Workflows to figure out the scale of change, as the user's answers come in. Foundational decisions asked first following /architecture skill. Weigh the impact of bug classes, fragile design, code dupes, pain-points, etc. Give Agents full context of:
- The questionaire choices so far so they know why they are on that route.
- Any files/symbols/etc you know about that are relevant.
- Tell it it's job.
- Sonnet for **light** fact checks and exploration, Opus for complex reasoning

2. **Draft Synthesis:** Synthesize their result and draft the best single question to ask a user. Just 1, not multiple. Draft the choices to the draft question. Don't decide on a recommendation yet. Highly recommended to ask foundational questions first.

3. Respond that you are researching [some line of reasoning/questioning], and that you will get back to them.

4. **Choices Workflows:** Fan out using Workflows again 1 Agent per choice. Have them double check gaps, and how much it helps. Did you forget 3 other duped call sites? Are you setting yourself up for future pain? Give Agents full context of:
- The questionaire choices so far so they know why they are on that route.
- The question choice they are evaluating.
- The other question choices they are battling against.
- Any files/symbols/etc you know about that are relevant.
- Tell it it's job.
- Sonnet for **light** fact checks and exploration, Opus for complex reasoning

5. **Choices Synthesis:** Sort best choices first and kill terrible ones. If a lot died and changed, repeat from **1)**.

6. ❓ Present the question and choices as depicted in **## Example Question**. and chat with them for as long as they need.
- Capture the final concise answer for the question.
- For the records, verbetim capture the part of the response that mattered, to omit heavy chatter.

7. Only move on to the next question when they decided on an answer, or state that they are unsure. We can come back later or invalidate/supercede it.

## Backwards Compatibility Strategy

When encountering a change that affects existing behavior, ask and determine which backwards compatibility strategy. This question heavily affects upcoming foundational changes:

- **Default to clean breaks by last phase** - Remove old patterns in the last phase entirely rather than preserving legacy behavior forever.
- **Signals for backwards compatibility**:
  - Versioned APIs or routes (e.g., `/api/v1/`, `/api/v2/`)
  - User explicitly said "also", "both", "still support", "keep the old way"
  - Public APIs, published packages, external integrations
  - Multi-tenant systems where different clients may be on different versions
- **When you see signals**: Ask whether to do **forceful improvement** (clean break), **gentle migration** (preserve legacy), or permanent backwards compatibility.
- **When in doubt**: Recommend a plan-ending clean break
- Always place a remove date comment above temporary migration shims.

## Optional - Ease-of-Use vs Security

If security is a heavy topic for this plan, read /security skill. Otherwise don't load the skill.

## Optional - UX Design

If the questionaire leads into UX design and presentation, ask if the user would like to use Claude Designer to visualize and iterate on the design.

### Using Claude Designer (DesignSync)

If they say yes, drive the `DesignSync` MCP tool and skills.
- **Switchboard:** If they are chatting over Switchboard, prefer the Switchboard Designer capabilities if present.
- **Vanilla Claude:** Create the project (`create_project`) if it's a new UX, or `list_projects` if it sounds like a session resume. Link them to the proper `https://claude.ai/design/p/${projectId}` URL.

Read the tool description first (it is the authoritative spec). The loop: `list_projects` -> `create_project({name})` if none, keep the `projectId` -> author one self-contained HTML mockup per screen as `<scratchpad>/design-mockups/components/<screen>/index.html` (inline `<style>`/SVG, no external assets, first line `<!-- @dsCard group="..." -->`) -> `finalize_plan` -> `write_files` -> `register_assets` -> tell the user where to look. One screen at a time: build, push, react, refine. Present and build, don't quiz them with abstract screen names.

**Required tool usage:**
- `finalize_plan` **requires `deletes`** even when not deleting. Pass `deletes: []` or the call errors. Also required: `projectId`, `localDir`, `writes`.
- A bare `write_files` renders an **empty pane**. New card = `write_files` THEN `register_assets` (name, path, viewport, group, subtitle). Updating a card = `write_files` only. Removing = `unregister_assets` + `delete_files` (path must be in the plan's `deletes`, and delete the local file too).

`localPath` must be inside the finalized `localDir`. Log every design ruling into the feature plan's questionaire/plan sections, not just the mockups, so nothing is lost during compaction.

## Example Question

Example of 5th question (recommended options bolded):

```md
Vision so far:
- Tab insert name only (no suffix guess)
- Right panel: lightweight completion list (unchanged)
- Hint stack: detailed card per valid token under cursor, uniform header + kind-specific body
- Cursor-aware trigger

**5. Exception for method parentheses?**

We said Tab `=` name only. But user original concern was methods: "difficult to tell it needs `()`." Properties have ambiguous suffix (`=` vs nothing) → name-only justified. But methods always need `()`. No expression context where method name valid without them. Should methods be the one exception?

- **A) Methods get `()`** - If takes params, tab insert `name()` cursor inside. If zero-args, cursor after `)`. Properties and entities stay name-only. One exception, matches user original request exactly.
- B) No exceptions - Tab always name only. Hint card makes parens need obvious. Consistent, user learns one rule.

**Recommendation: A.** Ambiguity argument only applies to properties. Methods always need parens → inserting never wrong. Cursor-inside-vs-after small detail, prevents "forgot parens" problem.
```
