import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const CODEX_CONVERSION_USAGE_PATH = join(
	"npm",
	"node_modules",
	"@howaboua",
	"pi-codex-conversion",
	"dist",
	"ui",
	"settings",
	"usage.js",
);
const PATCH_ANCHOR = 'if (model.provider !== "openai-codex") {';
const PATCH_REPLACEMENT = 'if (!/^openai-codex(-\\d+)?$/.test(model.provider)) {';

export type UsagePatchState =
	| { kind: "patched"; version: string; path: string; already: boolean }
	| { kind: "drifted"; version: string; path: string }
	| { kind: "absent" };

type CodexConversionPaths = { filePath: string; packagePath: string };

function agentDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR?.trim() || process.env.PI_AGENT_DIR?.trim();
	if (!configured) return join(homedir(), ".pi", "agent");
	if (configured === "~") return homedir();
	if (configured.startsWith("~/")) return resolve(homedir(), configured.slice(2));
	return resolve(configured);
}

function packagePaths(root: string): CodexConversionPaths {
	return {
		filePath: join(root, CODEX_CONVERSION_USAGE_PATH),
		packagePath: join(root, "npm", "node_modules", "@howaboua", "pi-codex-conversion", "package.json"),
	};
}

export function codexConversionPaths(cwd?: string, projectConfigDir = ".pi"): CodexConversionPaths {
	if (cwd) {
		const projectPaths = packagePaths(join(cwd, projectConfigDir));
		if (existsSync(projectPaths.packagePath)) return projectPaths;
	}
	const root = agentDir();
	return packagePaths(root);
}

export function ensureUsagePatched(cwd?: string, projectConfigDir = ".pi"): UsagePatchState {
	const { filePath, packagePath } = codexConversionPaths(cwd, projectConfigDir);
	let version = "unknown";
	try {
		version = (JSON.parse(readFileSync(packagePath, "utf8")) as { version?: string }).version ?? "unknown";
	} catch {
		return { kind: "absent" };
	}

	let source: string;
	try {
		source = readFileSync(filePath, "utf8");
	} catch {
		return { kind: "absent" };
	}

	const replacementCount = source.split(PATCH_REPLACEMENT).length - 1;
	const anchorCount = source.split(PATCH_ANCHOR).length - 1;
	if (replacementCount === 2 && anchorCount === 0) {
		return { kind: "patched", version, path: filePath, already: true };
	}
	if (replacementCount !== 0 || anchorCount !== 2) {
		return { kind: "drifted", version, path: filePath };
	}

	try {
		writeFileSync(filePath, source.split(PATCH_ANCHOR).join(PATCH_REPLACEMENT));
	} catch {
		return { kind: "drifted", version, path: filePath };
	}

	return { kind: "patched", version, path: filePath, already: false };
}

export function unpatchUsage(cwd?: string, projectConfigDir = ".pi"): { ok: boolean; message: string } {
	const { filePath } = codexConversionPaths(cwd, projectConfigDir);
	const inspection = inspectUsagePatch(filePath);
	if (inspection.kind === "absent") {
		return { ok: false, message: "Codex Conversion is not installed (usage.js was not found)." };
	}
	if (inspection.kind === "pristine") {
		return { ok: true, message: "Codex Conversion usage.js is not patched." };
	}
	if (inspection.kind === "drifted") {
		return { ok: false, message: `Unexpected patch state. Inspect ${filePath} manually.` };
	}

	try {
		writeFileSync(filePath, inspection.source.split(PATCH_REPLACEMENT).join(PATCH_ANCHOR));
	} catch (error) {
		return { ok: false, message: `Failed to restore ${filePath}: ${error instanceof Error ? error.message : String(error)}` };
	}

	return {
		ok: true,
		message: "Restored the original Codex Conversion checks for this checkout. Disable Pizza's Multi Codex extension before restarting or reloading Pi if the patch must remain disabled.",
	};
}

type PatchInspection =
	| { kind: "absent" }
	| { kind: "pristine"; source: string }
	| { kind: "patched"; source: string }
	| { kind: "drifted"; source: string };

function inspectUsagePatch(filePath: string): PatchInspection {
	let source: string;
	try {
		source = readFileSync(filePath, "utf8");
	} catch {
		return { kind: "absent" };
	}

	const replacementCount = source.split(PATCH_REPLACEMENT).length - 1;
	const anchorCount = source.split(PATCH_ANCHOR).length - 1;
	if (replacementCount === 0 && anchorCount === 2) return { kind: "pristine", source };
	if (replacementCount === 2 && anchorCount === 0) return { kind: "patched", source };
	return { kind: "drifted", source };
}

export function unpatchAllUsage(cwd?: string, projectConfigDir = ".pi"): { ok: boolean; message: string } {
	const userPaths = codexConversionPaths();
	const projectPaths = cwd ? codexConversionPaths(cwd, projectConfigDir) : userPaths;
	const candidates = projectPaths.filePath === userPaths.filePath
		? [{ label: "user", cwd: undefined, ...userPaths }]
		: [
			{ label: "user", cwd: undefined, ...userPaths },
			{ label: "project", cwd, ...projectPaths },
		];
	const targets = candidates
		.map((target) => ({ ...target, inspection: inspectUsagePatch(target.filePath) }))
		.filter((target) => existsSync(target.packagePath) && target.inspection.kind !== "absent");
	if (targets.length === 0) return { ok: false, message: "Codex Conversion is not installed." };
	const invalid = targets.filter((target) => target.inspection.kind === "drifted");
	if (invalid.length > 0) {
		return {
			ok: false,
			message: invalid.map((target) => `${target.label}: Unexpected patch state. Inspect ${target.filePath} manually.`).join("\n"),
		};
	}
	const results = targets.map((target) => ({
		label: target.label,
		result: unpatchUsage(target.cwd, projectConfigDir),
	}));
	return {
		ok: results.every((entry) => entry.result.ok),
		message: results.map((entry) => `${entry.label}: ${entry.result.message}`).join("\n"),
	};
}
