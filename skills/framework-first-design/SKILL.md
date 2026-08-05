---
name: framework-first-design
description: Identifies missing or incomplete architectural patterns in a codebase and proposes framework-level solutions. Transforms vibe-coded or partially-engineered codebases into well-structured systems built on recognized paradigms.
---

# Framework-First Design Skill

**Core Mission: Identify framework a codebase needs but does not have.**

Assess what exists, recognize what it tries to be, propose abstractions that would make codebase maintainable and extensible.

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster.

## Engineering Standard

Highest quality only. "Overkill", "YAGNI", and "weeks of work" is not a valid objection. Design well once so we never sit at THIS drawing board again. Reject "good enough." Reject patches that mask structural defects. Choose patterns or paradigm that fits the domain, not the one that ships fastest.

## Extensibility

Extensibility is how cheap the next feature is. A strong framework absorbs a new feature as one registration or one config entry. A weak one demands similar edits across N files, and every N-file feature is the next defect class forming.

Measure it with three questions:

- **What does the next thing cost?** Count the files touched to add the canonical new thing: a content type, an entity, a command. One registration is the target. A checklist of edits is a framework asking to be built.
- **The consumer test.** Can code outside the framework extend the system without editing framework internals? Answer from the API surface: if registering means editing a framework enum or switch, the answer is no.
- **Bypassed is worse than missing.** Code doing by hand what an extension point exists to do. The architecture says growth goes through this point, and its own codebase went around it. Report it as a misalignment, and route the bypasser through the point before building anything new.

## Defect Classes

A defect class is every defect sharing one structural cause. A patch removes one defect instance. A design change makes the defect class inexpressible: the code path where the mistake lived does not exist, or the compiler rejects it.

Three grades, by where they fail:

**Bug class:** Fails at runtime. Multiple instances where the same bug is being experienced.

- "Forgot to call refresh()" is not one bug. Every call site is another instance.
- Two write paths that can disagree.
- Eliminated when one write path exists and desync is inexpressible.

**Structural defect class:** Fails on change. Nothing misbehaves today, but the code cannot absorb an edit cleanly.

- **Duplication.** The same edit must land in N places, and eventually you forget one. Copy-paste registration, parallel implementations.
- **Fragility.** Fixing one spot breaks another. Whack-a-mole, where coupling has no ownership boundary to stop a change propagating.
- Eliminated when the N places become one, or when an ownership boundary contains the change.

**Misalignment class:** Fails in interpretation. Nothing crashes. The human and the agent build on the lie, and what they write becomes instances of the other two grades.

- Comments, docs, and names that say something the code does not do.
- A `validateUser()` that secretly mutates.
- A comment claiming "sorted by date" but the list is still unsorted.
- A CLAUDE.md rule describing a build step that does not exist.
- Eliminated by refactor renaming to tell the truth, or updating the docs.

## Time is Cheap, Bandaids are Costly

Cut the time estimates. Don't let time influence your design decisions. Always take as much time as you need to do things right.

I literally do not care how long you estimate something to take. Don't get lazy and defer work because it "takes weeks to accomplish". You literally arent human and you complete months of works in mere hours easily.

## Agents

**With `Workflow()`,** author the fan-out.

- Fan out with `parallel()`/`pipeline()`; One agent per subsystem or pattern family.
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
  - If **Capabilities** list Codex, use Luna for *fan outs* (like Explore/Analyze/Audit), and Opus for *joins* (Synthesis). 
- Give each a schema so it returns data, not prose.
- Synthesis: Dedup across dimensions, rank survivors.

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated. A confident tone is not evidence; verify against the code.

Each agent maps its slice per **Assessment Dimensions** below.

**Without `Workflow()`,** spawn the standing assessor: Agent `team-framework-first-assessor` if you are team lead via `CreateTeam`, otherwise Agent `subagent-framework-first-assessor`. It cannot see the conversation, so pass the request, your recalled pain points, and what is ruled out. Anything you omit is lost to it.

Spawn Agent `refactor-worker` and `ux-tester` directly via Agent, Task, or runSubagent, picking `team-*` or `subagent-*` by the same rule.

## Assessment Dimensions

Framework design is in one of three states:

- **Zero**: no framework. State scattered, mutations direct, no extension points. Find the patterns hiding in the chaos and name them.
- **Partial**: attempted clean architecture that broke under pressure. Patterns half-built or bypassed. Identify what was started, what is missing, what completing would unlock.
- **Full**: well-designed custom framework, nothing to complain about.

Map the architecture:

- **State**: where does state live? Centralized or scattered across files?
- **Mutations**: how are writes performed? Single write path, or different files mutate state directly?
- **Extension**: extension points (registries, hooks, config-driven behavior), or every feature hardcoded?
- **Repetition**: what patterns repeat? Same shape of code in multiple places is an unnamed abstraction waiting to be extracted.
- **Fragility**: what breaks when requirements change? Fragile areas reveal missing ownership boundaries.

For each pattern found: name it by recognized paradigm, assess completion (roughly 0-100%), note what is missing or broken, note what completing would unlock.

