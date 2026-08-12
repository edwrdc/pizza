import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader, DynamicBorder, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";
import { cpSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const AGENT_DIR = resolveAgentDir();
const SETTINGS_PATH = join(AGENT_DIR, "settings.json");
const PACKAGE_SKILL_NAMES = packageSkillNames();

const SUPPORT_LINKS = [
	...packageAgentNames().map((name) => ({
		label: `agent ${name.replace(/\.md$/, "")}`,
		source: join(PACKAGE_ROOT, "agents", name),
		target: join(AGENT_DIR, "agents", name),
	})),
	{
		label: "MCP configuration",
		source: join(PACKAGE_ROOT, "mcp.json"),
		target: join(AGENT_DIR, "mcp.json"),
	},
] as const;

interface CatalogPackage {
	id: string;
	label: string;
	source: string;
	description: string;
}

interface PackageInstallResult {
	changed: boolean;
	complete: boolean;
	installed: CatalogPackage[];
}

const PACKAGE_CATALOG = loadPackageCatalog();

type LinkState = "linked" | "same-content" | "missing" | "conflict";

interface SupportInspection {
	label: string;
	source: string;
	target: string;
	state: LinkState;
}

type SupportLink = (typeof SUPPORT_LINKS)[number];

function packageSkillNames(): string[] {
	const root = join(PACKAGE_ROOT, "skills");
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && pathExists(join(root, entry.name, "SKILL.md")))
		.map((entry) => entry.name)
		.sort();
}

function packageAgentNames(): string[] {
	const root = join(PACKAGE_ROOT, "agents");
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => entry.name)
		.sort();
}

function resolveAgentDir(): string {
	const configured = process.env.PI_CODING_AGENT_DIR?.trim();
	if (!configured) return join(homedir(), ".pi", "agent");
	if (configured === "~") return homedir();
	if (configured.startsWith("~/")) return resolve(homedir(), configured.slice(2));
	return resolve(configured);
}

function loadPackageCatalog(): CatalogPackage[] {
	const path = join(PACKAGE_ROOT, "catalog", "community-packages.json");
	const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
	if (!Array.isArray(parsed)) throw new Error(`Pizza package catalog must be an array: ${path}`);

	return parsed.map((entry, index) => {
		if (!entry || typeof entry !== "object") throw new Error(`Invalid Pizza package catalog entry ${index + 1}`);
		const candidate = entry as Partial<CatalogPackage>;
		if (![candidate.id, candidate.label, candidate.source, candidate.description].every((value) => typeof value === "string" && value.length > 0)) {
			throw new Error(`Invalid Pizza package catalog entry ${index + 1}`);
		}
		return candidate as CatalogPackage;
	});
}

function resolvedSymlinkTarget(target: string): string | undefined {
	try {
		if (!lstatSync(target).isSymbolicLink()) return undefined;
		return resolve(dirname(target), readlinkSync(target));
	} catch {
		return undefined;
	}
}

function isOwnedSymlink(source: string, target: string): boolean {
	return resolvedSymlinkTarget(target) === resolve(source);
}

function isPackageAgentSymlink(target: string): boolean {
	const source = resolvedSymlinkTarget(target);
	return source !== undefined
		&& dirname(source) === resolve(PACKAGE_ROOT, "agents")
		&& source.endsWith(".md")
		&& basename(source) === basename(target)
		&& !pathExists(source);
}

function pathExists(path: string): boolean {
	try {
		lstatSync(path);
		return true;
	} catch {
		return false;
	}
}

function inspectLink(entry: SupportLink): SupportInspection {
	if (!pathExists(entry.target)) return { ...entry, state: "missing" };
	if (isOwnedSymlink(entry.source, entry.target)) return { ...entry, state: "linked" };

	try {
		if (!lstatSync(entry.target).isSymbolicLink() && readFileSync(entry.target).equals(readFileSync(entry.source))) {
			return { ...entry, state: "same-content" };
		}
	} catch {
		// Directories, broken links, and unreadable files are conflicts.
	}

	return { ...entry, state: "conflict" };
}

function inspectSupport(): SupportInspection[] {
	return SUPPORT_LINKS.map(inspectLink);
}

function staleAgentLinks(): SupportLink[] {
	const root = join(AGENT_DIR, "agents");
	const currentTargets = new Set(SUPPORT_LINKS.map((entry) => resolve(entry.target)));
	try {
		return readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isSymbolicLink() && entry.name.endsWith(".md"))
			.map((entry) => {
				const target = join(root, entry.name);
				return {
					label: `retired agent ${entry.name.replace(/\.md$/, "")}`,
					source: resolvedSymlinkTarget(target) ?? "",
					target,
				};
			})
			.filter((entry) => !currentTargets.has(resolve(entry.target)) && isPackageAgentSymlink(entry.target));
	} catch {
		return [];
	}
}

