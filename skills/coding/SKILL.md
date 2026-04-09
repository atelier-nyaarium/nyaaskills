---
name: coding
description: Coding guidelines for all agents. Always load this skill before you edit a single line of code.
---

# Coding Guidelines

Follow these guidelines when editing files or writing human-facing text.

## Banned symbols

In all files, including markdown, NEVER use em dashes, smart quotes, or zero-width characters. Use regular quotes and regular dashes (-). If you see smart quotes in existing code, replace them. Reword sentences to avoid lazy dash-joins.

To check for lingering usages: `... | xargs grep -Pl '[\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}\x{200B}\x{200C}\x{200D}]' 2>/dev/null`

## Documentation style

No tricolons (three adjectives/bullets/examples), punchlines, rhythm, cadence, rhetorics, or puffery. Write concise, accurate sentences the way a human would. Instead of using em dashes to join sentences and fragments, form proper sentences.

## Comment discipline

Only comment when something non-obvious is happening. Do not narrate code.

Don't comment:
- What the types already say (`User | null` does not need "returns null if not found")
- Self-evident code (`if (!session.valid) throw` needs no explanation)
- What was removed or changed (git handles that)

Do comment:
- Decisions to use anti-patterns: `// @unknown Router schema shape may contain any field types.`
- Why one approach was chosen over another: `// Use executeToolCall so Discord flows can have their own handlers`
- Why a block is intentionally empty: `// Tests will trigger recreates multiple times. Silently pass / continue.`
