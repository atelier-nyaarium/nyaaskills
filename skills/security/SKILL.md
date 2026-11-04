---
name: security
description: Decides with the human how much security a project needs, then builds that much correctly. Load when designing or changing login and session flows, access control, endpoints serving user data, encryption or key exchange, or anything a client could forge or peek at.
---

# Ease-of-Use vs Security

The strongest security is the one the human will actually keep using.

Pile on ceremony and it gets worked around:

- Rotated 20-character password -> Excel passwords spreadsheet.
- Awkward key exchange -> secret pasted into Discord (I do it, and they inevitably will too).

A control that gets worked around is not high security. It's zero security that you now believe is strong. So "maximum security" is the laziest answer you can give. The real question is what security is needed (the floor), and what the human will **tolerate** (the ceiling).

Scope the problem first, then run the two checks.

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster. /prose rules always apply.

## Agents

The fan-out here is per candidate option. You write the prompts, so the context goes in with them: the threat model you scoped, anything the human mentioned they care about, and the floor/ceiling you bounded.

**With `Workflow()`,** see **Run It as an Agent Battle** for when it qualifies and how to shape it.

**Without `Workflow()`,** spawn the advocates and the skeptic one at a time via Agent, Task, or runSubagent, using `team-*` or `subagent-*` depending on whether you are team lead via `CreateTeam`. Rank the results yourself against the same criteria.

## Scope It First

Name the threat model. Who is the malicious actor, and what position do they hold relative to the system? How they got that position is not your concern.

- **Outsider**: No account. Scanning, guessing, scraping.
- **Peer**: A logged-in user reaching for another user's data. The most-missed one in any multi-user system.
- **Climber**: A logged-in user reaching for higher privilege. Free to paid, member to admin.
- **The server-client model**: Data it sends that can be authored. A wallhack is data you shipped.
- **A leaked credential**: Assume the token, session, or DB dump gets out. What does it unlock?
- **The middle**: The network, a third-party script, a malicious extension, the tab next door.
- **The insider**: Support staff, a rogue admin, and you. What do you want to be unable to read?
- **A compromised machine**: Their device, a peer or relay, or your server process.

Whether that is fixable depends on the design. In a typical app, a compromised host makes application-level security theater. Do not spend your time there. When the design treats a machine as untrusted (federation, relays, end-to-end encryption), holding it must not let them forge or read what they shouldn't.

❓ Ask the human how much security they actually want.
- A blog does not need 2FA and a hardware key.
- Most corporate sites fail Mozilla Observatory and ship anyway, on purpose.
- "Enough that a scraper moves on" and "enough that a subpoena gets nothing" are different products.

Only the human picks which one they are building. Advise against a bad call, but they have the final say.

## Two Checks

For anything still in scope, two questions.

**If you get it slightly wrong, what happens?**

- **Tradeoff**: It gets a bit worse, and someone notices. You lose a little protection or convenience.
- **Invariant**: It breaks completely, and nobody notices. Forgeable, replayable, impersonable.

**What does the strong version cost the human?**

- **Nothing**: The library or platform handles it.
- **Something**: A secret to carry, a blocking step, a setup that has to be redone if fumbled. Anything that tempts "I'll just paste it here."

Each check applies on its own:

- **Costly?** Ask the human.
- **Invariant?** Build it exactly.
- **Both?** Ask first, then build it exactly.
- **Neither?** Pick a sane default and move on.

## Invariant: Build It Exactly

This section is only about how. A free invariant needs no ask. A costly one needs the human's yes first.

