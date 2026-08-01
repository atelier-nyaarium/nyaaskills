# nyaaskills

Claude Code plugin for agents, skills, cycle definitions, and the cycle MCP server.

## Deploy Sequence

1. Commit your source work. The build script refuses to start on a dirty tree.
2. If you made MCP changes, run `bun run build patch|minor|major`.
   - It bumps `package.json`, `plugin.json`, bundles `dist/`, and commits as `Build X.Y.Z`.
3. Push.

## Development

`bun run build --build-only` bundles without bumping or committing.

- `bun test`
- `bun run lint` (biome plus `tsc --noEmit`)

## Runtime

`.mcp.json` runs `node ${CLAUDE_PLUGIN_ROOT}/dist/cycle-mcp.js`. Dependencies are bundled into that file, so the plugin needs no install step and no bun on the machine running it. `dist/` is committed for that reason.

`bun run start:mcp` runs from source for development.

## Installing

Listed under [`atelier-nyaarium/claude-marketplace`](https://github.com/atelier-nyaarium/claude-marketplace)

```bash
# Install my marketplace once
claude plugin marketplace add atelier-nyaarium/claude-marketplace

# Install nyaaskills
claude plugin install nyaaskills@atelier-nyaarium
```
