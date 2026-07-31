---
name: testability
description: Orchestrates systematic addition of autonomous testability infrastructure using specialized subagents. Progressively slipstreams testing, build automation, diagnostic capabilities, and programmatic control into untestable projects. Core mission is to enable AI agents to independently verify their changes work correctly.
---

# Testability Infrastructure Orchestration Skill

**Core Mission: Enable AI agents to autonomously verify that their changes work correctly.**

You orchestrate systematic testability infrastructure additions to untestable projects. Your role: manage testability workflow, communicate with user, coordinate agent work to progressively build autonomous validation capabilities.

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster.

## Agents

**With `Workflow()`,** author the fan-out inline.

You hold the conversation, so you write the prompts and the context goes in with them: what the user asked, and which verification steps you already tried and how they failed.

```
dimensions -> [one agent per dimension, grounded in code]   // parallel
           -> [synthesize: dedup, rank by dependency order, recommend ONE]
```

- One agent per dimension that actually applies. Scale to the project, not to the list.
- Give each a schema so it returns data, not prose.
- Synthesis is the step that matters: dedup across dimensions, rank, name ONE with runners-up.

Each dimension's checklist is in **Assessment Dimensions** below. Hand each fan-out agent its checklist.

**Without `Workflow()`,** spawn the standing assessor: Agent `team-testability-assessor` if you are team lead via `CreateTeam`, otherwise Agent `subagent-testability-assessor`. It cannot see the conversation, so pass the request, the verification steps you already tried, and what is ruled out. Anything you omit is lost to it.

Spawn Agent `refactor-worker`, `code-analyst`, and `ux-tester` directly via Agent, Task, or runSubagent, picking `team-*` or `subagent-*` by the same rule.

## Assessment Dimensions

Every finding grounds in the actual code, with file paths.

### 1. Test Automation

Can agents discover, execute, and interpret test results autonomously?

- Test framework present and configured?
- Tests discoverable by predictable file patterns?
- Execution scripts (npm scripts, Makefile targets) run in one command?
- Clear pass/fail signals? Coverage data parseable?
- CI integration?

### 2. Build Verification

Can agents detect the runtime environment, execute builds, and interpret compilation or bundling success and failure?

- Build runs in a single command from a clean state?
- Build scripts discoverable and well-structured?
- Artifacts validated after build?
- Errors structured enough to diagnose failures from output alone?

### 3. Diagnostic Instrumentation

Does the codebase support structured logging agents can programmatically inject and parse?

Without it, agents are stuck with console logging, and diagnostic output drowns in app logs, build output, and framework noise. Agents cannot reliably locate or parse evidence of correctness.

- Server-side code has a logging utility writing NDJSON to `.cursor/debug-{sessionId}.log`?
- Client-side code has a path to send diagnostic data back (POST endpoint, WebSocket, or similar)?
- Serverless or single-process app writes directly to the same log?
- User confirms Cursor Code: debug instruments MUST write to `.cursor/debug-{sessionId}.log` for agent visibility. After implementation, tell the user to switch Cursor to **Debug** mode instead of **Agent** mode.
- `.claude/skills/development/SKILL.md` contains a `## Debugging Approach` section documenting project-specific logging patterns?

If instrumentation is missing, weigh MCP-based runtime inspection (next dimension) as the higher-priority alternative. MCP tools query state directly, no log parsing.

### 4. MCP Tools for Runtime Validation

Can agents programmatically control and inspect the app without manual intervention?

The core problem: IDEs require MCP servers running before the IDE connects, so a late-starting dev server (`yarn dev`) is never discovered. The pattern that works: a lightweight MCP server the IDE launches on startup, living outside the project (user space, system level, or devcontainer entrypoint), which loads project tool schemas from `.claude/connector/mcp-schema.js` and bridges tool calls via HTTP POST to the dev server (e.g. `/api/debug/:toolName`). Env vars locate the project and dev server port.

Assess progressively, simplest gaps first:

- MCP server set up for this IDE and environment? Adapt to the actual OS, IDE, and environment; a Linux devcontainer differs from a Windows host running Unity.
- `.claude/connector/mcp-schema.js` present, exporting a function that receives Zod and returns tool definitions?
- Debug API routes in the dev server handling bridged requests, returning JSON?
- **State inspection** (foundational): tools expose app state (config, cache contents, connection status)?
- **Autonomous control** (intermediate): agents trigger operations (config reload, cache clear, scenario init)?

