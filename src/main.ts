import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, readFileSync } from "node:fs";
import { setAuthToken, startListener } from "./connector/listener.ts";
import { registerProjectTools } from "./projectTools.ts";
import { registerConnectorTools } from "./tools/connectorTools.ts";
import { registerStubTool } from "./utils.ts";

const TAG = "[project-mcp-connector]";

const mcpServer = new McpServer({
	name: "project-mcp-connector",
	version: "2.0.0",
});

async function main(): Promise<void> {
	const projectName = process.env.PROJECT_NAME;
	const port = Number(process.env.MCP_CONNECTOR_PORT) || 20000;

	if (!projectName) {
		registerStubTool(
			mcpServer,
			"projectMcpConnectorStatus",
			`Project MCP connector is disabled. Call this tool for details.`,
			() =>
				[
					`Project MCP connector is disabled.`,
					``,
					`Requirements:`,
					`  - PROJECT_NAME env var must be set in the container`,
					`  - MCP_CONNECTOR_PORT (default 20000) must be exposed via compose.yml`,
				].join("\n"),
		);
	} else {
		const connectorDir = `/workspace/${projectName}/.claude/connector`;

		const tokenPath = `${connectorDir}/token`;
		if (existsSync(tokenPath)) {
			setAuthToken(readFileSync(tokenPath, "utf-8").trim());
			console.error(`${TAG} Auth token loaded`);
		}

		startListener(port);
		registerConnectorTools(mcpServer, projectName, connectorDir, port);
		await registerProjectTools(mcpServer, projectName, connectorDir);
	}

	const transport = new StdioServerTransport();
	await mcpServer.connect(transport);
	console.error(`${TAG} started`);
}

main().catch((error) => {
	console.error(`${TAG} fatal:`, error);
	process.exit(1);
});
