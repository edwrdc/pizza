import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

// Opt-in check against installed packages. All session data stays in this fixture.
const installedAgentDir = getAgentDir();
const boardEntry = join(installedAgentDir, "npm/node_modules/@howaboua/pi-agent-board/index.ts");
const shepherdrEntry = join(installedAgentDir, "npm/node_modules/@howaboua/pi-shepherdr/index.ts");
assert(existsSync(boardEntry) && existsSync(shepherdrEntry), "Install pi-agent-board and pi-shepherdr globally through Pi before this test.");
const hostRequire = createRequire(boardEntry);
// shortcut: Board needs the host SDK, switch to dev peers once Pizza pins Pi 1.5+.
const devModules = resolve(import.meta.dirname, "../node_modules") + sep;
const piExecutable = process.env.PATH.split(delimiter).map((directory) => join(directory, "pi"))
	.find((path) => existsSync(path) && !realpathSync(path).startsWith(devModules));
assert(piExecutable, "A current Node-based Pi installation must be on PATH.");
let hostRoot = dirname(realpathSync(piExecutable));
while (!existsSync(join(hostRoot, "package.json"))) {
	assert.notEqual(hostRoot, dirname(hostRoot), "Cannot locate Pi's installed SDK.");
	hostRoot = dirname(hostRoot);
}
assert.equal(JSON.parse(readFileSync(join(hostRoot, "package.json"), "utf8")).name, "@earendil-works/pi-coding-agent");
const sdkEntry = join(hostRoot, "dist/index.js");
const sdk = await import(pathToFileURL(sdkEntry));
const jiti = createJiti(import.meta.url, { alias: {
	"@earendil-works/pi-coding-agent": sdkEntry,
	"@earendil-works/pi-tui": join(hostRoot, "../pi-tui/dist/index.js"),
	"@earendil-works/pi-agent-core": join(hostRoot, "../pi-agent-core/dist/index.js"),
	"@earendil-works/pi-ai/providers/all": join(hostRoot, "../pi-ai/dist/providers/all.js"),
	"@earendil-works/pi-ai/models": join(hostRoot, "../pi-ai/dist/models.js"),
	"@earendil-works/pi-ai/oauth": join(hostRoot, "../pi-ai/dist/oauth.js"),
	"@earendil-works/pi-ai/compat": join(hostRoot, "dist/core/extensions/pi-ai-extension-view.js"),
	"@earendil-works/pi-ai": join(hostRoot, "dist/core/extensions/pi-ai-extension-view.js"),
} });
const root = mkdtempSync(join(tmpdir(), "pizza-egm-board-"));
const agentDir = join(root, "agent");
const cwd = join(root, "project");
process.env.PI_CODING_AGENT_DIR = agentDir;
const fixtures = [];

function session() {
	const manager = sdk.SessionManager.inMemory(cwd);
	const handlers = new Map();
	const tools = new Map();
	const commands = new Map();
	const messages = [];
	const notifications = [];
	let activeTools = [];
	const fixture = { idle: true, tools, commands, messages, notifications };
	const pi = {
		events: sdk.createEventBus(),
		on(name, handler) {
			const list = handlers.get(name) ?? [];
			list.push(handler);
			handlers.set(name, list);
		},
		registerCommand: (name, command) => commands.set(name, command),
		registerTool: (tool) => tools.set(tool.name, tool),
		registerMessageRenderer() {},
		registerEntryRenderer() {},
		getActiveTools: () => activeTools,
		setActiveTools: (names) => { activeTools = names; },
		getFlag: () => undefined,
		getSessionName: () => "EGM Board test",
		appendEntry: (type, data) => manager.appendCustomEntry(type, data),
		sendMessage: (message, options) => {
			assert.notEqual(options?.triggerTurn, true, "Board must not start a model turn");
			messages.push({ message, options });
		},
		sendUserMessage() { throw new Error("This test must not start a model turn"); },
	};
	const ctx = {
		cwd, mode: "print", hasUI: false, sessionManager: manager,
		isIdle: () => fixture.idle,
		isProjectTrusted: () => true,
		getContextUsage: () => undefined,
		modelRegistry: {
			getAvailable: () => [],
			getAll: () => [],
			complete() { throw new Error("This test must not request a model"); },
		},
		ui: {
			notify: (message, level) => notifications.push({ message, level }),
			setWidget() {},
		},
	};
	Object.assign(fixture, { pi, ctx, async emit(name) {
		const results = [];
		for (const handler of [...(handlers.get(name) ?? [])]) results.push(await handler({ type: name }, ctx));
		return results;
	} });
	fixtures.push(fixture);
	return fixture;
}

