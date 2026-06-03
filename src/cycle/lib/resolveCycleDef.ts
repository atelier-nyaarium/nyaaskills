import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractSection } from "./extractSection.ts";
import { parseFrontMatter } from "./frontMatter.ts";

export interface CycleDef {
	name: string;
	steps: string[];
	maxLaps: number;
	body: string;
}

export const DEFAULT_MAX_LAPS = 8;

// Reusable cycle definitions ship in the plugin's cycles/ directory. Resolution order:
//   1. NYAASKILLS_CYCLES_DIR  - explicit override for tests or a custom library.
//   2. CLAUDE_PLUGIN_ROOT     - set by Claude Code for plugin MCP servers; cycles/ sits at its root.
//   3. module-relative        - this file lives at src/cycle/lib/, so cycles/ is three levels up.
// The module-relative fallback keeps the server working when run from source outside the plugin host.
export function cyclesDir(): string {
	if (process.env.NYAASKILLS_CYCLES_DIR) return process.env.NYAASKILLS_CYCLES_DIR;
	if (process.env.CLAUDE_PLUGIN_ROOT) return path.join(process.env.CLAUDE_PLUGIN_ROOT, "cycles");
	const here = path.dirname(fileURLToPath(import.meta.url));
	return path.resolve(here, "..", "..", "..", "cycles");
}

function assertSafeName(name: string): void {
	if (!/^[A-Za-z0-9_-]+$/.test(name)) {
		throw new Error(`invalid cycle name: "${name}" (use letters, digits, dashes, underscores)`);
	}
}

export function listCycleDefs(): string[] {
	const dir = cyclesDir();
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".md"))
		.map((e) => e.name.slice(0, -3))
		.sort();
}

function validateSteps(value: unknown, name: string): string[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error(`cycle "${name}" must define a non-empty steps list`);
	}
	const steps = value.map((s) => String(s));
	const seen = new Set<string>();
	for (const step of steps) {
		const key = step.toLowerCase();
		// "all" is reserved by includeSteps as the full-suite token, so a step named "all" would be
		// unreachable when selecting steps.
		if (key === "all") throw new Error(`cycle "${name}" cannot have a step named "all" (reserved)`);
		if (seen.has(key)) throw new Error(`cycle "${name}" has duplicate step: "${step}"`);
		seen.add(key);
	}
	return steps;
}

export function loadCycleDef(name: string): CycleDef {
	assertSafeName(name);
	const file = path.join(cyclesDir(), `${name}.md`);
	if (!fs.existsSync(file)) {
		const available = listCycleDefs();
		const hint = available.length ? ` Available: ${available.join(", ")}.` : "";
		throw new Error(`unknown cycle "${name}".${hint}`);
	}
	const stat = fs.lstatSync(file);
	if (stat.isSymbolicLink()) {
		throw new Error(`refusing to load a symlinked cycle definition: ${name}`);
	}
	if (!stat.isFile()) {
		throw new Error(`cycle definition is not a regular file: ${name}`);
	}

	const content = fs.readFileSync(file, "utf8");
	const { fields, body } = parseFrontMatter(content);
	const steps = validateSteps(fields.steps, name);

	// Every step must resolve to exactly one section (extractSection throws on missing/duplicate).
	for (const step of steps) extractSection(body, step);

	const maxLaps =
		typeof fields.maxLaps === "number" && Number.isInteger(fields.maxLaps) && fields.maxLaps > 0
			? fields.maxLaps
			: DEFAULT_MAX_LAPS;
	return { name, steps, maxLaps, body };
}
