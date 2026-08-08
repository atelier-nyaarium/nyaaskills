---
name: file-splitting
description: Splitting oversized source files across a whole codebase without changing behavior. Load this skill when files are too long to navigate, when a cleanup pass has to move code at scale, or before splitting any single large file. Covers the move-versus-redesign distinction, the proof that a move was faithful, and the defect classes that only appear at this scale.
---

# File Splitting Skill

**Core Mission: move code so every file names what it OWNS, and prove nothing changed while doing it.**

A long file is a navigation problem. Splitting it is mechanical work with a nasty property: every failure mode is silent. Lint passes, tests pass, and the defect is a dropped comment, a widened member, or an export that quietly vanished. This skill is about the proofs, not the moves.

Follow /coding for everything you write. Follow /architecture when the answer turns out to be a redesign rather than a move.

## Split by responsibility, never by line count

The test is one question: **does the file name what it OWNS?** A file called `Helpers`, `Sections`, `Types`, or `Rows` usually names a shape, not a concept. That is acceptable only when its members are individually too small to own anything, and you should say so out loud rather than pretend it is cohesion.

Line count is a symptom, not the target. A 640-line file that names one thing beats four 160-line files named for where their contents used to sit.

**Follow the callers.** A member with zero callers in its own file and two in another file belongs in the other file. Grep before you place anything; a placement the greps contradict is wrong however sensible it reads.

## A move pass cannot reduce, and that is deliberate

The success criterion for a move is that **every body is byte-identical**. Comments move verbatim: do not rewrite, trim, or improve them in the same pass.

The honest consequence: **a move pass will not make the codebase smaller.** Reduction (deleting duplication, condensing comments, collapsing boilerplate) is a SEPARATE pass, because the safety of a move comes from having nothing to review but position. Do not let a reduction sneak into a move; you lose the only proof you had.

Say this to the user plainly when they ask why the line count did not drop.

## What is NOT a split

Some files are one thing and cannot be moved apart:

- **A single closure** (a 600-line factory, a route table, one Compose screen body). Its pieces are not siblings; they are one scope.
- **A cohesive class** whose methods share private state.

Decomposing those is a design change: extracting a state holder, inverting a captured scope into an explicit deps object, completing a half-built pattern. That is /architecture work, it carries real risk, and it deserves its own pass with its own review. Do not force it into a move lap.

**"Too entangled to split" is a checkable claim, not a feeling.** It means "these blocks read each other's locals." Trace which locals each block actually reads before accepting it, in either direction. A claim that six values are entangled often survives only for half the file.

When you leave something whole, report it as an **honest remainder** with the reason, rather than quietly missing a target.

## Run it as cycles

For more than a handful of files, use `cycleStartItems` with the `audited-implementation` cycle and one item per file or file group. The queue survives compaction; your memory does not.

Each lap: implement, red team, fix, commit, document. One commit per lap, and only on a fully green tree.

### The lap machine

1. **Baseline first.** Copy the source file somewhere outside the repo BEFORE any edit. Every later proof compares against it.
2. **Mover** (Sonnet is enough): assembles new files from verified range extractions of that baseline. Never retype a body. Only imports, package lines, section headers and class wrappers are hand-written.
3. **Verifier** (a second agent, adversarial): partitions the baseline into contiguous regions and diffs each against its destination. The partition must cover every line with no gap or overlap.
4. **Red team fan-out**: independent angles the verifier's checklist cannot see. Tell it explicitly not to re-run the verifier's checks.

Give every agent a schema so it returns data, not prose. A confident report is not evidence.

## Proofs that actually catch things

Pick the ones that fit the language. Each of these has caught a real defect that lint and tests missed:

- **Line multiset.** Every non-blank line of the baseline must appear in the union of the results. Every ADDED line must be explainable as an import, a header, or a disclosed edit.
- **Export set.** For a module split behind a barrel, enumerate exports before and after with the language's own tooling (for TypeScript, the compiler's `getExportsOfModule`, which includes types). Counts must match AND the sets must match. This catches both leaked internals and silently dropped public types.
- **Test count and name set.** Split a test suite by running the ORIGINAL standalone first for a runtime baseline, then diffing sorted test-name sets. Never trust a static count of `it(` occurrences.
- **Generated-artifact identity.** If codegen reads the file, rerun it and require an empty diff.
- **Code-lines-trace-to-baseline.** After a comment pass, strip comments from the result and confirm every remaining line exists in the baseline. Proves only comments moved.

## Defect classes at this scale

Each of these is silent, and each recurs:

- **A widening is a new hazard.** Cross-file moves force members from private to internal or public. If the old visibility was guarding an invariant, the same lap adds a residue test pinning who may reach it. Put that test where it blocks a PR, not where it runs after merge. **Negative-control it**: plant a probe, watch it fail, remove the probe.
- **Unused imports survive.** Many languages have no unused-import gate and the compiler only reports MISSING ones. Prune by hand in every file you touch, including the ones you move code into. Watch for false positives: delegate operators like `getValue` and `setValue` never appear as literal text.
- **A dropped comment.** The most common silent loss. Make it an explicit checklist item; it slips even when everything else is clean.
- **A path-pinned test.** A test naming a source file by path breaks when the file splits, and reads as a missing declaration rather than a moved one. Make such tests search for the DECLARATION and fail loudly on zero matches.
- **A parallel fan-out cannot share a write target.** Multiple authors editing one file lose each other's work. Fan out READS; keep writes single-threaded.
- **A failed agent is not failed work.** Agents die mid-report after their edits landed. Check the tree before re-running one.
- **Comments that become false in their new home.** "See below", "this file also", a doc naming a sibling that stayed behind. Re-read every moved comment against its new surroundings.
- **Construction order.** Moving initialization into a new object moves the ordering constraint onto that object's declaration, where nothing documents it. Say so at the new site.
- **A parameter no body reads.** Splits surface these. Drop them the same lap; the compiler finds every call site, and leaving one is a signature that lies.

## Reduction, when you get to it

A separate pass, after the moves. See /coding for the comment rules that govern it. Two additions this work taught:

- **Keep the constraint, drop the story.** Code is not an issue tracker. A defect tally ("three separate rounds", "got it wrong twice", "this cost an outage") fails /coding's timelessness rule however hard the lesson was. Rewrite it to the invariant alone; delete the block only when nothing but the tally is there. Never delete a statement of fact about behavior to achieve this. The tell in your own writing is calling a comment "paid-for" or saying it "earned its keep": both are claims about project history, not about the code.
- **Cutting a test needs two gates, not one.** Prove it is path-redundant, THEN fail to construct a production mutation that only the deleted test would catch. A test whose probe value is a loaded name (a retired field, a withdrawn capability) is an invariant guard however duplicated its mechanics look.

## Reporting

Every lap, tell the user: what moved where, the proofs that passed, every widening with its forcing caller, and anything you refused to move with the reason. Report the largest remaining files so progress is measurable.

Be honest about which splits were good. Some are genuine ("this object now owns its own state"), most are conventional ("types out of the big file"), and a few are shape-driven bags you should name as such and file for a later redesign. Claiming all three are the same quality is the one thing that makes the report worthless.
