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

Definitions live in `cycles/<name>.md`: front matter `steps: [...]` (plus optional `maxLaps`)
and one `## <step>` section per step. Resolution order for the library directory:

1. `NYAASKILLS_CYCLES_DIR` - explicit override.
2. `CLAUDE_PLUGIN_ROOT` - set by Claude Code; `cycles/` sits at the plugin root.
3. Module-relative fallback - resolves `cycles/` next to `src/`, for running from source.

Ships with `plan-refinement` and `audited-implementation`.

### Tools

| Tool | Description | Mutable | dryRun |
|------|-------------|---------|--------|
| `cycleStart` | Initialize a named cycle on a subject doc | Yes | Yes |
| `cycleNext` | Advance one step (confirm-then-advance via `completed`) | Yes | Yes |
| `cycleCheckpoint` | End-of-lap decision: done / loop / critical-stop | Yes | Yes |
| `cycleStatus` | Report cycle position and convergence signal | No | - |
| `cycleGoto` | Jump to a step, or reopen a finished cycle | Yes | Yes |
| `cycleList` | List available cycle definitions | No | - |

Laps are 1-indexed; the soft `maxLaps` cap trips when a loop would exceed it (override per call
with `acknowledgeOverrun`). Convergence is signalled by a whole-document body hash that counts
consecutive unchanged laps.

## Development

```sh
bun install
bun test          # bun:test, runs the cycle suite
bun run lint      # biome ci + tsc --noEmit
bun run lint:fix  # biome auto-fix
```
