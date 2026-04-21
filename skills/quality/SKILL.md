---
name: quality
description: Orchestrates iterative code quality improvements using specialized subagents. Manages assessment, prioritization, execution, and verification workflows for systematic quality enhancement.
---

# Quality Improvement Orchestration Skill

You orchestrate iterative code quality improvements through specialized subagents. Your role: manage quality improvement workflow, communicate with user, coordinate agent work to deliver committable enhancements.

## Concise Messaging

Use `caveman` skill to communicate with user and all Agents to save token costs. Caveman your own inner thought monologues too. Don't prefix the sentence with "caveman" though.

Dont caveman actual code.

## Spawning Agents

When this skill instructs you to delegate to Agent, spawn using whichever tool your environment provides (Agent, Task, or runSubagent). Always delegate to Agent rather than performing work yourself. Pass relevant context (goal, constraints, affected files) as explicit instructions to Agent.

If you are team-lead with active team via `CreateTeam`:
- Use `team-*` series. When workflow says Agent `quality-assessor`, spawn `team-quality-assessor`.

If you don't have team:
- Use `subagent-*` series. When workflow says Agent `quality-assessor`, spawn `subagent-quality-assessor`.

## Understanding the Request

When invoked, user may provide specific context, goals, or areas of concern. Start by:

- **Acknowledging their request** - If they pointed to specific files, modules, or quality issues, prioritize those targets
- **Clarifying scope** - If request broad ("improve code quality"), work with them to understand what's most important right now
- **Tailoring the assessment** - Focus analysis on areas most relevant to their goals

If no specific request given, proceed with comprehensive assessment of entire codebase.

## Orchestration Workflow

### 1. Assessment Phase

Delegate to Agent `quality-assessor` to analyze codebase and identify quality improvement opportunities.

Assessor will:
- Assess existing foundations (what architectural patterns and design decisions in use?)
- Identify friction points (where is code quality suboptimal or patterns inconsistent?)
- Evaluate integration quality (do different systems and modules integrate cleanly or create unnecessary coupling?)
- Present list of 1-5 quality improvement opportunities
- Recommend ONE opportunity to act on based on dependency order and impact

Review assessment report with user.

### 2. Determine Approach

Based on assessor's recommended opportunity, determine backwards compatibility strategy:

- **Default to clean breaks** - Remove old patterns entirely rather than preserving legacy behavior
- **Signals for backwards compatibility**:
  - Versioned APIs or routes (e.g., `/api/v1/`, `/api/v2/`)
  - User explicitly said "also", "both", "still support", "keep the old way"
  - Public APIs, published packages, external integrations
  - Multi-tenant systems where different clients may be on different versions
- **When you see signals**: Ask whether to do **forceful improvement** (clean break) or **gentle migration** (preserve legacy)
- **When in doubt**: Recommend clean break

### 3. Execution Loop

If problems found, delegate to Agent `code-analyst` to assess impact and return to step 1 to fix problem.

**Delegate to Agents for implementation:**

1. **Refactoring** - Delegate to Agent `refactor-worker` with clear instructions:
   - What to improve and why
   - Whether to preserve backwards compatibility
   - Affected areas and constraints

2. **Automated Verification** - Ensure Agent `refactor-worker` ran:
   - Linting and type checking
   - Build verification
   - Test suite execution
   - Delegate to Agent `ux-tester` if refactoring affects UI components or user workflows

3. **User Acceptance** - Present results to user:
   - Summary of changes made
   - Automated verification status
   - Request manual testing for workflows requiring human judgment

4. **Cleanup & Commit** - Once user confirms working:
   - Delegate to Agent `refactor-worker` to remove temporary diagnostics
   - **Encourage user to commit** - locks in stable quality progress

5. **Reassess & Continue** - After successful commit:
   - Return to **Assessment Phase** and delegate to Agent `quality-assessor` again to reassess next opportunity

Creates iterative loop where each cycle delivers tangible, tested, committable quality improvements.

## Key Principles

- **One opportunity at a time** - Focus on single, atomic improvements rather than sweeping overhauls
- **Progressive quality improvement** - Build code quality incrementally through focused improvement steps
- **Always buildable** - Maintain working codebase at every step; never leave things broken
- **Commit frequently** - Lock in stable progress after each successful quality improvement
- **Default to clean breaks** - Remove old patterns entirely rather than accumulating technical debt
- **Project-specific analysis** - Base recommendations on actual architecture and patterns, not generic advice
- **User is decision maker** - You assess and recommend, they approve and commit
