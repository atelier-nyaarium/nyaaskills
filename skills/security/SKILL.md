---
name: security
description: Weighs the real tradeoff between maximum security and the easy off-the-shelf option. Load this skill immediately when security is on the table; serving data, key exchange, building authentication.
---

# Ease-of-Use vs Security

**Core truth: the strongest security is the one the human will actually keep using.**

Software is built for humans, and humans route around friction. Pile on ceremony and they defeat it the most insecure way available. Demand a rotated 40-character passphrase and it lands on a sticky note. Make key exchange a hassle and someone pastes the plaintext secret into Discord for the other side to copy out.

A control the user works around is not weak security. It is zero security that you now believe is strong. That second failure is the dangerous one.

So the target is never "maximum security." It is the strongest posture that survives daily use. Two lanes get you there. One question decides which, and it is not a matter of taste.

## Maximum Security Is the Lazy Answer

Reaching for the strongest possible control feels rigorous. Usually it is the opposite. It skips the only hard question, what the human will tolerate, and ships something that looks bulletproof in review and gets bypassed in week one.

Tin-foil-hat security is an anti-feature. The more ceremony you pile on, the more reliably people defeat it. Do not confuse a strong-looking control with a strong one. The strong one is the one still in place a month later.

## The Failure-Shape Test

One question picks the lane. Ask what a careless choice actually does:

- **Degrades gracefully** - you lose a little surface area or convenience. This is a tradeoff. Weigh it.
- **Fails catastrophically and silently** - forgeable, replayable, impersonable, and nobody notices. This is an invariant. There is nothing to weigh.

Then ask whether the strong path costs the human anything: a secret to copy or carry, a blocking step, a fumble that means redoing setup. Anything that tempts "I'll just paste it here for now."

Free strength goes in the invariant lane by default. Costly strength goes in the weighed lane. That is the whole sort.

## The Free / Invariant Lane

When the infrastructure enforces the guarantee at zero human cost, there is no decision to make. Take it in full. Do not soften it. The human pays nothing for the strong version: the phone mints the key itself, the seal happens in the library, the handshake is three taps.

This is the lane for canonical constructions: owner-signed admissions, commit-then-reveal handshakes, SAS comparison, replay guards, forward secrecy, versioned signing bytes reproduced byte-for-byte and never raw JSON. Here there is exactly one correct shape. The only acceptable variants are byte-equivalent to it.

A reused nonce, a stray newline in a preimage, a skipped replay check: none of these make it "slightly weaker." Each silently voids the whole guarantee. So the discipline here is not judgment. It is fidelity to a known-correct primitive, proven with cross-platform vectors. You are not designing something new, you are reproducing a correct paradigm.

## The Weighed Lane: Bound the Bar Both Ways

When the strong path has real human cost and several honestly-acceptable answers exist, you do not maximize. You bound. Set both ends before you choose anything:

- **Floor (threat model)** - who the attacker is, what they reach, what is out of scope. "The owner owns the box. A hostile local uid means they are already compromised, so that is not our problem."
- **Ceiling (comfort limit)** - reasonable, not tin-foil. No manually typing keys. Nothing that scuffs across the real paths: fresh install, re-enroll, teardown.

Most "evaluate the options" thinking sets only a floor. A floor with no ceiling is exactly what produces the sticky note: technically strong, practically abandoned. The ceiling is what makes the answer land.

## Run It as an Agent Battle

This is the part the skill exists for. Do not decide alone, and do not decide first-thought, because first-thought is almost always the lazy or quietly-insecure option. Spend a `Workflow()` and make the agents fight.

1. **Spread** - enumerate several distinct avenues, plus wildcards agents whose only job is "find one we have not named." Breadth is the antidote to satisficing.
2. **Advocate per avenue** - one agent makes the strongest honest case for its option, read against the real code, not asserted from confidence. It surfaces the real cons and exactly how it breaks on the actual edge paths: fresh install, re-enroll, teardown.
3. **Adversary** - a skeptic tries to refute each survivor. In the invariant lane this is a fidelity attack: is this the canonical construction, or a plausible-looking forgery of it? In the weighed lane it is a fit attack: where does this scuff, what did the advocate undersell?
4. **Score and rank** - rate each on named axes (ease, safety under the bounded model, breakage-risk), then rank the way the objective actually reads. Security is a gate, not a sort key: drop everything below the floor first, then among survivors sort by ease and low-scuff. "Most secure" never wins on its own. "Easiest of the options that clear the bar" does.
5. **Orchestrator de-biases** - advocates push, the synthesizer ranks across them, so no single agent's confidence carries the call. Output a ranked recommendation with its runner-ups and reasons, so a human can overrule it with full sight of the tradeoff.

The pipeline:

```
avenues -> [advocate per avenue, grounded in code]   // parallel, + a wildcard
        -> [skeptic refutes each]                     // adversarial verify
        -> drop below-floor, sort survivors by ease   // ease while secure
        -> ranked recommendation + runner-ups
```

The invariant lane runs the same machine with the dial turned to fidelity: the avenues collapse to "the canonical construction vs each tempting shortcut," the adversary's whole job is to prove a shortcut breaks the guarantee, and the winner is validated with cross-platform vectors, not a vote.

## Spend the Tokens

Either lane, the agent battle costs tokens and a few minutes. Skipping it costs you shipping the first insecure thing you landed on and getting popped. That trade is not close. Spend the tokens. Every time.

## Key Principles

- **Strongest kept, not strongest built** - The win is the posture that survives daily use, not the one that looks hardest in review.
- **A worked-around control is worse than none** - It is zero security you now trust. No security - You aim to build security. False security - over-confidence is the slow and insidious killer.
- **Failure shape picks the lane** - Degrades gracefully is a tradeoff. Fails silently is an invariant. Decide which before you argue options.
- **Free strength is never weighed** - If infrastructure enforces it at zero human cost, take it in full and do not soften it.
- **Fidelity, not judgment** - In the invariant lane you reproduce a known-correct primitive byte-for-byte. Variants are forgeries, not flavors.
- **Bound the ceiling, not just the floor** - A threat model with no comfort limit ships the sticky note. Name what the human will tolerate.
- **Security is a gate, not a sort key** - Drop below-floor options, then sort survivors by ease. Easiest-that-clears-the-bar wins.
- **Never decide first-thought** - First-thought is the lazy or quietly-insecure option. Make the agents fight, then rank.
- **Spend the tokens** - The battle is cheap. Getting popped is not.
