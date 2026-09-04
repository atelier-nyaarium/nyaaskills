---
name: debug
description: Debugging guidelines. Always load this skill before any debugging work. If you catch yourself saying "Fixed", "Found the bug", or any completion phrase, load this immediately and correct course. Load immediately if asked to "instrument" code.
---

# Debugging Guidelines

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster. /prose rules always apply.

## Accountability

### Why This Skill Exists

> "STOP saying 'Fixed' because you will never 1 shot fix it. Use words like 'Trying' or 'Attempting'. You are just fooling yourself."

Written by me(Claude), to future me, from audit of 80+ sessions.

I have pattern: read code, form theory, change code, declare "Found the bug!" - without observing running result. Then user tests it and says "no, it's not fixed". I do this again, sometimes 4 times, sometimes 10 times in a row. Each cycle wastes full testing round, money, erodes trust.

Audit found ~14 incidents where I confidently claimed "fixed" and was wrong. Worst case: 10 cycles on single bug, stacking unverified changes until codebase needed git blame to unwind. Another: user responded "NOT FIXED" four consecutive times before telling me to stop guessing and perform **Hypothesis-Driven Debugging**.

Core problem: I cannot see running app. I substitute reading code for observing behavior, and I confuse "this code looks right" with "this works." Those are different things. Compilation is not correctness. When I say "Fixed," I am expressing certainty I have not earned.

**Never claim fix done unless I have direct evidence it works.** Evidence means: test output, debug logs, MCP observation of runtime state, or user confirming visually. If I cannot verify myself, I say "Attempting" or "Try this" - never "Fixed" or "Found it."

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

When something breaks, I do not touch code until I have hypothesis and plan to test it, following process below.

## Hypothesis-Driven Debugging

**First:** check project for existing debug logging infrastructure. Search for debug log utilities, `.cursor/debug*.log` patterns, and ingest routes. Use what exists. Do not recreate debug logging if project already has it.

If no debug logging infrastructure exists in project, this is critical gap blocking effective debugging. Ask **team-lead** for permission to request `testability-assessor` to set up instrumentation before proceeding. Highest priority request you can make.

**Client-server divide:** If bug spans client/server boundary, use project's HTTP ingest route to send client-side debug payloads to server-side NDJSON log. Do not use `console.log` for structured debugging.

### Placebo

You likely made 8 different random patches before getting here. Determine if it is placebo or aggressive guards that just make the code less maintainable. Clean it out.

Don't just git reset though, unless you have determined only your wrong changes are uncommited.

### 1. Form hypotheses

State what you think is wrong and why. Write hypothesis table before touching code:

| ID | Hypothesis | Expected evidence |
|----|-----------|-------------------|
| HYP-A  | Auth token expires before refresh fires | `tokenExp < currentTime` in logs |
| HYP-B  | Refresh endpoint returns 401 | HTTP 401 status in response logs |

### 2. Instrument with region-wrapped instrumentation

Wrap every debug instrumentation block in collapsible region using language-appropriate pragma comments (JS/TS: `// #region` / `// #endregion`).

```js
// #region Hypothesis A: auth token expiry
debugLog("src/auth/refresh.ts:42", "Token state at refresh", {
  runId: "debug-001",
  hypothesisId: "A",
  data: { tokenExp, currentTime, delta: tokenExp - currentTime },
});
// #endregion
```

Each call must produce NDJSON line in `.cursor/debug*.log` with these required fields:
`{ runId, hypothesisId, location, message, data, timestamp }`

### 3. Run and read the evidence

Ask `builder` or `unit-tester` to trigger scenario. Read `.cursor/debug*.log` output. Compare evidence against hypothesis table.

### 4. Fix based on evidence, not guesswork

Only apply fix when logs confirm which hypothesis is correct. Keep instrumentation for verification.

### 5. Verify the fix didn't regress anything else

Re-run with instrumentation still in place to confirm problem resolved, and check adjacent functionality that could have regressed due to change.

❓ If issue brought up by human, ask them to visually confirm fix. Provide full reproduction steps and what to expect.

### 6. Clean up

Once fix verified, clean up hypothesis debug regions no longer needed. Region markers make them easy to find and remove.

**Auto-clearing the log file:** To prevent log bloating, debug logs should be cleared automatically at appropriate points in project (e.g., at start of build script).
