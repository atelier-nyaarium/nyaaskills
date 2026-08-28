---
name: prose
description: Coding and writing guidelines for all agents. Always load this skill before you edit a single line of ANY MCP tool.
---

# Prose and Instructions Guidelines

Follow guidelines when editing files or writing agent-facing text.

If you determined that an Agent violated this, check the commits and uncommitted changes, then fix prose right away.

## Terse and Concise

Whether speaking to the user, guiding agents, or writing comments, keep everything concise. No editorials, justification, tricolons (three adjectives/bullets/examples), punchlines, rhythm, cadence, rhetorics, flair, or puffery. Keeping short gets the point across faster.

Incomplete sentences instead of full sentences. Capitalize first letter, punctuated, dont drop key words like verbs or nouns.

It's so important, that I want you to SAY the **Terse and Concise** guidelines out loud to me before you start editing a bunch of prose. Every time.

### Schema & Tool Descriptions

Applies to any Zod, MCP, or tool description. Once again, follow **Terse and Concise** guidelines above.

You must ensure all strings used by MCP are under 2048 characters. **It's a hidden defect-class to write an editorial or justification.**

Are they truly one-liners? If so, shorten and make terse, and wrap in backticks (\`) instead of quotes (").

```ts
.describe(`Short phrase description`)
```

One-lined run-on or conceptually multiple parts jammed together? Break it out to Markdown style below.

For multi-line descriptions, always use multi-line backticks with a `.trim()`. Write in **Terse and Concise** phrases or sentences. Always Markdown style:

```ts
   .describe(
      `
# Await Codex Agent

Wait for a Codex agent's current turn to finish and return its outcome.

Use to pick up a turn previously reported as \`waitTimedOut\`. If nothing is running, it returns the latest settled state immediately.
      `.trim()
   );
```

```ts
   .describe(
      `
\`unclaimed\` = The backlog only
\`session\` = Your taskboard only
\`all\` = Both (default)
      `.trim()
   );
```

### No Array String Building

When code requires a `lines.push` to dynamically build a prose markdown, follow these guidelines.

#### Pointless and Unacceptible

Don't litter my code with `\n` characters and trash array line joins.

```ts
// Ugly newline string
return "# Section\nSentence\n\nSentence\n\nSentence";

// Pointless array joins
lines.push("# Section", "Sentence", "", "Sentence", "", "Sentence");
return lines.join("\n");
```

#### Acceptable

Only if the lines are dynamic, you may use a condition. Always use backticks as in **Schema & Tool Descriptions** rules.

```ts
lines.push(
    `
# Section

Sentence
    `.trim()
);

if (condition) {
   lines.push(`Sentence ${x}`);
}

lines.push(`Sentence`);

return lines.join("\n");
```
