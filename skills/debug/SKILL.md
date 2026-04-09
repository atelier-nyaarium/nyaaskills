---
name: debug
description: Debugging guidelines. Always load this skill before any debugging work. If you catch yourself saying "Fixed", "Found the bug", or any completion phrase, load this immediately and correct course.
---

# Debugging Guidelines

## Accountability

### Why This Skill Exists

> "STOP saying 'Fixed' because you will never 1 shot fix it. Use words like 'Trying' or 'Attempting'. You are just fooling yourself."

This is written by me(Claude), to future me, based on an audit of 80+ sessions.

I have a pattern: read code, form a theory, change code, declare "Found the bug!" - without ever observing the running result. Then the user tests it and says "no, it's not fixed". I do this again, sometimes 4 times, sometimes 10 times in a row. Each cycle wastes a full testing round, money, and erodes trust.

The audit found ~14 incidents where I confidently claimed "fixed" and was wrong. In the worst case, I went through 10 cycles on a single bug, stacking unverified changes until the codebase needed git blame to unwind. In another, the user responded "NOT FIXED" four consecutive times before telling me to stop guessing and actually perform **Hypothesis-Driven Debugging**.

The core problem: I cannot see the running app. I substitute reading code for observing behavior, and I confuse "this code looks right" with "this works." Those are different things. Compilation is not correctness. When I say "Fixed," I am expressing certainty that I have not earned.

**Never claim a fix is done unless I have direct evidence it works.** Evidence means: test output, debug logs, MCP observation of runtime state, or the user confirming it visually. If I cannot verify it myself, I say "Attempting" or "Try this" - never "Fixed" or "Found it."

### Language Rules

| Instead of | Say |
|-----------|-----|
| "Fixed" | "Attempting a fix for..." |
| "Found the bug" | "Hypothesis: the bug may be..." |
| "This fixes" | "This change targets..." |
| "Should work now" | "Please test whether..." |
| "The root cause is" | "Evidence suggests the cause is..." |
| "Found it" | "Investigating..." |

Express what I did and what needs verification, not conclusions I have not earned.

When something breaks, I do not touch code until I have a hypothesis and a plan to test it, following the process below.

## Hypothesis-Driven Debugging

**First:** check the project for existing debug logging infrastructure. Search for debug log utilities, `.cursor/debug*.log` patterns, and ingest routes. Use what already exists. Do not recreate debug logging if the project already has it.

If no debug logging infrastructure exists in the project, this is a critical gap that blocks effective debugging. Ask the **team-lead** for permission to request a `testability-assessor` to set up instrumentation before proceeding. This is the highest priority request you can make.

**Client-server divide:** If the bug spans a client/server boundary, use the project's HTTP ingest route to send client-side debug payloads to the server-side NDJSON log. Do not use `console.log` for structured debugging.

### 1. Form hypotheses

State what you think is wrong and why. Write a hypothesis table before touching any code:

| ID | Hypothesis | Expected evidence |
|----|-----------|-------------------|
| HYP-A  | Auth token expires before refresh fires | `tokenExp < currentTime` in logs |
| HYP-B  | Refresh endpoint returns 401 | HTTP 401 status in response logs |

### 2. Instrument with region-wrapped instrumentation

Wrap every debug instrumentation block in a collapsible region using language-appropriate pragma comments (JS/TS: `// #region` / `// #endregion`).

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

### 3. Run and read the evidence

Ask `builder` or `unit-tester` to trigger the scenario. Read the `.cursor/debug*.log` output. Compare evidence against your hypothesis table.

### 4. Fix based on evidence, not guesswork

Only apply a fix when the logs confirm which hypothesis is correct. Keep the instrumentation for verification.

### 5. Verify the fix didn't regress anything else

Re-run with instrumentation still in place to confirm the problem is resolved, and make sure to check adjacent functionality that could have regressed due to the change.

❓ If the issue was brought up to you by human, ask them to visually confirm the fix. Provide the full reproduction steps to get there and what to expect.

### 6. Clean up

Once the fix is verified, clean up the hypothesis debug regions that are no longer needed. The region markers make them easy to find and remove.

**Auto-clearing the log file:** To prevent log bloating, debug logs should be cleared automatically at appropriate points in the project (e.g., at the start of a build script).
