import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { ROLE_NAMES, ROLES, type Role } from "./prompts.ts";

const OWNER = "pizza-egm-v1\n";
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export interface RoleSettings {
	model: string;
	thinking: ModelThinkingLevel;
}

function directory(role: Role): string {
	return join(getAgentDir(), "shepherdr", "profiles", `egm-${role}`);
}

function reviewerExtensions(): string[] {
	// shortcut: reviewers load only Shepherdr and Pizza providers; add vetted providers when another model needs one.
	return [
		join(getAgentDir(), "npm", "node_modules", "@howaboua", "pi-shepherdr", "index.ts"),
		fileURLToPath(new URL("../underclass/index.ts", import.meta.url)),
		fileURLToPath(new URL("../codex-multi-account/index.ts", import.meta.url)),
	];
}

function checkReviewerFiles(): void {
	for (const path of reviewerExtensions()) readFileSync(path);
	if (!readFileSync(new URL("./goldfish.md", import.meta.url), "utf8").trim()) throw new Error("The EGM Goldfish system prompt is empty.");
	if (readFileSync(new URL("./empty-prompt.md", import.meta.url), "utf8").trim()) throw new Error("The EGM empty append prompt is not empty.");
}

function stat(path: string) {
	try {
		return lstatSync(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

function profile(role: Role, settings: RoleSettings) {
	const prompt = fileURLToPath(new URL(role === "implementer" ? "./implementer.md" : "./goldfish.md", import.meta.url));
	return {
		description: `Pizza EGM ${ROLES[role].title.toLowerCase()}`,
		...settings,
		blocking: true,
		share_context: false,
		prompt,
		pi_args: role === "implementer" ? [] : [
			"--no-extensions", ...reviewerExtensions().flatMap((path) => ["-e", path]),
			"--tools", "read,grep,find,ls",
			"--no-context-files", "--no-skills", "--no-prompt-templates", "--no-mcp",
			"--system-prompt", prompt,
			"--append-system-prompt", fileURLToPath(new URL("./empty-prompt.md", import.meta.url)),
		],
	};
}

function readOwnedProfile(role: Role): Record<string, unknown> | undefined {
	const root = directory(role);
	const entry = stat(root);
	if (!entry) return undefined;
	const marker = join(root, ".pizza-egm");
	const path = join(root, "profile.json");
	if (!entry.isDirectory() || !stat(marker)?.isFile() || readFileSync(marker, "utf8") !== OWNER || !stat(path)?.isFile()) {
		throw new Error(`Refusing to change unowned or symlinked EGM profile: ${root}`);
	}
	const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Invalid EGM profile: ${path}`);
	return parsed as Record<string, unknown>;
}

function settingsFrom(value: Record<string, unknown>): RoleSettings {
	if (typeof value.model !== "string" || !/^\S+\/\S+$/.test(value.model) ||
		typeof value.thinking !== "string" || !THINKING_LEVELS.includes(value.thinking)) {
		throw new Error("EGM profiles need a provider/model and a valid thinking level.");
	}
	return { model: value.model, thinking: value.thinking as ModelThinkingLevel };
}

function writeProfile(root: string, role: Role, settings: RoleSettings): void {
	const path = join(root, "profile.json");
	const temp = `${path}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temp, `${JSON.stringify(profile(role, settings), null, 2)}\n`, { flag: "wx", mode: 0o600 });
		renameSync(temp, path);
	} finally {
		rmSync(temp, { force: true });
	}
}

export function setupProfiles(defaults: RoleSettings): void {
	settingsFrom({ ...defaults });
	checkReviewerFiles();
	// Check every existing profile before changing any of them.
	const current = ROLE_NAMES.map((role) => {
		const saved = readOwnedProfile(role);
		return { role, settings: saved ? settingsFrom(saved) : defaults };
	});
	for (const { role, settings } of current) {
		const root = directory(role);
		if (!stat(root)) {
			mkdirSync(dirname(root), { recursive: true });
			const staging = mkdtempSync(join(getAgentDir(), "shepherdr", ".egm-"));
			try {
				writeProfile(staging, role, settings);
				writeFileSync(join(staging, ".pizza-egm"), OWNER, { flag: "wx", mode: 0o600 });
				renameSync(staging, root);
			} finally {
				rmSync(staging, { recursive: true, force: true });
			}
		} else {
			readOwnedProfile(role);
			writeProfile(root, role, settings);
		}
	}
}

export function readSettings(role: Role): RoleSettings {
	const saved = readOwnedProfile(role);
	if (!saved) throw new Error("EGM profiles are missing. Run /egm setup first.");
	const settings = settingsFrom(saved);
	if (!isDeepStrictEqual(saved, profile(role, settings))) {
		throw new Error(`egm-${role} has modified managed fields. Run /egm setup to restore them without changing its model settings.`);
	}
	if (role !== "implementer") checkReviewerFiles();
	return settings;
}

export function updateSettings(role: Role, settings: RoleSettings): void {
	readSettings(role);
	writeProfile(directory(role), role, settingsFrom({ ...settings }));
}
