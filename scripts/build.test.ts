import { describe, expect, it } from "bun:test";
import path from "node:path";
import { dirtyTrackedFiles, nextVersion, readVersion, setVersion, versionTargets } from "./build.ts";

describe("nextVersion", () => {
	it("bumps each position and zeroes the ones below it", () => {
		expect(nextVersion("3.12.1", "patch")).toBe("3.12.2");
		expect(nextVersion("3.12.1", "minor")).toBe("3.13.0");
		expect(nextVersion("3.12.1", "major")).toBe("4.0.0");
	});
	it("carries past nine rather than treating parts as digits", () => {
		expect(nextVersion("1.9.9", "patch")).toBe("1.9.10");
		expect(nextVersion("1.9.9", "minor")).toBe("1.10.0");
	});
	it("rejects anything that is not plain major.minor.patch", () => {
		expect(() => nextVersion("1.2.3-rc1", "patch")).toThrow("not a plain major.minor.patch");
		expect(() => nextVersion("1.2", "patch")).toThrow();
	});
});

describe("setVersion / readVersion", () => {
	const manifest = '{\n\t"name": "nyaaskills",\n\t"version": "3.12.1",\n\t"type": "module"\n}\n';

	it("round-trips", () => {
		expect(readVersion(setVersion(manifest, "4.0.0"))).toBe("4.0.0");
	});
	it("leaves every other byte alone", () => {
		expect(setVersion(manifest, "4.0.0")).toBe(manifest.replace('"version": "3.12.1"', '"version": "4.0.0"'));
	});
	it("refuses a file with no version field", () => {
		expect(() => setVersion('{\n\t"name": "x"\n}', "1.0.0")).toThrow("found 0");
		expect(() => readVersion('{\n\t"name": "x"\n}')).toThrow("found 0");
	});
	it("refuses a file with two version fields, rather than guessing which one", () => {
		const two = '{\n\t"version": "1.0.0",\n\t"dep": { "version": "2.0.0" }\n}';
		expect(() => setVersion(two, "1.0.1")).toThrow("found 2");
	});
});

describe("versionTargets", () => {
	it("puts package.json first, since it is the one being bumped", () => {
		expect(versionTargets()[0]).toBe("package.json");
	});
	it("covers the manifest the marketplace reads", () => {
		expect(versionTargets()).toContain(path.join(".claude-plugin", "plugin.json"));
	});
});

describe("dirtyTrackedFiles", () => {
	// Real `git status --porcelain=v2 --branch` shapes: header lines, then one record per path.
	const headers = "# branch.oid abc123\n# branch.head main\n";

	it("ignores headers and a clean tree", () => {
		expect(dirtyTrackedFiles(headers)).toEqual([]);
	});
	it("finds an ordinary modification", () => {
		const line = "1 .M N... 100644 100644 100644 abc def package.json";
		expect(dirtyTrackedFiles(headers + line)).toEqual(["package.json"]);
	});
	it("does not count untracked or ignored files", () => {
		const lines = "? scratch.txt\n! node_modules/\n";
		expect(dirtyTrackedFiles(headers + lines)).toEqual([]);
	});
	it("keeps spaces in a path instead of truncating at the first one", () => {
		const line = "1 .M N... 100644 100644 100644 abc def my notes.md";
		expect(dirtyTrackedFiles(headers + line)).toEqual(["my notes.md"]);
	});
	it("reports the new path of a rename, not the original", () => {
		const line = "2 R. N... 100644 100644 100644 abc def R100 new.ts\told.ts";
		expect(dirtyTrackedFiles(headers + line)).toEqual(["new.ts"]);
	});
	it("counts an unmerged path", () => {
		const line = "u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict.ts";
		expect(dirtyTrackedFiles(headers + line)).toEqual(["conflict.ts"]);
	});
});
