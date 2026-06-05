# NyaaSkills

Skills, agents, and the cycle MCP I use across nyaarium projects.

Add plugin to `.claude/settings.json`
```json
{
	"enabledPlugins": {
		"nyaaskills@atelier-nyaarium": true
	},
	"extraKnownMarketplaces": {
		"atelier-nyaarium": {
			"source": {
				"source": "github",
				"repo": "atelier-nyaarium/claude-marketplace"
			},
			"autoUpdate": true
		}
	}
}
```

## Cycle MCP

A looping step-runner that drives an agent through a named, reusable procedure (a "cycle")
defined by a markdown file. Progress is tracked in a JSON sidecar next to the plan
(`<plan>.cycle.json`), so the tools never touch the document the author is editing.

The MCP server is declared in `.mcp.json` and runs from source via
`bun run ${CLAUDE_PLUGIN_ROOT}/src/cycle-mcp.ts`. Its only runtime dependencies are
`@modelcontextprotocol/sdk` and `zod`; run `bun install` in the plugin directory once so they
resolve (the same way the switchboard plugin installs its deps).

### Cycle definitions

Definitions live in `cycles/<name>.md`: front matter `steps: [...]` and one `## <step>` section per
step. Resolution order for the library directory:

1. `NYAASKILLS_CYCLES_DIR` - explicit override.
2. `CLAUDE_PLUGIN_ROOT` - set by Claude Code; `cycles/` sits at the plugin root.
3. Module-relative fallback - resolves `cycles/` next to `src/`, for running from source.

Ships with `plan-refinement` and `audited-implementation`.

### Custom runbooks

To run your own cycles, point `NYAASKILLS_CYCLES_DIR` at a directory of `<name>.md` runbooks (same
format as above). This overrides the shipped library rather than merging with it, so copy the
built-in definitions into your directory to keep them. They also make the best starting templates:

```sh
cp ~/.claude/plugins/cache/atelier-nyaarium/nyaaskills/*/cycles/*.md  your-cycles-dir/
```

`cycleList(...)` then reports whatever lives in that directory.

### Tools

| Tool | Description | Mutable |
|------|-------------|---------|
| `cycleStartPlan` | Initialize a cycle on a plan file; optional `phases` tracks the plan's phases | Yes |
| `cycleStartItems` | Initialize a cycle over an explicit work queue (items mode) | Yes |
| `cycleAppendItems` | Append items to a running items queue (noDup, mtime-guarded) | Yes |
| `cycleNext` | Advance one step (confirm-then-advance via `completed`) | Yes |
| `cycleCheckpoint` | End-of-lap decision: done / loop / critical-stop | Yes |
| `cycleStatus` | Report cycle position (step, lap, status) | No |
| `cycleGoto` | Jump to a step, or reopen a finished cycle | Yes |
| `cycleList` | List available cycle definitions | No |

Laps are 1-indexed and open-ended: the agent keeps looping and ends with `done` when another lap
would add only minimal gains.

Both start tools take `includeSteps` to run a subset of the cycle's steps: omit it and the tool
returns a confirm bounce listing the full suite for the user to trim, pass `["all"]` for everything,
or name the steps to keep. `cycleStartPlan` also takes `phases` (labels matching the plan's `##`
headers) to track plan phases one per lap, with each phase's section body persisted for crash
recovery.

## Development

```sh
bun install
bun test          # bun:test, runs the cycle suite
bun run lint      # biome ci + tsc --noEmit
bun run lint:fix  # biome auto-fix
```
