import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const root = mkdtempSync(join(tmpdir(), "pizza-integration-"));
const agentDir = join(root, "agent");
const sharedSkills = join(root, "home", ".agents", "skills");

function filesUnder(path) {
	if (!existsSync(path)) return [];
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const child = join(path, entry.name);
		return entry.isDirectory() ? filesUnder(child) : [child];
	});
}

try {
	mkdirSync(join(agentDir, "agents"), { recursive: true });
	mkdirSync(join(agentDir, "skills", "deepwiki"), { recursive: true });
	mkdirSync(join(sharedSkills, "grilling"), { recursive: true });
	writeFileSync(join(agentDir, "skills", "deepwiki", "marker"), "owned duplicate");
	writeFileSync(join(sharedSkills, "grilling", "marker"), "external skill");
	writeFileSync(join(agentDir, "mcp.json"), readFileSync(join(projectRoot, "mcp.json")));
	symlinkSync(join(projectRoot, "agents", "retired-agent.md"), join(agentDir, "agents", "retired-agent.md"));
	symlinkSync(join(projectRoot, "agents", "general-purpose.md"), join(agentDir, "agents", "my-worker-alias.md"));

	process.env.HOME = join(root, "home");
	process.env.PI_CODING_AGENT_DIR = agentDir;

	const commands = new Map();
	const notifications = [];
	let reloads = 0;
	let confirmAction = () => true;
	const pi = {
		on() {},
		registerCommand(name, command) {
			commands.set(name, command);
		},
		async exec() {
			throw new Error("Package installation is not part of this test");
		},
	};
	const ctx = {
		cwd: root,
		mode: "rpc",
		hasUI: true,
		isProjectTrusted: () => true,
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
			async confirm() {
				return confirmAction();
			},
			async custom() {
				throw new Error("TUI should not open in RPC mode");
			},
		},
		async reload() {
			reloads += 1;
		},
	};

	const { default: registerPizza } = await import(pathToFileURL(join(projectRoot, "extensions", "pizza.ts")));
	registerPizza(pi);
	assert(commands.has("pizza"), "Pizza command was not registered");

	// Change a target while confirmation is open. Setup must back up the current
	// file rather than delete it based on the earlier same-content inspection.
	confirmAction = () => {
		writeFileSync(join(agentDir, "mcp.json"), "replacement during confirmation");
		return true;
	};
	await commands.get("pizza").handler("setup", ctx);

	for (const name of ["deepwiki-research.md", "general-purpose.md", "svelte-file-editor.md"]) {
		const path = join(agentDir, "agents", name);
		assert(existsSync(path) && lstatSync(path).isSymbolicLink(), `Missing discovered agent link: ${name}`);
	}
	assert(lstatSync(join(agentDir, "mcp.json")).isSymbolicLink(), "MCP link was not installed");
	assert(!existsSync(join(agentDir, "agents", "retired-agent.md")), "Retired Pizza agent link was not removed");
	assert(lstatSync(join(agentDir, "agents", "my-worker-alias.md")).isSymbolicLink(), "User-created agent alias was removed");
	assert(!existsSync(join(agentDir, "skills", "deepwiki")), "Owned skill collision was not migrated");
	assert.equal(readFileSync(join(sharedSkills, "grilling", "marker"), "utf8"), "external skill");
	assert(
		filesUnder(join(agentDir, "pizza-backups")).some(
			(path) => readFileSync(path, "utf8") === "replacement during confirmation",
		),
		"Replacement file was not backed up",
	);

	mkdirSync(join(root, ".pi"), { recursive: true });
	writeFileSync(join(root, ".pi", "settings.json"), JSON.stringify({
		packages: ["git:https://github.com/edwrdc/pi-multi-codex"],
	}));
	notifications.length = 0;
	await commands.get("pizza").handler("doctor", ctx);
	assert.equal(notifications.at(-1)?.level, "warning", notifications.at(-1)?.message);
	assert.match(notifications.at(-1)?.message ?? "", /pi remove -l git:github\.com\/edwrdc\/pi-multi-codex/);
	rmSync(join(root, ".pi"), { recursive: true });

	notifications.length = 0;
	await commands.get("pizza").handler("doctor", ctx);
	assert.equal(notifications.at(-1)?.level, "info", notifications.at(-1)?.message);

	// Replace one owned link while unlink confirmation is open. Unlink must
	// revalidate and preserve the replacement regular file.
	confirmAction = () => {
		rmSync(join(agentDir, "mcp.json"));
		writeFileSync(join(agentDir, "mcp.json"), "user replacement");
		return true;
	};
	await commands.get("pizza").handler("unlink", ctx);
	assert.equal(readFileSync(join(agentDir, "mcp.json"), "utf8"), "user replacement");
	for (const name of ["deepwiki-research.md", "general-purpose.md", "svelte-file-editor.md"]) {
		assert(!existsSync(join(agentDir, "agents", name)), `Owned agent link survived unlink: ${name}`);
	}
	assert(lstatSync(join(agentDir, "agents", "my-worker-alias.md")).isSymbolicLink(), "User-created alias was removed by unlink");
	assert.equal(reloads, 2);
} finally {
	rmSync(root, { recursive: true, force: true });
}

console.log("Pizza integration test passed");
