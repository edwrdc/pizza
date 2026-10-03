import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
} finally {
	rmSync(root, { recursive: true, force: true });
}

console.log("Multi Codex integration test passed");