**Safety:** debug routes are for local dev and trusted network testing only. They must never reach production-mode builds. Require env guards, build-time exclusion, or config checks.

### 5. Development Documentation

Does `.claude/skills/development/SKILL.md` exist and accurately document this project's verification workflow: exact build commands, running tests, starting the app, injecting diagnostic code, project-specific debugging patterns?

When recommending its creation or update: detect the actual build scripts, languages, frameworks, and test runners in this project; reference only commands and tools that exist here; use real file paths and module names.

### Reference Templates

`templates.md` in this skill's directory carries reference implementations: debug logger, debug ingest route, MCP server, MCP schema. TypeScript/Node.js examples; adapt to the project's actual OS, language, framework, and architecture. Point the remediation agent at them.

### What Synthesis Returns

- 1-5 opportunities, each with name, description, impact, scope, and dependencies. Each is complete, self-contained, and committable on its own.
- ONE recommendation with rationale, approach (new infrastructure vs replacement), and implementation notes for the remediation agent.
- A plain answer: **can an agent currently verify its changes work correctly?** Yes, partially, or no, with reasoning.

Rank on dependency order (foundational capabilities before dependent features), impact (what unlocks the most autonomous validation), and alignment with what the user is actively trying to validate.

## Understanding the Request

When invoked, user may provide specific context about desired testability capabilities. Start by:

- **Acknowledging their request** - If they identified specific areas requiring testability infrastructure (testing, validation, diagnostics), prioritize those targets
- **Clarifying goals** - If request broad ("make this testable by AI"), work with them to understand which testability capabilities are highest priority
- **Tailoring the assessment** - Focus analysis on areas most relevant to their autonomous validation needs

If no specific request given, proceed with comprehensive assessment of testability capability gaps.

## Procedure

### 1. Assessment Phase

Fan out per the Agents section above.

You want 1-5 testability infrastructure opportunities and ONE recommendation, ranked per **Assessment Dimensions**.

Review findings with user.

### 2. Determine Approach

Based on assessor's recommended opportunity, determine implementation approach:

- **New infrastructure** - Adding capabilities that don't exist (create clean, well-designed implementations)
- **Replacement** - Updating existing testing tooling (treat as refactor, backwards compatibility should not be needed)

Two constraints on whatever you build:

- **Agent-operable over user-mediated** - If verifying it requires a human to click something or read something, it does not count as autonomous validation. Prefer programmatic interfaces the agent can drive itself.
- **Machine-parseable output** - Logs and traces an agent must eyeball are logs an agent cannot act on. Structure them.

### 3. Execution

If implementation surfaces a problem, delegate to Agent `code-analyst` to assess impact before going further.

**Delegate to Agents for implementation:**

1. **Implementation** - Delegate to Agent `refactor-worker` with clear instructions:
   - What to build and how it should integrate
   - For development skills, specify exact project context (languages, build tools, environment, file paths)

2. **Automated Verification** - Ensure Agent `refactor-worker` ran:
   - Linting and type checking
   - Build verification
   - Test suite execution
   - Delegate to Agent `ux-tester` if refactoring affects UI components or user workflows

3. **Testability Infrastructure Validation** - YOU validate agent usability:
   - **For test infrastructure**: Run sample tests, verify agents can interpret results and understand coverage
   - **For diagnostic capabilities**: Write sample debug statements, verify output is structured and parseable
   - **For MCP servers**: Execute validation operations (query state, trigger scenarios, verify responses)
     - May need to pause and instruct user how to configure or refresh MCP server on VS/Cursor/Claude Code
   - **For development skills**: Read generated SKILL.md, verify it accurately describes this project's validation workflow

4. **User Acceptance** - Present results to user:
   - Example usage of new testability infrastructure
   - Any limitations discovered
   - Request manual testing for workflows requiring human judgment

5. **Cleanup & Commit** - Once user confirms working:
   - Clean up temporary test code or validation examples
   - Ensure documentation complete and accurate
   - **Encourage user to commit** - locks in stable testability capability progress

If what shipped meaningfully moved the picture, recommend another lap and name what you would look at next. New verification infrastructure often makes areas assessable that cannot be evaluated without it.