function looseSkills(): string[] {
	const roots = [join(AGENT_DIR, "skills"), join(homedir(), ".agents", "skills")];
	return [...new Set(roots.flatMap((root) => PACKAGE_SKILL_NAMES.map((name) => resolve(root, name))))].filter(pathExists);
}

function backupPath(timestamp: string, target: string): string {
	const relative = target.startsWith(`${AGENT_DIR}/`) ? target.slice(AGENT_DIR.length + 1) : target.replace(/^\/+/, "");
	return join(AGENT_DIR, "pizza-backups", timestamp, relative);
}

function moveToBackup(timestamp: string, target: string): string {
	const destination = backupPath(timestamp, target);
	mkdirSync(dirname(destination), { recursive: true });
	try {
		renameSync(target, destination);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
		try {
			cpSync(target, destination, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
		} catch (copyError) {
			rmSync(destination, { recursive: true, force: true });
			throw copyError;
		}
		// Keep the completed backup if source cleanup fails.
		rmSync(target, { recursive: true, force: true });
	}
	return destination;
}

function restoreBackup(backup: string, target: string): void {
	mkdirSync(dirname(target), { recursive: true });
	cpSync(backup, target, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
	rmSync(backup, { recursive: true, force: true });
}

function installSupportLinks(): string[] {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backups: string[] = [];
	const moved: Array<{ target: string; backup: string }> = [];
	const createdLinks: SupportLink[] = [];

	try {
		// Re-read all targets after confirmation instead of acting on the prompt snapshot.
		for (const skillPath of looseSkills()) {
			const backup = moveToBackup(timestamp, skillPath);
			backups.push(backup);
			moved.push({ target: skillPath, backup });
		}

		for (const entry of SUPPORT_LINKS) {
			if (!pathExists(entry.source)) throw new Error(`Missing Pizza support source: ${entry.source}`);
			if (isOwnedSymlink(entry.source, entry.target)) continue;
			mkdirSync(dirname(entry.target), { recursive: true });
			if (pathExists(entry.target)) {
				const backup = moveToBackup(timestamp, entry.target);
				backups.push(backup);
				moved.push({ target: entry.target, backup });
			}
			symlinkSync(entry.source, entry.target, "file");
			createdLinks.push(entry);
		}
	} catch (error) {
		const rollbackErrors: unknown[] = [];
		for (const entry of createdLinks.reverse()) {
			try {
				if (isOwnedSymlink(entry.source, entry.target)) rmSync(entry.target);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		}
		for (const entry of moved.reverse()) {
			try {
				if (!pathExists(entry.backup)) continue;
				if (pathExists(entry.target)) throw new Error(`Could not restore backup because target exists: ${entry.target}`);
				restoreBackup(entry.backup, entry.target);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		}
		if (rollbackErrors.length > 0) throw new AggregateError([error, ...rollbackErrors], "Pizza setup failed and rollback was incomplete");
		throw error;
	}

	// These are symlinks into this package whose source agent was removed by an update.
	for (const entry of staleAgentLinks()) {
		if (isPackageAgentSymlink(entry.target)) rmSync(entry.target);
	}

	return backups;
}

function readConfiguredPackageSources(): string[] {
	try {
		const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as {
			packages?: Array<string | { source?: string }>;
		};
		return (settings.packages ?? [])
			.map((entry) => (typeof entry === "string" ? entry : entry.source))
			.filter((source): source is string => typeof source === "string");
	} catch {
		return [];
	}
}

function packageIdentity(source: string): string | undefined {
	const trimmed = source.trim();
	if (trimmed.startsWith("npm:")) {
		const spec = trimmed.slice(4);
		const versionSeparator = spec.startsWith("@") ? spec.indexOf("@", spec.indexOf("/") + 1) : spec.indexOf("@");
		return `npm:${(versionSeparator < 0 ? spec : spec.slice(0, versionSeparator)).toLowerCase()}`;
	}

	const raw = trimmed.startsWith("git:") ? trimmed.slice(4).trim() : trimmed;
	let host: string;
	let pathWithRef: string;
	const scp = raw.match(/^git@([^:]+):(.+)$/);
	if (scp) {
		host = scp[1] ?? "";
		pathWithRef = scp[2] ?? "";
	} else if (/^(https?|ssh|git):\/\//i.test(raw)) {
		try {
			const parsed = new URL(raw);
			host = parsed.hostname;
			pathWithRef = parsed.pathname.replace(/^\/+/, "");
		} catch {
			return undefined;
		}
	} else {
		const slash = raw.indexOf("/");
		if (slash < 0) return undefined;
		host = raw.slice(0, slash);
		pathWithRef = raw.slice(slash + 1);
	}

	const refSeparator = pathWithRef.indexOf("@");
	const repoPath = (refSeparator < 0 ? pathWithRef : pathWithRef.slice(0, refSeparator))
		.replace(/\.git$/, "")
		.replace(/\/+$/, "");
	if (!host || repoPath.split("/").length < 2) return undefined;
	return `git:${host.toLowerCase()}/${repoPath.toLowerCase()}`;
}

function installedCatalogIds(): Set<string> {
	const identities = new Set(readConfiguredPackageSources().map(packageIdentity).filter((value): value is string => Boolean(value)));
	return new Set(
		PACKAGE_CATALOG.filter((entry) => {
			const identity = packageIdentity(entry.source);
			return identity !== undefined && identities.has(identity);
		}).map((entry) => entry.id),
	);
}

async function choosePackages(ctx: ExtensionCommandContext): Promise<CatalogPackage[]> {
	if (ctx.mode !== "tui") {
		ctx.ui.notify("/pizza packages requires TUI mode", "error");
		return [];
	}

	const installed = installedCatalogIds();
	const selected = new Set<string>();

	await ctx.ui.custom((tui, theme, _keybindings, done) => {
		const items: SettingItem[] = PACKAGE_CATALOG.map((entry) => {
			const isInstalled = installed.has(entry.id);
			return {
				id: entry.id,
				label: entry.label,
				description: `${entry.description}\n${entry.source}`,
				currentValue: isInstalled ? "installed" : "skip",
				values: isInstalled ? undefined : ["skip", "install"],
			};
		});

		const container = new Container();
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Pizza package pantry")), 1, 0));
		container.addChild(
			new Text(
				theme.fg("muted", "Choose independent community packages to install. Pizza never removes them."),
				1,
				0,
			),
		);

		const settings = new SettingsList(
			items,
			Math.min(items.length + 2, 14),
			getSettingsListTheme(),
			(id, value) => {
				if (value === "install") selected.add(id);
				else selected.delete(id);
			},
			() => done(undefined),
			{ enableSearch: true },
		);
		container.addChild(settings);
		container.addChild(new Text(theme.fg("dim", "Esc closes the list, then reviews your selections."), 1, 0));
		container.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));

		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				settings.handleInput(data);
				tui.requestRender();
			},
		};
	});

	return PACKAGE_CATALOG.filter((entry) => selected.has(entry.id));
}

