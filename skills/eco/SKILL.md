---
name: eco
description: Eco-effort mode. Use when the user wants to conserve tokens via /effort mode.
---

# Eco-Effort Mode

**Core Mission: Save money.**

The user wants you to conserve costs by planning your workloads as hills to climb or descend. On climbs, ask the user to switch to a lower effort level, and on descents, ask the user to switch to a higher effort level.

## Setting Effort Level

If the `set_effort_level` tool is available, automatically set it yourself instead of asking the user to set effort level.
❓ If not, ask the user to set it for you. Choices below.

Choices for `set_effort_level` and `/effort <level>` are:
- `low`: Quick, straightforward implementation with minimal overhead
- `medium`: Balanced approach with standard implementation and testing
- `high`: Comprehensive implementation with extensive testing and documentation
- `xhigh`: Deeper reasoning than high, just below maximum
- `max`: Maximum capability with deepest reasoning

## Auto Defaults

This section only applies if the `set_effort_level` tool is available. If not, don't bother the user for idle tasks & conversational prompts.

No pending workloads, falling into a discussion/analytic mode:
- Set effort level to `medium`, and recieve the prompt.
- If the prompt recieved is more complex than `medium`, immediately escalate the effort level to an appropriate higher level.

Devising unit tests and fixing results:
- `medium`. Set higher when complex systems are involved.

Dumb running a bunch of simple things:
- `low`. Set higher if unexpected interruptions require more thought.

Highly complex reasoning that you MUST NOT get wrong:
- `max`. Set lower as the severity of followups decreases.

## Workloads

**Hills:** Tasks that are harder than the last workload.
**Valleys:** Tasks that are easier than the last workload.

You likely already have a plan in mind. In your own head, split the current phase into hills. Consolidate hills and valleys only if reasonable (some task ordering just won't combine).

Starting line could start from the bottom, or from the top. Recommended to start from the hardest things first. ❓ Be sure to ask the user to set effort level with your desired starting level.

When finishing the workload for that light or complex work, auto-resume if the next workload is the same effort level.
❓ If the next effort level is different, ask to set effort level.

During your workload, if you encounter an unexpected issue requiring more thought than initially planned, ❓ ask the user to increase effort level.

## Workload Task List

Within your task lists, keep track of the workload's effort levels so you remember when it's time to switch.

```
◻ [max] Phase 1 - Some complex task
◻ [max] Phase 2 - Some other complex task
◻ [medium] Phase 2 - Some medium task
◻ [high] Phase 3 - Some high task
◻ [medium] Phase 4 - Some medium task
```