Each example has one correct shape. The near-miss looks the same and protects nothing:
- **Password hashing**: Use Argon2id or bcrypt. A fast hash like SHA-256 has the same API and cracks offline.
- **Token comparison**: Compare in constant time (`crypto.timingSafeEqual`, `hmac.compare_digest`). `==` leaks the answer a byte at a time.
- **Session and signature verification**: Verify before reading. `jwt.decode` instead of `jwt.verify` accepts forged tokens and looks identical on the happy path.
- **Access scoping**: Filter every query by the current user. One unfiltered path exposes every row.
- **Queries and output**: Parameterize queries and escape output. One concatenated string is an injection.
- **Client-side visibility**: Don't send what they shouldn't see, like fog of war or the other player's hand. Hiding it in the UI still ships it.
- **Server authority**: Compute score, position, and damage on the server. Trust one client-reported field and the leaderboard is fiction.
- **Replay guards**: Reject repeats on every state-changing path with a single-use ID or timestamp window. Miss one path and a captured request works twice.
- **Nonces and IVs**: Use a fresh one per message under the same key. One reuse exposes plaintext, and with GCM lets attackers forge messages.
- **Signing bytes**: Sign and verify the exact bytes on the wire. A stray newline or re-serialized JSON lets two sides disagree on what was signed.
- **Key exchange**: Authenticate the handshake. Skip it and you may be encrypting to the attacker.

Where possible, use a well-known library, and write the test that fails the cases.

## Costly: The Human Decides

**A floor with no ceiling is what lands passwords onto an Excel passwords spreadsheet: technically strong, practically abandoned.**

The strong version costs the human something, so they decide. For a costly tradeoff, pick among several reasonable options. For a costly invariant, decide whether to build it at all.

Bound it first:
- **Floor**: What must not happen, from the threat model you scoped. "A logged-in player must not download another player's saves."
- **Ceiling**: How much friction the human will accept. Ask about each cost, don't guess:
  - A step on every use, not just at setup
  - Something to carry, copy, or retype
  - A setup that can fail halfway and has to be redone
  - No recovery path. Lose the key, lose the account.

Drop every option below the floor or above the ceiling. Show the human what's left with its costs, and recommend the easiest. Security is a gate, not a sort key, so "most secure" never wins on its own.

If nothing is left, the floor and ceiling conflict. Show the closest option and what it costs, and let the human raise the ceiling or lower the floor.

## Run It as an Agent Battle

Most questions don't need this. Invariants never do, since there is nothing to debate. Build them exactly and verify them.

Run the battle when all three are true:

- It's a costly tradeoff, so real options exist instead of one correct shape.
- The choice is expensive to reverse. It shapes storage, protocol, or the signup flow.
- You cannot already name the winner and defend it against the best counterargument.

When it qualifies, don't settle on your first thought. It's usually the lazy option or the quietly insecure one. Spend a `Workflow()` and make the agents fight. Each dimension is a candidate option. Give every agent the threat model, the floor, the ceiling, and anything the human said they care about.

- Fan out with `parallel()`/`pipeline()`; One agent per dimension. Enumerate several distinct avenues, plus a wildcard agent whose only job is "find one we have not named."
- Adjust Agent count to complexity. Choose between 4 to 12 per fan out. Explicitly choose a model:
  - If `switchboard_capabilities` list **Codex**:
    - For *fan outs* (like Explore/Analyze/Audit/Edits), use Sonnet to verbatim relay to Luna via `codexStartAgent`.
    - For *joins*, use Sonnet for collating, or Opus for synthesis.
  - Else, use Sonnet for **light** fact checks and exploration, Opus for complex reasoning.
- Read against the real code rather than assert from confidence. It names the real cons and where the option breaks on paths users actually walk: first-time setup, recovery, device change, teardown.
- If **Lexicon** MCP plugin is enabled, have them use it over bare Find/Grep.
- Give each a markdown Report format.
- **Adversary Fan out** again each as a skeptic to try and refute each one. Was the report even real and accurate? Where does it scuff? What did the advocate undersell?
- Synthesis: Dedup across dimensions, rank survivors.

Post Workflow triage gate: Real gap vs overcautious / out-of-scope / hallucinated / *skill issue*(lol). A confident tone is not evidence, nor is their inability to follow something clearly documented. Overcatious 100-line fixes for an edge case nobody cares about, or 100 lines of "tests" for simple 5-line fixes. Verify against the code.

Then take the survivors to the human, as in **Costly: The Human Decides**.

Without `Workflow()`, spawn the advocates and skeptics one at a time via Agent, Task, or runSubagent, using `team-*` or `subagent-*` depending on whether you are team lead via `CreateTeam`. Rank the results the same way.