try {
	mkdirSync(cwd, { recursive: true });
	const { default: registerBoard } = await jiti.import(boardEntry);
	const { acquireBoard, discoverBoard } = await jiti.import(hostRequire.resolve("@howaboua/pi-agent-board/runtime"));
	const { binding, saveMember } = await jiti.import(hostRequire.resolve("@howaboua/pi-agent-board/integration"));
	const parent = session();
	await registerBoard(parent.pi);
	const board = await acquireBoard(parent.pi);
	await parent.emit("session_start");
	assert.equal(board.enabled(parent.ctx), true);
	assert(parent.tools.has("board"));
	const archive = join(cwd, ".pi/agent-message-board.sqlite");
	assert(!existsSync(archive), "loading Board must not create its archive");
	await parent.commands.get("board").handler("status", parent.ctx);
	assert.match(parent.notifications.at(-1).message, /Board on/);

	const member = session();
	await registerBoard(member.pi);
	const memberBoard = await acquireBoard(member.pi);
	await member.emit("session_start");
	// In-memory transport between fixture sessions; no agent processes or sockets.
	memberBoard.attach({
		request: (route, request, signal) => {
			assert.equal(route, "test-owner");
			return board.handle(parent.ctx, request, signal);
		},
		async propagateEnabled() {},
	});
	const memberBinding = await memberBoard.handle(member.ctx, {
		operation: "board-bind", binding: { ...binding(parent.ctx), upstream: "test-owner" },
	});
	saveMember(parent.pi, memberBinding);
	board.attach({
		routeNotice: (_ctx, request, signal) => memberBoard.handle(member.ctx, request, signal),
		propagateEnabled: (_ctx, enabled) => memberBoard.handle(member.ctx, {
			operation: "board-enabled", boardId: binding(parent.ctx).boardId, enabled,
		}),
	});
	await board.execute(parent.ctx, { action: "create_channel", channel_name: "egm-test" }, "channel");
	await memberBoard.execute(member.ctx, { action: "subscribe", channel_name: "egm-test" }, "subscribe");
	const seed = { action: "post", channel_name: "egm-test", text: "ELEPHANT_ONLY_BOARD_SENTINEL" };
	const post = await board.execute(parent.ctx, seed, "seed");
	assert.equal((await board.execute(parent.ctx, seed, "seed")).message_id, post.message_id, "retry must not duplicate a post");
	assert(existsSync(archive));
	const unread = await memberBoard.promptCatchup(member.ctx);
	assert(unread.content.includes(post.thread_id), "a regular member must receive unread thread context");
	unread.accepted();
	assert.equal((await memberBoard.promptCatchup(member.ctx)).content, "");
	const thread = await memberBoard.execute(member.ctx, { action: "read_thread", thread_id: post.thread_id }, "read");
	assert(JSON.stringify(thread).includes(seed.text));
	await memberBoard.execute(member.ctx, { action: "post", thread_id: post.thread_id, text: "MEMBER_REPLY_SENTINEL" }, "reply");
	const toolResult = await parent.tools.get("board").execute("native-read", { action: "read_thread", thread_id: post.thread_id }, new AbortController().signal, undefined, parent.ctx);
	assert(JSON.stringify(toolResult.content).includes("MEMBER_REPLY_SENTINEL"));
	await assert.rejects(board.handle(parent.ctx, {
		operation: "board-call", caller: { ...memberBinding, sessionId: "unbound", agentName: "/unbound" },
		params: { action: "read_thread", thread_id: post.thread_id }, requestId: "unbound-read",
	}), /Caller not bound/);

	member.idle = false;
	await member.emit("agent_start");
	await board.execute(parent.ctx, { action: "post", channel_name: "egm-test", text: "ACTIVE_NOTICE_SENTINEL" }, "active-post");
	const notice = member.messages.find(({ message }) => message.customType === "shepherdr-board-post");
	assert(notice?.message.content.includes("ACTIVE_NOTICE_SENTINEL"));
	assert.equal(notice.options.deliverAs, "steer");
	await member.emit("agent_end");
	member.idle = true;
	const messageCount = member.messages.length;
	await board.execute(parent.ctx, { action: "post", channel_name: "egm-test", text: "IDLE_NOTICE_SENTINEL" }, "idle-post");
	assert.equal(member.messages.length, messageCount, "Board must not wake idle members");

	await board.setSetting(parent.ctx, "session", false);
	assert.equal(memberBoard.enabled(member.ctx), false);
	await assert.rejects(memberBoard.execute(member.ctx, { action: "read_thread", thread_id: post.thread_id }, "off-read"), /Board is off/);
	await board.setSetting(parent.ctx, "session", true);
	assert.equal(memberBoard.enabled(member.ctx), true);
	assert(JSON.stringify(await board.execute(parent.ctx, { action: "read_thread", thread_id: post.thread_id }, "after-enable")).includes(seed.text));

	// A configured Board owner still loads without Goldfish isolation flags.
	const settings = sdk.SettingsManager.inMemory({ extensions: [boardEntry] });
	const controlBus = sdk.createEventBus();
	const control = new sdk.DefaultResourceLoader({ cwd, agentDir, settingsManager: settings, eventBus: controlBus, noSkills: true, noThemes: true });
	await control.reload();
	assert.deepEqual(control.getExtensions().errors, []);
	let controlBoard;
	discoverBoard({ events: controlBus, on() {} }, (runtime) => { controlBoard = runtime; });
	await Promise.resolve();
	assert(controlBoard, "positive control must discover the real installed Board owner");
	assert.equal(controlBoard.enabled(parent.ctx), true);

	const localShepherdr = join(agentDir, "npm/node_modules/@howaboua/pi-shepherdr/index.ts");
	mkdirSync(dirname(localShepherdr), { recursive: true });
	symlinkSync(shepherdrEntry, localShepherdr);
	const { setupProfiles } = await import(pathToFileURL(resolve(import.meta.dirname, "../extensions/egm/profiles.ts")));
	setupProfiles({ model: "example/planner", thinking: "high" });
	const args = JSON.parse(readFileSync(join(agentDir, "shepherdr/profiles/egm-critic/profile.json"), "utf8")).pi_args;
	const isolatedBus = sdk.createEventBus();
	const isolated = new sdk.DefaultResourceLoader({
		cwd, agentDir, settingsManager: settings, eventBus: isolatedBus,
		additionalExtensionPaths: args.flatMap((arg, index) => arg === "-e" ? [args[index + 1]] : []),
		noExtensions: args.includes("--no-extensions"), noSkills: args.includes("--no-skills"),
		noPromptTemplates: args.includes("--no-prompt-templates"), noContextFiles: args.includes("--no-context-files"), noThemes: true,
		systemPrompt: args[args.indexOf("--system-prompt") + 1],
		appendSystemPrompt: [args[args.indexOf("--append-system-prompt") + 1]],
	});
	await isolated.reload();
	assert.deepEqual(isolated.getExtensions().errors, []);
	assert.equal(isolated.getExtensions().extensions.length, 3);
	let isolatedBoard;
	discoverBoard({ events: isolatedBus, on() {} }, (runtime) => { isolatedBoard = runtime; });
	await Promise.resolve();
	assert.equal(isolatedBoard, undefined, "Goldfish must not load a Board owner or its catch-up hooks");
	assert(!JSON.stringify(isolated.getAgentsFiles()).includes(seed.text));
	assert(!isolated.getSystemPrompt().includes(seed.text));
	for (const fixture of fixtures) assert(!fixture.notifications.some(({ level }) => level === "warning" || level === "error"), JSON.stringify(fixture.notifications));
	const version = JSON.parse(readFileSync(join(dirname(boardEntry), "package.json"), "utf8")).version;
	console.log(`EGM Board integration passed with pi-agent-board ${version}: posts, membership, catch-up, notifications, enablement, and Goldfish exclusion.`);
} finally {
	for (const fixture of fixtures.reverse()) await fixture.emit("session_shutdown");
	rmSync(root, { recursive: true, force: true });
}
