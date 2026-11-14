import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";

const projectRoot = resolve(import.meta.dirname, "..");
const root = mkdtempSync(join(tmpdir(), "pizza-egm-"));
const agentDir = join(root, "agent");
const cwd = join(root, "project");
const profiles = join(agentDir, "shepherdr", "profiles");
const profilePath = (role) => join(profiles, `egm-${role}`, "profile.json");
const profile = (role) => JSON.parse(readFileSync(profilePath(role), "utf8"));
process.env.PI_CODING_AGENT_DIR = agentDir;

try {
	mkdirSync(cwd);
	const document = join(cwd, "design with spaces.md");
	writeFileSync(document, "# Design\n\n## Detailed implementation plan\n");
	const outside = join(root, "outside.md");
	writeFileSync(outside, "private reference");
	symlinkSync(outside, join(cwd, "outside-link.md"));
	const planner = { provider: "example", id: "planner", reasoning: true };
	const fast = { provider: "example", id: "fast", reasoning: false };
	let available = [planner, fast];
	let branch = [];
	let selections = [];
	let inputs = [];
	let shepherdrAvailable = true;
	let agentsAvailable = true;
	let worker = false;
	let idle = true;
	let trusted = true;
	const notifications = [];
	const messages = [];
	const handlers = new Map();
	const commands = new Map();
	const pi = {
		on: (name, handler) => handlers.set(name, handler),
		registerCommand: (name, command) => commands.set(name, command),
		getThinkingLevel: () => "high",
		getAllTools: () => agentsAvailable ? [{ name: "agents" }] : [],
		appendEntry: (customType, data) => branch.push({ type: "custom", customType, data }),
		sendUserMessage: (message, options) => messages.push({ message, options }),
		events: { emit: (name, request) => {
			assert.equal(name, "shepherdr:worker-role:v1");
			if (shepherdrAvailable) request.reply(worker);
		} },
	};
	const ctx = {
		cwd,
		model: planner,
		hasUI: true,
		isIdle: () => idle,
		isProjectTrusted: () => trusted,
		sessionManager: { getBranch: () => branch },
		modelRegistry: { getAvailable: () => available },
		ui: {
			notify: (message, level) => notifications.push({ message, level }),
			select: async (title, options) => {
				const selection = selections.shift();
				return typeof selection === "number" ? options[selection] : selection;
			},
			input: async () => inputs.shift(),
		},
	};
	const { default: register } = await import(pathToFileURL(join(projectRoot, "extensions/egm/index.ts")));
	register(pi);
	const run = (args) => commands.get("egm").handler(args, ctx);
	const systemPrompt = () => handlers.get("before_agent_start")({ systemPrompt: "base system" }, ctx)?.systemPrompt;
	const active = () => branch.at(-1)?.data;
	const reports = () => readdirSync(cwd).filter((name) => name.startsWith(".egm-review-"));
	async function expectError(command, pattern) {
		const entries = branch.length;
		const turns = messages.length;
		const directories = reports();
		await run(command);
		assert.equal(notifications.at(-1).level, "error");
		assert.match(notifications.at(-1).message, pattern);
		assert.equal(branch.length, entries);
		assert.equal(messages.length, turns);
		assert.deepEqual(reports(), directories);
	}

	assert(!existsSync(agentDir), "loading the extension must not write global state");
	assert.equal(systemPrompt(), undefined);
	assert(JSON.parse(readFileSync(join(projectRoot, "package.json"))).pi.extensions.includes("./extensions/egm/index.ts"));
	await run("");
	assert.match(notifications.at(-1).message, /egm settings/);
	await expectError("review design with spaces.md", /setup first/);
	const shepherdrEntry = join(agentDir, "npm", "node_modules", "@howaboua", "pi-shepherdr", "index.ts");
	mkdirSync(resolve(shepherdrEntry, ".."), { recursive: true });
	writeFileSync(shepherdrEntry, "export default function () {}\n");

	// Setup refuses a colliding profile before creating or changing other profiles.
	mkdirSync(join(profiles, "egm-critic"), { recursive: true });
	writeFileSync(profilePath("critic"), "user profile");
	await expectError("setup", /unowned/);
	assert.equal(readFileSync(profilePath("critic"), "utf8"), "user profile");
	assert(!existsSync(profilePath("zoom-out")));
	rmSync(join(profiles, "egm-critic"), { recursive: true });
	await run("setup");
	assert.equal(notifications.at(-1).level, "info");
	const roles = ["zoom-out", "comprehension", "critic", "readiness", "code-review", "implementer"];
	for (const role of roles) {
		const saved = profile(role);
		assert.equal(saved.model, "example/planner", "no provider should be hardcoded");
		assert.equal(saved.thinking, "high");
		assert.equal(saved.share_context, false);
		assert.equal(saved.blocking, true);
		assert(!lstatSync(profilePath(role)).isSymbolicLink());
		assert.equal(lstatSync(profilePath(role)).mode & 0o777, 0o600);
		assert(existsSync(saved.prompt));
		if (role !== "implementer") {
			assert.equal(saved.pi_args[saved.pi_args.indexOf("--tools") + 1], "read,grep,find,ls");
			assert(saved.pi_args.includes("--no-extensions"));
			const extensions = saved.pi_args.flatMap((arg, index) => arg === "-e" ? [saved.pi_args[index + 1]] : []);
			assert.deepEqual(extensions, [shepherdrEntry, join(projectRoot, "extensions/underclass/index.ts"), join(projectRoot, "extensions/codex-multi-account/index.ts")]);
			for (const flag of ["--no-context-files", "--no-skills", "--no-prompt-templates", "--no-mcp"]) assert(saved.pi_args.includes(flag));
			assert.equal(saved.pi_args[saved.pi_args.indexOf("--system-prompt") + 1], saved.prompt);
			const appendPath = saved.pi_args[saved.pi_args.indexOf("--append-system-prompt") + 1];
			assert.equal(readFileSync(appendPath, "utf8").trim(), "");
		} else assert.deepEqual(saved.pi_args, []);
	}

	// Goldfish must not inherit automatic system or project context files.
	mkdirSync(join(cwd, ".pi", "extensions"), { recursive: true });
	writeFileSync(join(cwd, ".pi", "extensions", "unwanted.ts"), "throw Error(1);\n");
	for (const path of [join(agentDir, "SYSTEM.md"), join(agentDir, "APPEND_SYSTEM.md"), join(cwd, ".pi", "APPEND_SYSTEM.md"), join(cwd, "AGENTS.md")]) {
		writeFileSync(path, "UNRELATED_CONTEXT_SENTINEL");
	}
	const args = profile("critic").pi_args;
	const resources = new DefaultResourceLoader({
		cwd, agentDir,
		settingsManager: SettingsManager.inMemory(),
		additionalExtensionPaths: args.flatMap((arg, index) => arg === "-e" ? [args[index + 1]] : []),
		noExtensions: args.includes("--no-extensions"), noSkills: args.includes("--no-skills"),
		noPromptTemplates: args.includes("--no-prompt-templates"), noContextFiles: args.includes("--no-context-files"), noThemes: true,
		systemPrompt: args[args.indexOf("--system-prompt") + 1],
		appendSystemPrompt: [args[args.indexOf("--append-system-prompt") + 1]],
	});
	await resources.reload();
	assert.deepEqual(resources.getExtensions().errors, []);
	assert.equal(resources.getExtensions().extensions.length, 3);
	assert.match(resources.getSystemPrompt(), /Goldfish reviewer/);
	assert(!resources.getAppendSystemPrompt().join("").includes("UNRELATED_CONTEXT_SENTINEL"));
	assert.deepEqual(resources.getAgentsFiles().agentsFiles, []);

	// Change one role, preserve all others, and leave cancellation without a write.
	selections = [2, "example/fast", "off"];
	await run("settings");
	assert.equal(profile("critic").model, "example/fast");
	assert.equal(profile("critic").thinking, "off");
	assert.equal(profile("readiness").model, "example/planner");
	for (const selection of [[], [2], [2, "example/planner"]]) {
		selections = selection;
		await run("settings");
		assert.equal(profile("critic").model, "example/fast");
	}
	await run("setup");
	assert.equal(profile("critic").model, "example/fast", "setup must preserve role settings");
	ctx.hasUI = false;
	await expectError("settings", /interactive UI/);
	await expectError("review", /document path/);
	ctx.hasUI = true;

	// Corrupt or symlinked profile files must never be silently reset.
	const criticContents = readFileSync(profilePath("critic"), "utf8");
	writeFileSync(profilePath("critic"), "{broken");
	await expectError("setup", /JSON|property name/);
	assert.equal(readFileSync(profilePath("critic"), "utf8"), "{broken");
	rmSync(profilePath("critic"));
	symlinkSync(outside, profilePath("critic"));
	await expectError("setup", /unowned or symlinked/);
	assert.equal(readFileSync(outside, "utf8"), "private reference");
	rmSync(profilePath("critic"));
	writeFileSync(profilePath("critic"), criticContents);
	writeFileSync(profilePath("critic"), JSON.stringify({ ...profile("critic"), share_context: true }));
	await expectError("review design with spaces.md", /modified managed fields/);
	await run("setup");
	assert.equal(profile("critic").share_context, false);
	assert.equal(profile("critic").model, "example/fast");

	await expectError("review ../outside.md", /inside the project/);
	await expectError("review outside-link.md", /symlink target/);
	await expectError("review .", /must be a file/);
	await expectError("draft missing.md", /ENOENT/);
	trusted = false;
	await expectError("brainstorm a feature", /Trust this project/);
	trusted = true;
	shepherdrAvailable = false;
	await expectError("review design with spaces.md", /requires enabled pi-shepherdr/);
	shepherdrAvailable = true;
	agentsAvailable = false;
	await expectError("review design with spaces.md", /agents tool/);
	agentsAvailable = true;
	worker = true;
	await expectError("review design with spaces.md", /main session/);
	worker = false;
	available = [planner];
	await expectError("review design with spaces.md", /fast is unavailable/);
	available = [planner, fast];
	writeFileSync(profilePath("critic"), JSON.stringify({ ...profile("critic"), thinking: "high" }));
	await expectError("review design with spaces.md", /thinking level high is unsupported/);
	writeFileSync(profilePath("critic"), criticContents);

	await run("brainstorm add webhooks");
	assert.equal(active().phase, "brainstorm");
	assert.match(messages.at(-1).message, /add webhooks/);
	assert.match(systemPrompt(), /NO APPLICATION CODE/);
	await run("draft");
	assert.match(systemPrompt(), /ONE SECTION AT A TIME/);
	assert.match(systemPrompt(), /EVERY|every created, changed, or deleted file/);
	await run("draft design with spaces.md");
	assert.equal(active().target, document);
	inputs = [undefined];
	const turns = messages.length;
	await run("review");
	assert.equal(messages.length, turns, "cancelled path prompt must not start a turn");
	await run('review "design with spaces.md"');
	assert.equal(active().phase, "review");
	assert.equal(active().target, document);
	assert(existsSync(active().reportDir));
	assert.deepEqual(messages.at(-1).options, { deliverAs: "followUp" });
	let prompt = systemPrompt();
	const stages = JSON.parse(prompt.slice(prompt.indexOf("[\n")));
	assert.deepEqual(stages.map(({ spawn }) => spawn.agent_type), ["egm-zoom-out", "egm-comprehension", "egm-critic", "egm-zoom-out", "egm-readiness"]);
	for (const { spawn } of stages) {
		assert.equal(spawn.action, "spawn");
		assert.equal(spawn.blocking, true);
		assert.equal(spawn.cwd, cwd);
		assert.match(spawn.message, /Do not read conversation logs/);
		assert(!("board_thread_id" in spawn));
	}
	assert.match(prompt, /after saving EACH report/i);
	assert.match(prompt, /STOP until they answer/);
	assert.match(prompt, /NOT a passing review/);
	assert.match(prompt, /COMPLETE responses/);
	assert.match(prompt, /never assign, resume, or reuse/);
	assert.match(prompt, /close that worker/);
	const reviewBranch = [...branch];
	register(pi);
	assert.equal(systemPrompt(), prompt, "reload must restore the branch-local workflow");
	await run("status");
	assert.match(notifications.at(-1).message, /EGM: review/);
	assert(notifications.at(-1).message.includes("example/fast"));

	await run("implement design with spaces.md");
	assert.equal(active().phase, "implement");
	assert.match(systemPrompt(), /egm-implementer/);
	assert(!systemPrompt().includes("NO APPLICATION CODE"));
	await run("code-review design with spaces.md");
	assert.match(systemPrompt(), /egm-code-review/);
	assert.match(systemPrompt(), /NO APPLICATION CODE/);
	assert.equal(new Set(reports()).size, 3, "each run must have a new report directory");
	idle = false;
	await expectError("off", /current turn/);
	idle = true;
	await run("off");
	assert.equal(systemPrompt(), undefined);
	branch = reviewBranch;
	assert.match(systemPrompt(), /five stages/);
	branch = [];
	assert.equal(systemPrompt(), undefined, "a different branch must not inherit EGM mode");
	await expectError("unknown", /Unknown EGM command/);
	assert.equal(readFileSync(document, "utf8"), "# Design\n\n## Detailed implementation plan\n");
} finally {
	rmSync(root, { recursive: true, force: true });
}

console.log("EGM integration test passed");
