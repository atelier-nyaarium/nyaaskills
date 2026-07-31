---
name: security
description: Decides how much security a project actually needs, then builds that much correctly. Load this skill immediately when security is on the table; login and sessions, access control, serving user data, key exchange, or anything a client could forge.
---

# Ease-of-Use vs Security

The strongest security is the one the human will actually keep using.

Pile on ceremony and it gets worked around:

- Rotated 20-character password -> sticky note.
- Awkward key exchange -> secret pasted into Discord.

A worked-around control is not high security. It is zero security you believe is strong. So "maximum security" is the lazy answer. The real question is what the human will tolerate.

Two lanes get you there. Scope the problem first, then pick.

## Terse and Concise

Whether speaking to the user or writing comments, keep everything concise. Avoid fluff, filler, and unnecessary words. Keeping short gets the point across faster.

## Agents

The fan-out here is per candidate option, and it is gated. You write the prompts, so the context goes in with them: the threat model you scoped, the appetite the human named, and the floor and ceiling you bounded. A fresh agent recovers none of that on its own.

**With `Workflow()`,** see **Run It as an Agent Battle** for when it qualifies and how to shape it.

**Without `Workflow()`,** spawn the advocates and the skeptic one at a time via Agent, Task, or runSubagent, using `team-*` or `subagent-*` depending on whether you are team lead via `CreateTeam`. Rank the results yourself against the same criteria.

## Scope It First

Name the threat model. Who is the attacker, relative to the system?

- **Outsider** - no account. Scanning, guessing, scraping.
- **Peer** - a logged-in user reaching for another user's data. The most-missed one in any multi-user system.
- **Climber** - a logged-in user reaching for higher privilege. Free to paid, member to admin.
- **The client itself** - everything it sends is attacker-authored, and everything you send it is disclosed. A wallhack is data you shipped.
- **A leaked credential** - assume the token, session, or DB dump gets out. What does it unlock?
- **The middle** - the network, a third-party script, a malicious extension, the tab next door.
- **The insider** - support staff, a rogue admin, and you. What do you want to be unable to read?
- **A compromised machine** - their device or your server process.

Some of it is not fixable from here. If the host computer is compromised, most application-level security is theater. Do not spend there.

❓ Ask the human how much security they actually want. Do not infer it, and do not default to maximum.

- A blog does not need 2FA and a hardware key.
- Most corporate sites fail Mozilla Observatory and ship anyway, on purpose.
- "Enough that a scraper moves on" and "enough that a subpoena gets nothing" are different products.

Only the human picks which one they are building. Advise against a bad call, but they have the final say.

## Pick the Lane

For anything still in scope, two questions.

**What does a careless choice do?**

- **Degrades gracefully** - you lose a little surface area or convenience. A tradeoff.
- **Fails catastrophically and silently** - forgeable, replayable, impersonable, and nobody notices. An invariant.

**What does the strong path cost the human?**

- **Nothing** - the library or the platform enforces it. Nobody needs to weigh in.
- **A secret to carry, a blocking step, a fumble that means redoing setup** - anything that tempts "I'll just paste it here for now." The human decides if it is worth it.

Failure shape decides how much freedom you have. Cost decides who gets to choose. A costly invariant goes through both lanes: the weighed lane for whether, the invariant lane for how.

## The Invariant Lane

Scoping decides whether you build the control at all. This lane is only about how, once the human has said yes.

At that point there is no decision left. Take it in full, do not soften it.

Most projects only ever meet the everyday ones. Each has exactly one correct shape, and the near-miss does not weaken the guarantee, it voids it:

- **Password hashing** - a fast hash instead of a slow one. Same API, no warning, offline-crackable.
- **Token comparison** - `==` instead of constant-time. Leaks the answer a byte at a time.
- **Session and signature verification** - parsed, never actually verified. The happy path is identical.
- **Access scoping** - every query filtered by the current user. One unfiltered path exposes every row.
- **Client-side visibility** - hiding it in the UI is not hiding it. Fog of war, the other player's hand, anything behind a wall.
- **Server authority** - the client reporting its own score, position, or damage. One trusted field and the leaderboard is fiction.
- **Replay guards** - the check skipped on one path. Every other path still looks right.

Note what they share: the mistake is invisible. Tests pass, the UI works, nothing logs. That is what makes it an invariant and not a tradeoff.

If the human scoped higher, the same rule extends up. Nothing changes but the grade:

- **Nonces and IVs** - one reuse. Not weaker, broken.
- **Signing bytes** - a stray newline, or re-serialized JSON with reordered keys. Verifies here, forges there.
- **Key exchange** - a handshake that authenticates nothing. Encrypted to the attacker is still encrypted.
- **Commit-then-reveal, SAS comparison, forward secrecy** - canonical constructions with published vectors. Reproduce, do not invent.

So the discipline is fidelity, not judgment. You are not designing something new, you are reproducing a known-correct primitive. Take it from the library. If two implementations have to agree, prove it with shared test vectors.

## The Weighed Lane

Here the strong path has real human cost and several honest answers exist. Do not maximize. Bound it, then take the cheapest thing inside the bounds.

- **Floor** - the threat model you already scoped. What must not happen, and who is explicitly out of scope. "A hostile process on their own machine means they are already compromised. Not ours to fix."
- **Ceiling** - what the human will actually tolerate. Ask, do not guess.

Ceilings usually look like:

- A step on every use, not just at setup
- Something to carry, copy, or retype
- A tedious setup that can fail halfway and has to be redone
- No recovery path. Lose the key, lose the account.

Then choose. Drop everything under the floor, and among what survives take the easiest. Security is a gate, not a sort key, so "most secure" never wins on its own.

Most "evaluate the options" thinking sets only a floor.

**A floor with no ceiling is what produces the sticky note: technically strong, practically abandoned.**

## Run It as an Agent Battle

Not every question needs this, and most do not. Use the library, follow the invariant, move on.

Run the battle when all three are true:

- You are in the weighed lane, so real options exist instead of one correct shape.
- The choice is expensive to reverse. It shapes storage, protocol, or the signup flow.
- You cannot already name the winner and defend it against the best counterargument.

When it qualifies, do not decide alone and do not decide first-thought. First-thought is almost always the lazy option or the quietly-insecure one. Spend a `Workflow()` and make the agents fight.

Do not cheap out at this point. The battle costs tokens and a few minutes. Shipping the first insecure thing you landed on costs a great deal more, and that trade is not close.

1. **Spread** - enumerate several distinct avenues, plus a wildcard agent whose only job is "find one we have not named." Breadth is the antidote to satisficing.
2. **Advocate** - one agent per avenue makes its strongest honest case, read against the real code rather than asserted from confidence. It names the real cons and where the option breaks on paths users actually walk: first-time setup, recovery, device change, teardown.
3. **Adversary** - a skeptic tries to refute each survivor. Where does it scuff? What did the advocate undersell?
4. **Score and rank** - rate on named axes: ease, safety under the bounded model, breakage-risk. Then apply the weighed lane's rule. Drop below-floor, take the easiest survivor.
5. **Synthesize** - the orchestrator ranks across advocates, so no single agent's confidence carries the call. Output the recommendation with its runner-ups and why they lost, so the human can overrule it with full sight of the tradeoff.

The invariant lane does not get a battle. There is nothing to debate. It gets verification instead: a skeptic whose only job is to prove the implementation is a plausible-looking forgery of the canonical construction rather than the real thing, settled by test vectors and not by a vote.