async function installPackages(pi: ExtensionAPI, ctx: ExtensionCommandContext, packages: CatalogPackage[]): Promise<PackageInstallResult> {
	if (packages.length === 0) return { changed: false, complete: true, installed: [] };

	return (
		(await ctx.ui.custom<PackageInstallResult>((tui, theme, _keybindings, done) => {
			const installed: CatalogPackage[] = [];
			const loader = new BorderedLoader(tui, theme, `Installing ${packages.length} package${packages.length === 1 ? "" : "s"}…`);
			loader.onAbort = () => done({ changed: installed.length > 0, complete: false, installed: [...installed] });

			void (async () => {
				for (const entry of packages) {
					if (loader.signal.aborted) return;
					const result = await pi.exec("pi", ["install", entry.source], { signal: loader.signal });
					if (result.code !== 0) {
						ctx.ui.notify(`Could not install ${entry.label}: ${result.stderr.trim() || result.stdout.trim()}`, "error");
						done({ changed: installed.length > 0, complete: false, installed: [...installed] });
						return;
					}
					installed.push(entry);
				}
				done({ changed: installed.length > 0, complete: true, installed: [...installed] });
			})().catch((error: unknown) => {
				ctx.ui.notify(`Package installation failed: ${error instanceof Error ? error.message : String(error)}`, "error");
				done({ changed: installed.length > 0, complete: false, installed: [...installed] });
			});

			return loader;
		})) ?? { changed: false, complete: false, installed: [] }
	);
}

