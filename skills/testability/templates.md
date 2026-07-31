# Testability Templates

TypeScript/Node.js reference implementations. Adapt to the project's actual language, framework, and architecture.

## Debug Logger (`debug-logger.ts`)

Server-side NDJSON debug logger. Writes structured entries to `.cursor/debug-{sessionId}.log`.

```ts
// Debug Logger for AI Agent Instrumentation
// Writes NDJSON to .cursor/debug-{sessionId}.log for structured, machine-parseable output
// Adapt this template to your project's architecture and logging conventions

import fs from "node:fs";
import path from "node:path";

const LOG_DIRECTORY = path.join(process.cwd(), ".cursor");
const SESSION_ID = process.env.DEBUG_SESSION_ID ?? "default";
const LOG_FILE = path.join(LOG_DIRECTORY, `debug-${SESSION_ID}.log`);

let logCounter = 0;

interface DebugLogOptions {
	hypothesisId?: string;
	data?: Record<string, unknown>;
}

interface DebugLogEntry {
	id: string;
	timestamp: number;
	location: string;
	message: string;
	data: Record<string, unknown>;
	hypothesisId?: string;
}

/**
 * Log debug information for AI agent analysis.
 * Writes structured NDJSON entries that agents can programmatically parse.
 *
 * @param location - Source location (e.g., "src/services/auth.ts:142")
 * @param message - Human-readable description of the observation
 * @param options - Optional hypothesis ID and structured data
 */
export function debugLog(location: string, message: string, options: DebugLogOptions = {}): void {
	const { hypothesisId, data = {} } = options;

	try {
		if (!fs.existsSync(LOG_DIRECTORY)) {
			fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
		}

		const entry: DebugLogEntry = {
			id: `log_${Date.now()}_${++logCounter}`,
			timestamp: Date.now(),
			location,
			message,
			data,
			...(hypothesisId && { hypothesisId }),
		};

		fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
	} catch (err) {
		console.error("[debugLog]", err);
	}
}

/**
 * Clear the debug log.
 * Call at the start of a debugging session or test run.
 */
export function clearDebugLog(): void {
	try {
		if (fs.existsSync(LOG_FILE)) {
			fs.unlinkSync(LOG_FILE);
		}
	} catch (err) {
		console.error("[clearDebugLog]", err);
	}
}

/**
 * Read all log entries for AI agent analysis.
 * Returns parsed NDJSON entries as an array of objects.
 */
export function readDebugLog(): DebugLogEntry[] {
	const entries: DebugLogEntry[] = [];

	try {
		if (!fs.existsSync(LOG_FILE)) return entries;

		const content = fs.readFileSync(LOG_FILE, "utf-8");
		for (const line of content.split("\n")) {
			if (!line.trim()) continue;
			entries.push(JSON.parse(line) as DebugLogEntry);
		}
	} catch (err) {
		console.error("[readDebugLog]", err);
	}

	return entries;
}

/**
 * Filter log entries by hypothesis ID.
 * Useful for comparing behavior between code paths during debugging.
 */
export function getEntriesByHypothesis(hypothesisId: string): DebugLogEntry[] {
	return readDebugLog().filter((entry) => entry.hypothesisId === hypothesisId);
}
```

## Debug Ingest Route (`debug.ingest.ts`)

Client-side debug POST endpoint (Remix action). Receives browser-side debug payloads, appends to same NDJSON log.

```ts
import fs from "node:fs";
import path from "node:path";
import type { ActionFunctionArgs } from "@remix-run/node";

const getDebugLogPath = (): string => {
	const sessionId = process.env.DEBUG_SESSION_ID ?? "default";
	return path.join(process.cwd(), ".cursor", `debug-${sessionId}.log`);
};

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 });
	}

	const payload: unknown = await request.json().catch(() => null);
	if (payload == null || typeof payload !== "object") {
		return new Response("Bad request", { status: 400 });
	}

	const p = payload as Record<string, unknown>;
	const timestamp = Number(p.timestamp) || Date.now();
	const id =
		typeof p.id === "string" && p.id
			? p.id
			: `log_${timestamp}_${Math.random().toString(36).slice(2, 10)}`;

	const record = {
		...p,
		id,
		timestamp,
		data: p.data != null && typeof p.data === "object" ? p.data : {},
	};

	const logPath = getDebugLogPath();
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	fs.appendFileSync(logPath, JSON.stringify(record) + "\n");

	return new Response(null, { status: 204 });
}
```

## MCP Server (`mcp-server.ts`)

Lightweight MCP server the IDE launches on startup. Dynamically loads project-specific tool schemas, bridges tool calls via HTTP POST to the dev server.

