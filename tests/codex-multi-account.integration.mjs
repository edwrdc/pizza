import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

// Multi Codex clones the base openai-codex provider with numbered ids. Clone
// models keep api="openai-codex-responses" and the canonical base URL, so
// Codex Conversion 3.0.15+ accepts them without any patching.

const projectRoot = resolve(import.meta.dirname, "..");
const root = mkdtempSync(join(tmpdir(), "pizza-multi-codex-"));
process.env.PI_CODING_AGENT_DIR = join(root, "agent");

try {
	const authPath = join(root, "auth.json");
	writeFileSync(authPath, JSON.stringify({
		"openai-codex-2": { type: "oauth", access: "test-access", refresh: "test-refresh", expires: Date.now() + 3_600_000 },
	}));
	const runtime = await ModelRuntime.create({ authPath, modelsPath: null, modelsStorePath: join(root, "models-store") });
	const commands = new Map();
	const providers = [];
	const pi = {
		on() {},
		registerCommand(name, command) {
			commands.set(name, command);
		},
		registerProvider(provider, config) {
			providers.push(typeof provider === "string" ? { id: provider, ...config } : provider);
			if (typeof provider === "string") runtime.registerProvider(provider, config);
			else runtime.registerNativeProvider(provider);
		},
	};

	const extensionPath = pathToFileURL(join(projectRoot, "extensions", "codex-multi-account", "index.ts"));
	const { default: registerMultiCodex } = await import(extensionPath);
	registerMultiCodex(pi);

	assert.deepEqual(providers.map((provider) => provider.id), ["openai-codex-2", "openai-codex-3", "openai-codex-4"]);
	for (const name of ["codex-accounts", "codex-switch", "codex-usage-all"]) {
		assert(commands.has(name), `Missing command: ${name}`);
	}

	// Conversion applies this named overlay after Pizza's registration. Native
	// clones used to lose their OAuth and models here, prompting for an API key.
	const clone = runtime.getProvider("openai-codex-2");
	const originalModels = clone.getModels();
	const overlayStream = clone.streamSimple.bind(clone);
	runtime.registerProvider("openai-codex-2", { api: "openai-codex-responses", streamSimple: overlayStream });
	await runtime.refresh({ allowNetwork: false });
	const overlaid = runtime.getProvider("openai-codex-2");
	assert(overlaid.auth.oauth, "Streaming overlay must retain ChatGPT OAuth");
	assert.equal(overlaid.auth.apiKey, undefined, "Clone must not become an API-key provider");
	assert.deepEqual(overlaid.getModels(), originalModels);
	assert.equal((await runtime.checkAuth("openai-codex-2")).type, "oauth");
	assert(runtime.getAvailableSnapshot().some((model) => model.provider === "openai-codex-2"));
	assert.equal((await runtime.getAuth("openai-codex-2")).auth.apiKey, "test-access");

	// Exercise login dispatch without opening a browser or making a request.
	const signal = new AbortController().signal;
	await assert.rejects(overlaid.auth.oauth.login({
		signal,
		prompt: async (prompt) => {
			assert.equal(prompt.type, "select");
			assert(prompt.options.some((option) => option.id === "browser"));
			assert(prompt.options.some((option) => option.id === "device_code"));
			throw new Error("test login cancelled");
		},
		notify() {},
	}), /test login cancelled/);
	const cancel = new AbortController();
	const cancelledLogin = overlaid.auth.oauth.login({
		signal: cancel.signal,
		prompt: () => new Promise(() => {}),
		notify() {},
	});
	cancel.abort(new Error("test aborted"));
	await assert.rejects(cancelledLogin, /test aborted/);

	// Two users may share a ChatGPT account ID. Reproduce Conversion's single
	// account-keyed cache and ensure the command isolates it by provider.
	const usageDir = join(root, "agent", "npm", "node_modules", "@howaboua", "pi-codex-conversion", "dist", "codex-usage");
	mkdirSync(usageDir, { recursive: true });
	writeFileSync(join(usageDir, "package.json"), JSON.stringify({ type: "module" }));
	writeFileSync(join(usageDir, "client.js"), `
let resetCache;
export async function fetchCodexUsage(ctx) {
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
  if (!resetCache || resetCache.key !== auth.accountId) {
    resetCache = { key: auth.accountId, value: { availableCount: auth.resetCount, credits: [] } };
  }
  return { resetCredits: resetCache.value };
}
`);
	writeFileSync(join(usageDir, "format.js"), `
export function formatCodexUsage(snapshot) { return 'resets available: ' + snapshot.resetCredits.availableCount; }
`);
	const notifications = [];
	const usageCtx = {
		cwd: projectRoot,
		isProjectTrusted: () => false,
		modelRegistry: {
			getProviderAuth: async (id) => ["openai-codex", "openai-codex-2"].includes(id) ? { source: "OAuth" } : undefined,
			getAll: () => runtime.getModels(),
			getApiKeyAndHeaders: async (model) => ({ accountId: "shared-account", resetCount: model.provider === "openai-codex" ? 4 : 3 }),
		},
		ui: { notify: (message) => notifications.push(message) },
	};
	// Bundled Pi transpiles imports with Jiti instead of using native TS loading.
	// That transform used to discard the query distinguishing account clients.
	const hostRequire = createRequire(import.meta.resolve("@earendil-works/pi-coding-agent"));
	const { createJiti } = await import(pathToFileURL(hostRequire.resolve("jiti")).href);
	const jiti = createJiti(import.meta.url, { tryNative: false, moduleCache: false });
	const registerTranspiled = await jiti.import(extensionPath.href, { default: true });
	const transpiledCommands = new Map();
	registerTranspiled({
		registerProvider() {},
		registerCommand: (name, command) => transpiledCommands.set(name, command),
	});
	// Transpiled first: preloading clients natively can hide VM import failures.
	for (const commandSet of [transpiledCommands, commands]) {
		for (let attempt = 0; attempt < 2; attempt++) {
			await commandSet.get("codex-usage-all").handler("", usageCtx);
			const report = notifications.at(-1);
			assert.match(report, /== openai-codex ==\nresets available: 4/);
			assert.match(report, /== openai-codex-2 ==\nresets available: 3/);
		}
	}
} finally {
	rmSync(root, { recursive: true, force: true });
}

console.log("Multi Codex integration test passed");
