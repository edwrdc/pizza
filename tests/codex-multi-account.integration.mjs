import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const root = mkdtempSync(join(tmpdir(), "pizza-multi-codex-"));
const agentDir = join(root, "agent");
const packageDir = join(agentDir, "npm", "node_modules", "@howaboua", "pi-codex-conversion");
const usagePath = join(packageDir, "dist", "ui", "settings", "usage.js");
const anchor = 'if (model.provider !== "openai-codex") {';
const originalUsage = `export function fetchUsage(model) {\n${anchor}\n  throw new Error("unsupported");\n}\n${anchor}\n  throw new Error("unsupported");\n}\n`;

try {
	mkdirSync(join(packageDir, "dist", "ui", "settings"), { recursive: true });
	writeFileSync(join(packageDir, "package.json"), JSON.stringify({ version: "3.0.13" }));
	writeFileSync(usagePath, originalUsage);
	process.env.PI_CODING_AGENT_DIR = agentDir;

	const commands = new Map();
	const providers = [];
	const sessionStartHandlers = [];
	const pi = {
		on(event, handler) {
			if (event === "session_start") sessionStartHandlers.push(handler);
		},
		registerCommand(name, command) {
			commands.set(name, command);
		},
		registerProvider(provider) {
			providers.push(provider);
		},
	};

	const extensionPath = pathToFileURL(join(projectRoot, "extensions", "codex-multi-account", "index.ts"));
	const { default: registerMultiCodex } = await import(extensionPath);
	registerMultiCodex(pi);

	assert.deepEqual(providers.map((provider) => provider.id), ["openai-codex-2", "openai-codex-3", "openai-codex-4"]);
	for (const name of ["codex-accounts", "codex-switch", "codex-usage-all", "codex-usage-unpatch"]) {
		assert(commands.has(name), `Missing command: ${name}`);
	}
	assert.match(readFileSync(usagePath, "utf8"), /openai-codex\(-\\d\+\)\?/);

	const notifications = [];
	for (const handler of sessionStartHandlers) {
		handler({}, {
			cwd: root,
			isProjectTrusted: () => false,
			ui: { notify: (message, level) => notifications.push({ message, level }) },
		});
	}
	assert.equal(notifications.at(-1)?.level, "info");
	assert.match(notifications.at(-1)?.message ?? "", /Patched Codex Conversion v3\.0\.13/);

	await commands.get("codex-usage-unpatch").handler("", {
		cwd: root,
		isProjectTrusted: () => false,
		ui: { notify: (message, level) => notifications.push({ message, level }) },
	});
	assert.equal(readFileSync(usagePath, "utf8"), originalUsage);

	const patchModulePath = pathToFileURL(join(projectRoot, "extensions", "codex-multi-account", "usage-patch.ts"));
	const { codexConversionPaths, ensureUsagePatched } = await import(patchModulePath);
	writeFileSync(usagePath, `${anchor}\n`);
	const driftedSource = readFileSync(usagePath, "utf8");
	assert.equal(ensureUsagePatched().kind, "drifted");
	assert.equal(readFileSync(usagePath, "utf8"), driftedSource, "Drifted source was modified");

	const replacement = 'if (!/^openai-codex(-\\d+)?$/.test(model.provider)) {';
	writeFileSync(usagePath, `${replacement}\n${anchor}\n`);
	const partialSource = readFileSync(usagePath, "utf8");
	assert.equal(ensureUsagePatched().kind, "drifted");
	assert.equal(readFileSync(usagePath, "utf8"), partialSource, "Partial patch state was modified");

	const projectCwd = join(root, "project");
	const projectPackageDir = join(projectCwd, ".pi", "npm", "node_modules", "@howaboua", "pi-codex-conversion");
	const projectUsagePath = join(projectPackageDir, "dist", "ui", "settings", "usage.js");
	mkdirSync(join(projectPackageDir, "dist", "ui", "settings"), { recursive: true });
	writeFileSync(join(projectPackageDir, "package.json"), JSON.stringify({ version: "project" }));
	writeFileSync(projectUsagePath, originalUsage);
	assert.equal(codexConversionPaths(projectCwd).filePath, projectUsagePath);
	assert.equal(ensureUsagePatched(projectCwd).kind, "patched");
	assert.match(readFileSync(projectUsagePath, "utf8"), /openai-codex\(-\\d\+\)\?/);
	writeFileSync(usagePath, originalUsage);
	ensureUsagePatched();
	await commands.get("codex-usage-unpatch").handler("", {
		cwd: projectCwd,
		isProjectTrusted: () => true,
		ui: { notify: (message, level) => notifications.push({ message, level }) },
	});
	assert.equal(readFileSync(usagePath, "utf8"), originalUsage, "User patch was not restored");
	assert.equal(readFileSync(projectUsagePath, "utf8"), originalUsage, "Project patch was not restored");

	writeFileSync(usagePath, `${replacement}\n${replacement}\n${anchor}\n`);
	const unexpectedUnpatchSource = readFileSync(usagePath, "utf8");
	await commands.get("codex-usage-unpatch").handler("", {
		cwd: root,
		isProjectTrusted: () => false,
		ui: { notify: (message, level) => notifications.push({ message, level }) },
	});
	assert.equal(notifications.at(-1)?.level, "error");
	assert.equal(readFileSync(usagePath, "utf8"), unexpectedUnpatchSource, "Unexpected source was modified by unpatch");

	rmSync(join(packageDir, "package.json"));
	writeFileSync(projectUsagePath, originalUsage);
	ensureUsagePatched(projectCwd);
	await commands.get("codex-usage-unpatch").handler("", {
		cwd: projectCwd,
		isProjectTrusted: () => true,
		ui: { notify: (message, level) => notifications.push({ message, level }) },
	});
	assert.equal(notifications.at(-1)?.level, "info", "Project-only unpatch reported an error");
	assert.equal(readFileSync(projectUsagePath, "utf8"), originalUsage, "Project-only patch was not restored");

	assert.equal(ensureUsagePatched().kind, "absent");
	assert(existsSync(usagePath), "Absent-package check modified usage.js");
} finally {
	rmSync(root, { recursive: true, force: true });
}

console.log("Multi Codex integration test passed");
