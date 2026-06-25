---
name: update-packages
description: Absolute guidelines when installing or updating package (npm, bun, etc). Load this skill before you run bun/npm/yarn/anything `install`.
---

## Package Install and Update - 7-Day Maturity Rule

Due to dangers like Mini Shai-Hulud, you must proceed with caution when installing Node/Python packages. Or really any package manager ecosystem with fast moving CI/CD. This skill will speak in terms of Bun.

When manually installing packages with bun (or any package manager really), only install versions that are **at least 7 days old**. The maturity window gives security researchers and automated audits time to flag a compromised or vulnerable release before it lands in your project.

For trusted package manager sources like built-in `apt-get`, you don't have to follow this rule.

***Be deliberately slow and careful. One package at a time:***

1. **Inspect the package**: `bun pm view <pkg>` for metadata, maintainers, and latest versions.
2. **Filter by age**: Select a version that was published 7+ days ago.
   - `npm view <pkg> time --json | jq 'to_entries | map(select(.key != "created" and .key != "modified")) | map(select(.key | test("-") | not)) | sort_by(.value) | .[-20:] | from_entries'`
3. **Audit before it touches node_modules**: `bun audit` only scans the lockfile, so it can't see a package you haven't added yet. Workaround: Manually add the pinned version to `package.json`, run `bun install --lockfile-only` to resolve it into `bun.lock` without installing, then run `bun audit`. Only proceed if clean.
4. **Pin it**: if the entry previously had a `^` (or `~`) range allowing automatic upgrades, strip it so the version stays exact. You should check if `bunfig.toml` specifies `minimumReleaseAge = 604800`, to automatically enforce this rule.
5. **Install the exact version**: `bun add <pkg>@<version>` (`-d` for devDependencies), or plain `bun install` if you already staged it in step 3 and pinned it in step 4.