```ts
#!/usr/bin/env node

// MCP Server Template
//
// A TypeScript MCP server that the IDE launches on startup. It dynamically loads
// project-specific tool schemas from .claude/connector/mcp-schema.js, and bridges
// tool calls via HTTP POST to the project's local dev server.
//
// WHY A SEPARATE SERVER?
// IDEs (Cursor, Claude Desktop, VS Code) require MCP servers to be running
// BEFORE the IDE connects. A dev server that starts late (e.g. `yarn dev`)
// won't be discovered. This server starts instantly with the IDE and bridges
// requests to the dev server whenever it's available.
//
// SETUP:
// 1. Install dependencies: npm install @modelcontextprotocol/sdk dotenv zod
// 2. Configure your IDE's MCP settings to launch this script
// 3. Set environment variables: PROJECT_NAME, PORT (and optionally HOST)
// 4. Create .claude/connector/mcp-schema.js in your project (see MCP Schema template)
//
// The server resolves the schema path as: /workspace/$PROJECT_NAME/.claude/connector/mcp-schema.js
// Adapt this path pattern to match your workspace layout.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

interface McpTool {
	name: string;
	title: string;
	description: string;
	operation?: string;
	schema: z.ZodObject<z.ZodRawShape>;
	handler?: (cwd: string, args: Record<string, unknown>) => Promise<unknown>;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

process.chdir(scriptDir);

dotenv.config({
	path: path.join(scriptDir, ".env"),
	quiet: true,
});

const mcpServer = new McpServer({
	name: "my-mcp-server",
	version: "1.0.0",
});

// ============================================================================
// Local Tool Registration
// ============================================================================
// Register tools that run directly in this server process (no WebSocket client needed).
// Use this for tools that don't need the dev server running.
//
// Example:
//
// import { myLocalTools } from "./tools/myLocalTools.js";
// myLocalTools.forEach((tool) => registerTool(tool));
//
// Where myLocalTools.ts exports an array of tool definitions:
//
// export const myLocalTools: McpTool[] = [
//   {
//     name: "example_tool",
//     title: "Example Tool",
//     description: "Description of what this tool does",
//     schema: z.object({
//       message: z.string().describe("A message to process"),
//     }),
//     async handler(cwd, args) {
//       return { result: `Processed: ${args.message}` };
//     },
//   },
// ];

/**
 * Register a local tool with the MCP server.
 * The tool's handler runs in-process. Wraps with error handling.
 */
function registerTool(tool: McpTool): void {
	mcpServer.registerTool(
		tool.name,
		{
			title: tool.title,
			description: tool.description,
			inputSchema: tool.schema.shape,
		},
		async (args) => {
			try {
				const roots = (await mcpServer.server.listRoots()) as { roots: Array<{ uri: string }> };
				if (!roots.roots || roots.roots.length === 0) throw new Error("listRoots: no roots");
				const cwd = fileURLToPath(roots.roots[0].uri);
				const result = await tool.handler!(cwd, args as Record<string, unknown>);
				return {
					content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ errors: [{ message: (error as Error).message }] }, null, 2),
						},
					],
					isError: true,
				};
			}
		},
	);
}

// ============================================================================
// Project-Specific Tool Loading (Dynamic Schema + WebSocket Connector)
// ============================================================================
// Loads .claude/connector/mcp-schema.js from the project and routes tool calls
// via HTTP POST to the project's local dev server.

async function loadProjectTools(): Promise<void> {
	const projectName = process.env.PROJECT_NAME;
	const port = process.env.PORT;

	if (!projectName || !port) return;

	const schemaPath = `/workspace/${projectName}/.claude/connector/mcp-schema.js`;

	if (!fs.existsSync(schemaPath)) {
		console.error(`[mcp-server] PROJECT_NAME and PORT are set, but schema not found: ${schemaPath}`);
		return;
	}

	let schema: { default?: unknown };
	try {
		schema = await import(schemaPath);
	} catch (error) {
		console.error(`[mcp-server] Failed to load MCP schema from ${schemaPath}: ${(error as Error).message}`);
		return;
	}

	const schemaFn = schema.default;
	if (typeof schemaFn !== "function") {
		console.error(`[mcp-server] MCP schema must default export a function. Got: ${typeof schemaFn}`);
		return;
	}

	const tools = schemaFn(z) as McpTool[];
	if (!Array.isArray(tools)) {
		console.error(`[mcp-server] MCP schema function must return an array. Got: ${typeof tools}`);
		return;
	}

	const host = process.env.HOST || "localhost";
	const baseUrl = `http://${host}:${port}`;

	for (const tool of tools) {
		mcpServer.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.schema.shape,
			},
			async (args) => {
				try {
					const endpoint = tool.operation ?? `/api/debug/${tool.name}`;
					const response = await fetch(`${baseUrl}${endpoint}`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(args),
					});

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${await response.text()}`);
					}

					const result = await response.json();
					return {
						content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ errors: [{ message: (error as Error).message }] }, null, 2),
							},
						],
						isError: true,
					};
				}
			},
		);
	}

	console.error(`[mcp-server] Loaded ${tools.length} project tool(s) from ${projectName}`);
}

// ============================================================================
// Entry Point
// ============================================================================

async function main(): Promise<void> {
	await loadProjectTools();
	const transport = new StdioServerTransport();
	await mcpServer.connect(transport);
}

main().catch((error) => {
	console.error("MCP Server error:", error);
	process.exit(1);
});
```

## MCP Schema (`mcp-schema.js`)

Project-specific MCP tool definitions. Place at `.claude/connector/mcp-schema.js` in project root.

```js
/**
 * MCP Schema Template
 *
 * Defines project-specific MCP tools that the MCP server exposes to IDE agents.
 * Each tool is bridged via HTTP POST to the local dev server.
 *
 * POSTS to: /api/debug/:toolName (override per-tool with the `operation` field)
 *
 * Place this file at: .claude/connector/mcp-schema.js (project root)
 * Keep as .js. It is loaded via dynamic import() at runtime by the MCP server.
 *
 * @param {import("zod")} z - Zod module, passed in by the MCP server.
 * @returns {Array} Array of tool definitions.
 */
export default function (z) {
	return [
		{
			name: "queryState",
			title: "Query Application State",
			description:
				"Retrieve current state of an application component. Use this to inspect runtime configuration, connection status, or cached data.",
			schema: z.object({
				component: z.string().describe("Component name to query (e.g., 'auth', 'cache', 'database')."),
			}),
			// operation: "/api/custom-endpoint",  // Optional: override the default /api/debug/:toolName
		},
	];
}
```