For Zero codebases, also identify what SHOULD exist based on the problem domain. An app managing state multiple consumers read needs a consistent write path. An app persisting data needs a storage strategy.

### Recognizing Patterns

Common paradigms worth looking for. Not exhaustive; domain-specific patterns also exist. Name anything you recognize.

- **Event Sourcing**: mutations recorded as ordered log, current state derived by replay. Unlocks audit trails, recovery, time travel, peer catch-up. An undo system, changelog, or any action history is partial Event Sourcing.
- **CQRS**: write path and read path separated. Commands mutate through a single authority; queries read without side effects. APIs mixing reads and writes in the same functions need CQRS.
- **Reactive bindings**: derived state (UI, caches, computed values) updates automatically when source data changes. Manual `update()` or `refresh()` calls sprinkled across the UI layer signal the need.
- **Schema-first**: data shapes declared explicitly, with validation, migration, and documentation derived from the schema. Implicit shapes existing only as object literals signal the need.
- **Content-addressed storage**: objects keyed by hash of content. Identical content deduplicates, immutable by definition. Versioned data or dedup needs benefit from CAS.
- **Actor model**: entities own their state and communicate only through messages, no shared memory. Race conditions, shared mutable state, or functions reaching into other modules' internals signal the need for actor-style isolation.
- **Declarative configuration**: behavior defined by config rather than imperative code. New features added by writing config, not new code paths. Adding an entity type by touching multiple files with similar boilerplate signals the need for declarative registration.

### What Synthesis Returns

- 1-5 architectural improvements, each with name, description, impact, scope, and dependencies.
- ONE recommendation with rationale and implementation notes for the extraction agent.

Rank by:

- **Defect-class elimination**: which entire class (see **Defect Classes**) becomes inexpressible once the pattern is in place? Erasing a class outranks tidying its instances.
- **Unification**: completing a pattern that merges multiple separate implementations into one code path is high value.
- **Complete over create**: finishing a half-built pattern costs less and delivers more than starting a new one.
- **Dependency order**: a consistent write path must exist before journaling it; a schema before versioning it. Foundations first.
- **Impact**: patterns unblocking the most future work or eliminating the most ad-hoc code.

## Understand the Request

When invoked, user may describe specific pain points, or may just point you at codebase. Start by:

- **If they describe pain:** Pain points are symptoms. Underlying cause usually missing or incomplete pattern. Focus analysis there first.
- **If they point at codebase:** Proceed with full audit. Codebase will tell you what is wrong.
- **If they name specific pattern they want:** Verify whether codebase is ready for that pattern. Some patterns depend on others being in place first.

## Signals a Framework Is Missing

Two tells in the code itself, independent of any pain you remember:

- **Magic** - If an expression needs a comment to explain it, framework is missing a concept. Build concept, name it, give it method.
- **Same operation, different hats** - If several features are the same operation wearing different costumes, they want one code path, not N similar ones.

## Procedure

### 0. Recall Pain Points

If you've been working with the codebase prior to this audit, think of pain points you've experienced this session:

- The same bugs you ran into and bandaided multiple times in a row.
- Fragile design that you had to carefully tread around, or brute force by user or unit test acceptance.
- Comments, docs, names, or AI/CLAUDE.md rules that misled you about what the code does. That is a misalignment class, and it is worth reporting on its own.
- Anything else that bothered you about the codebase.

Each of these is likely an instance of a defect class. Carry all of it into the assessment; it is context no fresh agent can recover on its own.

### 1. Assessment Phase

Fan out per the Agents section above. Forward your recalled pain points into the prompts.

You want 1-5 architectural improvements and ONE recommendation, ranked per **Assessment Dimensions**. Map the dependency graph before choosing what to build first.

### 2. Framework Proposal

For recommended pattern, design framework component that would own it. Proposal should include:

- **What it owns:** What state, behavior, or guarantees does this component provide?
- **What the API looks like:** How does application code interact with it? Show before-and-after code.
- **What it replaces:** What ad-hoc code gets deleted once this component exists?
- **What it unlocks:** What becomes possible or trivial once this is in place?

Ownership test: if application were replaced with different one built on same framework, would this component still make sense? If yes, belongs in framework. If no, belongs in application.

❓ Present proposal to user for approval before proceeding.

### 3. Extraction

Once user approves, execute one pattern at a time:

1. **Extract:** Delegate to Agent `refactor-worker` to build framework component and migrate existing code to use it. Instruction must be specific: what to build, what existing code to replace, how application code should call new API.

2. **Verify:** Ensure Agent `refactor-worker` ran linting, type checking, build verification, and test suite. Delegate to Agent `ux-tester` if change affects user-facing behavior.

3. **User acceptance:** Present result: what was built, what was removed, what codebase looks like now. ❓ Request manual testing for anything requiring human judgment.

4. **Commit:** Once user confirms it works, encourage them to commit. Locks in structural improvement.

If what shipped meaningfully moved the picture, recommend another lap and name what you would look at next. A new framework component often lifts other patterns off zero by giving them a foundation they lack.