async function runPackageSelector(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<boolean> {
	const selected = await choosePackages(ctx);
	if (selected.length === 0) {
		ctx.ui.notify("No new packages selected", "info");
		return false;
	}
	if (!(await ctx.ui.confirm(
		"Install community packages?",
		selected.map((entry) => `${entry.label}\n  ${entry.source}`).join("\n\n"),
	))) {
		ctx.ui.notify("Package installation cancelled", "info");
		return false;
	}

	const result = await installPackages(pi, ctx, selected);
	if (result.installed.length > 0) {
		ctx.ui.notify(
			`${result.complete ? "Installed" : "Partially installed"}: ${result.installed.map((entry) => entry.label).join(", ")}`,
			result.complete ? "info" : "warning",
		);
	}
	return result.changed;
}

function doctorReport(): { healthy: boolean; text: string } {
	const inspections = inspectSupport();
	const duplicates = looseSkills();
	const staleLinks = staleAgentLinks();
	const problems = inspections.filter((entry) => entry.state !== "linked");
	const installed = installedCatalogIds();

	const lines = [
		"Pizza doctor",
		"",
		...inspections.map((entry) => `${entry.state === "linked" ? "✓" : "!"} ${entry.label}: ${entry.state}`),
		...staleLinks.map((entry) => `! ${entry.label}: stale link`),
		`${duplicates.length === 0 ? "✓" : "!"} package skills: ${duplicates.length === 0 ? "no loose duplicates" : `${duplicates.length} loose duplicate(s)`}`,
		"",
		"Independent packages:",
		...PACKAGE_CATALOG.map((entry) => `${installed.has(entry.id) ? "✓" : "·"} ${entry.label}`),
	];

	return { healthy: problems.length === 0 && duplicates.length === 0 && staleLinks.length === 0, text: lines.join("\n") };
}

async function setup(pi: ExtensionAPI, ctx: ExtensionCommandContext, assumeYes: boolean): Promise<void> {
	const inspections = inspectSupport();
	const duplicates = looseSkills();
	const staleLinks = staleAgentLinks();
	const conflicts = inspections.filter((entry) => entry.state === "conflict");
	const changes = inspections.filter((entry) => entry.state !== "linked").length + duplicates.length + staleLinks.length;

	if (changes > 0) {
		let approved = assumeYes;
		if (!approved && ctx.hasUI) {
			const details = [
				`${inspections.filter((entry) => entry.state !== "linked").length} support link(s)`,
				`${duplicates.length} loose skill director${duplicates.length === 1 ? "y" : "ies"} to migrate`,
				...(staleLinks.length > 0 ? [`${staleLinks.length} retired agent link(s) to remove`] : []),
				...(conflicts.length > 0 ? [`${conflicts.length} conflicting file(s) will be backed up`] : []),
			].join("\n");
			approved = await ctx.ui.confirm("Set up Pizza?", details);
		}

		if (!approved) {
			ctx.ui.notify("Setup cancelled. Use /pizza setup --yes for non-interactive approval.", "info");
			return;
		}

		const backups = installSupportLinks();
		ctx.ui.notify(
			backups.length > 0
				? `Pizza support configured. Previous files were saved under ${join(AGENT_DIR, "pizza-backups")}.`
				: "Pizza support configured.",
			"info",
		);
	}

	const packagesChanged = await runPackageSelector(pi, ctx);
	if (changes > 0 || packagesChanged) {
		await ctx.reload();
		return;
	}

	ctx.ui.notify("Pizza is already configured", "info");
}

async function unlinkSupport(ctx: ExtensionCommandContext, assumeYes: boolean): Promise<void> {
	const owned = [...SUPPORT_LINKS.filter((entry) => isOwnedSymlink(entry.source, entry.target)), ...staleAgentLinks()];
	if (owned.length === 0) {
		ctx.ui.notify("No Pizza-owned support links found", "info");
		return;
	}

	let approved = assumeYes;
	if (!approved && ctx.hasUI) {
		approved = await ctx.ui.confirm(
			"Unlink Pizza support?",
			`Remove ${owned.length} Pizza-owned link(s)? Independent packages and backups are left untouched.`,
		);
	}
	if (!approved) return;

	let removed = 0;
	for (const entry of owned) {
		// Revalidate after confirmation so a replacement file is never removed.
		if (!isOwnedSymlink(entry.source, entry.target)) continue;
		rmSync(entry.target);
		removed += 1;
	}
	ctx.ui.notify(`Removed ${removed} Pizza-owned support link(s)`, "info");
	await ctx.reload();
}

export default function pizzaExtension(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		if (inspectSupport().some((entry) => entry.state !== "linked") || looseSkills().length > 0 || staleAgentLinks().length > 0) {
			ctx.ui.notify("Pizza needs setup. Run /pizza setup when ready.", "info");
		}
	});

	pi.registerCommand("pizza", {
		description: "Set up Pizza support files and optional community packages",
		handler: async (args, ctx) => {
			const [subcommand = "setup", ...flags] = args.trim().split(/\s+/).filter(Boolean);
			const assumeYes = flags.includes("--yes") || flags.includes("-y");

			switch (subcommand) {
				case "setup":
					await setup(pi, ctx, assumeYes);
					return;
				case "packages": {
					const changed = await runPackageSelector(pi, ctx);
					if (changed) await ctx.reload();
					return;
				}
				case "doctor": {
					const report = doctorReport();
					ctx.ui.notify(report.text, report.healthy ? "info" : "warning");
					return;
				}
				case "unlink":
					await unlinkSupport(ctx, assumeYes);
					return;
				default:
					ctx.ui.notify("Usage: /pizza [setup|packages|doctor|unlink] [--yes]", "error");
			}
		},
	});
}
