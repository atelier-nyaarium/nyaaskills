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

## Hypothesis-driven debugging

When something breaks, do NOT blindly apply fixes and declare "I fixed it!" You must prove your fix works through structured hypothesis testing.

**First:** check the project for existing debug logging infrastructure. Search for debug log utilities, `.cursor/debug*.log` patterns, and ingest routes. Use what already exists. Do not recreate debug logging if the project already has it.

If no debug logging infrastructure exists in the project, this is a critical gap that blocks effective debugging. Ask the **team-lead** for permission to request a `testability-assessor` to set up instrumentation before proceeding. This is the highest priority request you can make.

**Client-server divide:** If the bug spans a client/server boundary, use the project's HTTP ingest route to send client-side debug payloads to the server-side NDJSON log. Do not use `console.log` for structured debugging.

The process:

1. **Form hypotheses:** State what you think is wrong and why. Write a hypothesis table before touching any code:

   | ID | Hypothesis | Expected evidence |
   |----|-----------|-------------------|
   | A  | Auth token expires before refresh fires | `tokenExp < currentTime` in logs |
   | B  | Refresh endpoint returns 401 | HTTP 401 status in response logs |

2. **Instrument with region-wrapped debug logs:** Wrap every debug instrumentation block in a collapsible region using language-appropriate pragma comments (JS/TS: `// #region` / `// #endregion`).

   ```js
   // #region Hypothesis A: auth token expiry
   debugLog("src/auth/refresh.ts:42", "Token state at refresh", {
     runId: "debug-001",
     hypothesisId: "A",
     data: { tokenExp, currentTime, delta: tokenExp - currentTime },
   });
   // #endregion
   ```

   Each call must produce an NDJSON line in `.cursor/debug*.log` with these required fields:
   `{ runId, hypothesisId, location, message, data, timestamp }`

3. **Run and read the evidence:** Ask `builder` or `unit-tester` to trigger the scenario. Read the `.cursor/debug*.log` output. Compare evidence against your hypothesis table.

4. **Fix based on evidence, not guesswork:** Only apply a fix when the logs confirm which hypothesis is correct.

5. **Verify the fix:** Re-run with instrumentation still in place. Confirm the problematic evidence is gone.

6. **Clean up:** Once the fix is verified, clean up the hypothesis debug regions that are no longer needed. The region markers make them easy to find and remove.

**Auto-clearing the log file:** Debug logs should be cleared automatically at appropriate points in the project (e.g., at the start of a build script, via an MCP tool call). The project's debug infrastructure should handle this. If it does not, flag it.
