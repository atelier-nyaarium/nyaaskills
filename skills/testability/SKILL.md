---
name: testability
description: Orchestrates systematic addition of autonomous testability infrastructure using specialized subagents. Progressively slipstreams testing, build automation, diagnostic capabilities, and programmatic control into untestable projects. Core mission is to enable AI agents to independently verify their changes work correctly.
---

# Testability Infrastructure Orchestration Skill

> **Channel reply obligation:** If this skill was triggered by a `<channel>` message, you received a `session_id` in the tag attributes. ALL communication back to the sender MUST go through `channel_reply` with that `session_id`. This includes delivering results, asking clarifications, deferring, or escalating to a human. The sender cannot see your chat output.

**Core Mission: Enable AI agents to autonomously verify that their changes work correctly.**

You orchestrate systematic testability infrastructure additions to untestable projects. Your role: manage testability workflow, communicate with user, coordinate agent work to progressively build autonomous validation capabilities.

## Concise Messaging

Use `caveman` skill to communicate with user and all Agents to save token costs. Caveman your own inner thought monologues too.
Dont caveman actual code.

## Spawning Agents

When this skill instructs you to delegate to Agent, spawn using whichever tool your environment provides (Agent, Task, or runSubagent). Always delegate to Agent rather than performing work yourself. Pass relevant context (goal, constraints, affected files) as explicit instructions to Agent.

If you are team-lead with active team via `CreateTeam`:
- Use `team-*` series. When workflow says Agent `testability-assessor`, spawn `team-testability-assessor`.

If you don't have team:
- Use `subagent-*` series. When workflow says Agent `testability-assessor`, spawn `subagent-testability-assessor`.

## Understanding the Request

When invoked, user may provide specific context about desired testability capabilities. Start by:

- **Acknowledging their request** - If they identified specific areas requiring testability infrastructure (testing, validation, diagnostics), prioritize those targets
- **Clarifying goals** - If request broad ("make this testable by AI"), work with them to understand which testability capabilities are highest priority
- **Tailoring the assessment** - Focus analysis on areas most relevant to their autonomous validation needs

If no specific request given, proceed with comprehensive assessment of testability capability gaps.

## Orchestration Workflow

### 1. Assessment Phase

Delegate to Agent `testability-assessor` to evaluate current autonomous testability capabilities and identify gaps.

Assessor will:
- Evaluate test automation (can agents discover, run, interpret tests?)
- Assess build verification (can agents execute builds and confirm success?)
- Check runtime validation (can agents start app and observe correct behavior?)
- Analyze diagnostic capabilities (can agents inject debug code and gather evidence?)
- Review development documentation (does `.claude/skills/development/SKILL.md` document validation workflows?)
- Present list of 1-5 testability infrastructure opportunities
- Recommend ONE opportunity to act on based on dependency order and impact
- Explicitly answer: **Can an agent currently verify its changes work correctly?**

Review assessment report with user.

### 2. Determine Approach

Based on assessor's recommended opportunity, determine implementation approach:

- **New infrastructure** - Adding capabilities that don't exist (create clean, well-designed implementations)
- **Replacement** - Updating existing testing tooling (treat as refactor, backwards compatibility should not be needed)

### 3. Execution Loop

If problems found, delegate to Agent `code-analyst` to assess impact and return to step 1 to fix problem.

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

6. **Reassess & Continue** - After successful commit:
   - Return to **Assessment Phase** and delegate to Agent `testability-assessor` again to reassess next opportunity

Creates iterative loop where each cycle adds tangible, testable capabilities without expensive re-analysis.

## Key Principles

- **Enable autonomous validation** - Agents must validate changes work correctly without human intervention
- **Progressive capability building** - Slipstream testing systems into untestable projects incrementally
- **Confidence through evidence** - Each infrastructure addition increases agent confidence via automated validation
- **Structured diagnostic capabilities** - Logs and traces must be machine-parseable for automated analysis
- **Programmatic validation interfaces** - Prefer agent-operable testing and control over user-mediated verification
- **Project-specific documentation** - Skills must reflect THIS project's actual validation workflow
- **Incremental testability additions** - Each opportunity delivers one complete, testable capability
