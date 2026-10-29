import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createModels, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

// Underclass is registered as an OpenAI Responses provider backed by auth.json
// credentials. This test drives the extension without network by stubbing fetch.

const projectRoot = resolve(import.meta.dirname, "..");
const root = mkdtempSync(join(tmpdir(), "pizza-underclass-"));
const agentDir = join(root, "agent");
const authPath = join(agentDir, "auth.json");
const configPath = join(agentDir, "extensions", "underclass.json");
const pccPath = join(agentDir, "pi-codex-conversion.json");
const vendoredIds = [
	"gpt-5.3-codex-spark",
	"gpt-5.5",
	"gpt-5.6-luna",
	"gpt-5.6-sol",
	"gpt-5.6-terra",
	"gpt-6-astra",
	"gpt-6-luna",
	"gpt-6-sol",
	"gpt-6.1-sol",
	"gpt-6.1-terra",
	"gpt-daybreak-blue-latest",
	"gpt-daybreak-red-latest",
];

const originalFetch = globalThis.fetch;
process.env.PI_CODING_AGENT_DIR = agentDir;
delete process.env.UNDERCLASS_ORIGIN;
delete process.env.UNDERCLASS_PROXY_KEY;

try {
	mkdirSync(agentDir, { recursive: true });
	writeFileSync(authPath, JSON.stringify({ other: { type: "api_key", key: "keep" } }));

	const providers = [];
	const commands = new Map();
	const credentials = new InMemoryCredentialStore();
	const modelsPath = join(agentDir, "models.json");
	const runtime = await ModelRuntime.create({ credentials, modelsPath });
	const pi = {
		on() {},
		registerProvider(name, config) {
			runtime.registerProvider(name, config);
			providers.push(runtime.getProvider(name));
		},
		registerCommand(name, command) {
			commands.set(name, command);
		},
	};

	let fetchCalls = [];
	globalThis.fetch = async (url, init) => {
		fetchCalls.push({ url: String(url), headers: init?.headers });
		throw new Error(`Unexpected fetch: ${url}`);
	};

	const { default: underclassExtension } = await import(pathToFileURL(join(projectRoot, "extensions", "underclass", "index.ts")));
	const signal = new AbortController().signal;

	// 1. No credential and no stubbed endpoint: registration must still happen.
	await underclassExtension(pi);
	await runtime.refresh();
	assert.equal(fetchCalls.length, 0, "startup without a key must not call fetch");
	const registered = providers.at(-1);
	assert.equal(registered.id, "underclass");
	assert.equal(registered.name, "Underclass");
	assert.equal(registered.baseUrl, "https://underclass.edwrdc.me/v1");
	assert(registered.auth?.apiKey, "provider must expose api-key auth");
	// No key: the vendored codex catalog is registered as-is.
	const seeded = registered.getModels();
	assert.deepEqual(seeded.map((model) => model.id), vendoredIds);
	for (const model of seeded) {
		assert.equal(model.provider, "underclass");
		assert.equal(model.api, "openai-responses");
		assert.equal(model.baseUrl, "https://underclass.edwrdc.me/v1");
	}
	const vendoredSol = seeded.find((model) => model.id === "gpt-6.1-sol");
	assert.equal(vendoredSol.contextWindow, 500_000);
	assert.equal(vendoredSol.maxTokens, 128_000);
	const vendoredTerra = seeded.find((model) => model.id === "gpt-6.1-terra");
	assert.equal(vendoredTerra.name, "GPT-6.1 Terra");
	assert.equal(vendoredTerra.contextWindow, 500_000);
	assert.equal(vendoredTerra.maxTokens, 128_000);
	assert.deepEqual(vendoredTerra.input, ["text", "image"]);
	assert.equal(vendoredTerra.reasoning, true);
	assert.deepEqual(vendoredTerra.thinkingLevelMap, { off: null, minimal: null, xhigh: "xhigh", max: "max" });
	assert.deepEqual(vendoredTerra.cost, {
		input: 1, output: 5, cacheRead: 0.05, cacheWrite: 1.25,
		tiers: [{ inputTokensAbove: 272_000, input: 2, output: 7.5, cacheRead: 0.1, cacheWrite: 2.5 }],
	});

	const auth = registered.auth.apiKey;
	const ctx = { env: async () => undefined, fileExists: async () => false };
	assert(!runtime.getAvailableSnapshot().some((model) => model.provider === "underclass"));
	await assert.rejects(auth.resolve({ ctx, credential: undefined, signal }), /UNDERCLASS_PROXY_KEY/);
	assert.equal(
		(await auth.resolve({ ctx, credential: { type: "api_key", key: "sk-stored" }, signal })).auth.apiKey,
		"sk-stored",
	);
	assert.equal(
		(await auth.resolve({
			ctx: { env: async (name) => name === "UNDERCLASS_PROXY_KEY" ? "sk-env" : undefined, fileExists: async () => false },
			credential: undefined,
			signal,
		})).auth.apiKey,
		"sk-env",
	);
	assert.deepEqual(await auth.login({
		signal,
		prompt: async (prompt) => {
			assert.equal(prompt.type, "secret");
			return "sk-underclass-login";
		},
		notify() {},
	}), { type: "api_key", key: "sk-underclass-login" });

	// 2. Config JSON overrides the default origin (trailing slash trimmed, and a
	// pasted API root loses its /v1 suffix so admin paths stay reachable).
	mkdirSync(join(agentDir, "extensions"), { recursive: true });
	writeFileSync(configPath, JSON.stringify({ origin: "https://under.example.com/" }));
	await underclassExtension(pi);
	assert.equal(providers.at(-1).baseUrl, "https://under.example.com/v1");

	writeFileSync(configPath, JSON.stringify({ origin: "https://under.example.com/v1/" }));
	await underclassExtension(pi);
	assert.equal(providers.at(-1).baseUrl, "https://under.example.com/v1");

	// 3. Discovery appends underclass extras after the vendored catalog and
	// drops entries that only serve /v1/chat/completions.
	writeFileSync(authPath, JSON.stringify({
		other: { type: "api_key", key: "keep" },
		underclass: { type: "api_key", key: "sk-underclass-key" },
	}));
	await credentials.modify("underclass", async () => ({ type: "api_key", key: "sk-underclass-key" }));
	fetchCalls = [];
	globalThis.fetch = async (url, init) => {
		fetchCalls.push({ url: String(url), headers: init?.headers });
		if (String(url).endsWith("/v1/models")) {
			return { ok: true, status: 200, json: async () => ({ data: [
				{ id: "gpt-5.4", name: "GPT-5.4", context_window: 400_000, max_input_tokens: 272_000, max_output_tokens: 128_000, owned_by: "underclass-codex" },
				{ id: "gpt-4.1", name: "GPT-4.1", owned_by: "underclass-copilot" },
				{ id: "gpt-5.6-sol", name: "GPT-5.6 Sol", max_input_tokens: 999_999, max_output_tokens: 1, owned_by: "underclass-codex" },
				{ id: "mystery-model" },
				{ id: "mystery-model" },
			] }) };
		}
		throw new Error(`Unexpected fetch: ${url}`);
	};
	await underclassExtension(pi);
	assert.equal(fetchCalls.length, 0, "extension loading must not do network I/O");
	assert.equal((await runtime.refresh()).errors.size, 0);
	const discovered = providers.at(-1);
	const models = discovered.getModels();
	assert.deepEqual(models.map((model) => model.id), [...vendoredIds, "gpt-5.4", "mystery-model"]);
	for (const model of models) assert.equal(model.api, "openai-responses");
	assert.equal(fetchCalls.at(-1).url, "https://under.example.com/v1/models");
	assert.equal(fetchCalls.at(-1).headers.Authorization, "Bearer sk-underclass-key");
	assert(!models.some((model) => model.id === "gpt-4.1"), "copilot-only id must be excluded");

	// Discovered extras carry the underclass name and token limits.
	const gpt54 = models.find((model) => model.id === "gpt-5.4");
	assert.equal(gpt54.name, "GPT-5.4");
	assert.equal(gpt54.contextWindow, 272_000);
	assert.equal(gpt54.maxTokens, 128_000);
	assert.equal(gpt54.reasoning, false);
	assert.deepEqual(gpt54.input, ["text"]);
	assert.deepEqual(gpt54.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
	assert.equal(gpt54.provider, "underclass");
	assert.equal(gpt54.baseUrl, "https://under.example.com/v1");

	// Vendored entries keep their own metadata, ignoring the discovered copy.
	const vendoredGpt56 = models.find((model) => model.id === "gpt-5.6-sol");
	assert.equal(vendoredGpt56.contextWindow, 272_000);
	assert.equal(vendoredGpt56.maxTokens, 128_000);
	assert.equal(vendoredGpt56.reasoning, true);

	// Unknown ids fall back to text input, zero cost, and the constant defaults.
	assert.partialDeepStrictEqual(models.find((model) => model.id === "mystery-model"), {
		id: "mystery-model",
		name: "mystery-model",
		api: "openai-responses",
		provider: "underclass",
		baseUrl: "https://under.example.com/v1",
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200_000,
		maxTokens: 32_000,
		reasoning: false,
	});

	// PCC's stream override must preserve models, auth, and catalog refresh.
	const originalConfig = runtime.getRegisteredProviderConfig("underclass");
	const overlayStream = () => { throw new Error("PCC stream override reached"); };
	// PCC adds this partial registration when proxy Lite is enabled.
	runtime.registerProvider("underclass", { api: "openai-responses", streamSimple: overlayStream });
	await runtime.refresh();
	assert.deepEqual(runtime.getAvailableSnapshot().filter((model) => model.provider === "underclass").map((model) => model.id), models.map((model) => model.id));
	const overlaidConfig = runtime.getRegisteredProviderConfig("underclass");
	assert.equal(overlaidConfig.refreshModels, originalConfig.refreshModels);
	assert.equal(overlaidConfig.apiKey, originalConfig.apiKey);
	assert.equal(overlaidConfig.streamSimple, overlayStream);
	const overlaid = runtime.getProvider("underclass");
	const streamed = await overlaid.streamSimple(runtime.getModel("underclass", "gpt-6.1-sol"), { messages: [] }, {}).result();
	assert.equal(streamed.errorMessage, "PCC stream override reached");
	assert.equal((await runtime.getAuth("underclass")).auth.apiKey, "sk-underclass-key");

	// Refresh replaces extras, preserves cached models on failure, and supports offline startup.
	const modelFetch = globalThis.fetch;
	globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [{ id: "new-model" }] }) });
	assert.equal((await runtime.refresh()).errors.size, 0);
	const refreshedIds = [...vendoredIds, "new-model"];
	assert.deepEqual(discovered.getModels().map((model) => model.id), refreshedIds);
	for (const failingFetch of [
		async () => { throw new Error("network failure"); },
		async () => ({ ok: false, status: 503 }),
		async () => ({ ok: true, json: async () => ({}) }),
		async () => ({ ok: true, json: async () => { throw new SyntaxError("invalid JSON"); } }),
	]) {
		globalThis.fetch = failingFetch;
		assert.equal((await runtime.refresh()).errors.has("underclass"), true);
		assert.deepEqual(discovered.getModels().map((model) => model.id), refreshedIds);
	}

	const controller = new AbortController();
	globalThis.fetch = async (_url, init) => {
		assert(init.signal instanceof AbortSignal);
		controller.abort();
		assert.equal(init.signal.aborted, true, "caller cancellation must reach fetch");
		throw init.signal.reason;
	};
	assert.equal((await runtime.refresh({ signal: controller.signal })).aborted, true);
	assert.deepEqual(discovered.getModels().map((model) => model.id), refreshedIds);

	globalThis.fetch = async () => { throw new Error("offline refresh must not fetch"); };
	await underclassExtension(pi);
	assert.equal((await runtime.refresh({ allowNetwork: false })).errors.size, 0);
	assert.deepEqual(runtime.getModels("underclass").map((model) => model.id), refreshedIds);

	// A new Pi runtime must restore the catalog before and after PCC's startup override.
	const restarted = await ModelRuntime.create({ credentials, modelsPath });
	underclassExtension({ ...pi, registerProvider: (name, config) => restarted.registerProvider(name, config) });
	await restarted.refresh({ allowNetwork: false });
	assert.deepEqual(restarted.getAvailableSnapshot().filter((model) => model.provider === "underclass").map((model) => model.id), refreshedIds);
	restarted.registerProvider("underclass", { api: "openai-responses", streamSimple: overlayStream });
	await restarted.refresh({ allowNetwork: false });
	assert.deepEqual(restarted.getAvailableSnapshot().filter((model) => model.provider === "underclass").map((model) => model.id), refreshedIds);

	// Switching origins must not restore models that would send requests to the old host.
	writeFileSync(configPath, JSON.stringify({ origin: "https://other.example.com" }));
	await underclassExtension(pi);
	await runtime.refresh({ allowNetwork: false });
	assert.deepEqual(runtime.getModels("underclass").map((model) => model.id), vendoredIds);
	assert(runtime.getModels("underclass").every((model) => model.baseUrl === "https://other.example.com/v1"));
	writeFileSync(configPath, JSON.stringify({ origin: "https://under.example.com" }));
	await underclassExtension(pi);

	// A valid empty response removes discovered extras but keeps the vendored baseline.
	globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
	await runtime.refresh();
	assert.deepEqual(runtime.getModels("underclass").map((model) => model.id), vendoredIds);

	// Environment-only credentials also drive native discovery after login/refresh.
	process.env.UNDERCLASS_PROXY_KEY = "sk-env-discovery";
	globalThis.fetch = async (_url, init) => {
		assert.equal(init.headers.Authorization, "Bearer sk-env-discovery");
		return { ok: true, json: async () => ({ data: [{ id: "env-model" }] }) };
	};
	const envRuntime = createModels();
	envRuntime.setProvider(providers.at(-1));
	assert.equal((await envRuntime.refresh()).errors.size, 0);
	assert(envRuntime.getModel("underclass", "env-model"));
	delete process.env.UNDERCLASS_PROXY_KEY;
	globalThis.fetch = modelFetch;

	// 4. One command is registered and routes subcommands.
	assert(commands.has("underclass"), "Missing command: underclass");

	const notifications = [];
	const inputs = [];
	const commandCtx = {
		cwd: root,
		isProjectTrusted: () => false,
		modelRegistry: {
			refresh: (options) => runtime.refresh(options),
			getAll: () => runtime.getModels(),
		},
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
			async input() {
				return inputs.shift();
			},
		},
	};

	notifications.length = 0;
	await commands.get("underclass").handler("", commandCtx);
	assert.match(notifications.at(-1).message, /\/underclass setup/);
	assert(!notifications.at(-1).message.includes("/underclass refresh"));
	await commands.get("underclass").handler("refresh", commandCtx);
	assert.match(notifications.at(-1).message, /Unknown subcommand "refresh"/);
	await commands.get("underclass").handler("bogus", commandCtx);
	assert.equal(notifications.at(-1).level, "warning");
	assert.match(notifications.at(-1).message, /Unknown subcommand "bogus"/);

	// 4b. /underclass pcc merges into Codex Conversion's additional providers.
	writeFileSync(pccPath, JSON.stringify({
		scope: { allProviders: "off", additionalProviders: ["opencode-go"] },
		sibling: { keep: true },
	}));
	notifications.length = 0;
	await commands.get("underclass").handler("pcc", commandCtx);
	assert.equal(notifications.at(-1).level, "info");
	assert.match(notifications.at(-1).message, /Added underclass/);
	const pcc = JSON.parse(readFileSync(pccPath, "utf8"));
	assert.deepEqual(pcc.scope.additionalProviders, ["opencode-go", "underclass"]);
	assert.equal(pcc.scope.allProviders, "off");
	assert.deepEqual(pcc.sibling, { keep: true });
	assert.equal(statSync(pccPath).mode & 0o777, 0o600);

	// Duplicates are detected case- and whitespace-insensitively.
	writeFileSync(pccPath, JSON.stringify({
		scope: { allProviders: "off", additionalProviders: ["opencode-go", " Underclass "] },
		sibling: { keep: true },
	}));
	notifications.length = 0;
	await commands.get("underclass").handler("pcc", commandCtx);
	assert.match(notifications.at(-1).message, /already in Codex Conversion/);
	assert.deepEqual(
		JSON.parse(readFileSync(pccPath, "utf8")).scope.additionalProviders,
		["opencode-go", " Underclass "],
	);

	// A missing config is never created.
	rmSync(pccPath, { force: true });
	notifications.length = 0;
	await commands.get("underclass").handler("pcc", commandCtx);
	assert.match(notifications.at(-1).message, /not configured/);
	assert(!existsSync(pccPath), "pcc must not create pi-codex-conversion.json");

	// 5. setup merges the admin token into auth.json, preserves siblings, and
	// runs the Codex Conversion add step.
	writeFileSync(pccPath, JSON.stringify({ scope: { additionalProviders: [] }, sibling: { keep: true } }));
	inputs.push("https://self.example.com/", "ui-token-123");
	notifications.length = 0;
	await commands.get("underclass").handler("setup", commandCtx);
	assert.equal(notifications.at(-1).level, "info");
	const stored = JSON.parse(readFileSync(authPath, "utf8"));
	assert.deepEqual(stored.other, { type: "api_key", key: "keep" });
	assert.deepEqual(stored["underclass-admin"], { type: "api_key", key: "ui-token-123" });
	assert.deepEqual(stored.underclass, { type: "api_key", key: "sk-underclass-key" });
	assert.equal(statSync(authPath).mode & 0o777, 0o600);
	assert.equal(JSON.parse(readFileSync(configPath, "utf8")).origin, "https://self.example.com");
	assert.equal(providers.at(-1).baseUrl, "https://self.example.com/v1");
	const pccAfterSetup = JSON.parse(readFileSync(pccPath, "utf8"));
	assert.deepEqual(pccAfterSetup.scope.additionalProviders, ["underclass"]);
	assert.deepEqual(pccAfterSetup.sibling, { keep: true });

	// Failed discovery does not make setup reject after credentials were saved.
	globalThis.fetch = async () => ({ ok: false, status: 503 });
	inputs.push("https://self.example.com/", "ui-token-123");
	await commands.get("underclass").handler("setup", commandCtx);
	assert.equal(notifications.at(-1).level, "warning");
	assert.match(notifications.at(-1).message, /Origin and admin token saved/);

	// 6. Admin commands authenticate with the stored ui_token.
	fetchCalls = [];
	globalThis.fetch = async (url, init) => {
		fetchCalls.push({ url: String(url), headers: init?.headers });
		if (String(url) === "https://self.example.com/admin/api/state") {
			return {
				ok: true,
				status: 200,
				json: async () => ({
					accounts: [{ id: "acct-1", enabled: true }, { id: "acct-2", enabled: false }],
					requests: [{}, {}],
					catalog: {},
					now_ms: 1,
				}),
			};
		}
		throw new Error(`Unexpected fetch: ${url}`);
	};
	notifications.length = 0;
	await commands.get("underclass").handler("status", commandCtx);
	assert.equal(notifications.at(-1).level, "info");
	assert.match(notifications.at(-1).message, /accounts: 2 \(1 enabled, 1 disabled\)/);
	assert.equal(fetchCalls.at(-1).url, "https://self.example.com/admin/api/state");
	assert.equal(fetchCalls.at(-1).headers.Authorization, "Bearer ui-token-123");

	notifications.length = 0;
	await commands.get("underclass").handler("accounts", commandCtx);
	assert.match(notifications.at(-1).message, /acct-1: enabled/);
	assert.match(notifications.at(-1).message, /acct-2: disabled/);

	// 7. Admin commands warn and point at setup when no token is stored.
	const withoutAdmin = JSON.parse(readFileSync(authPath, "utf8"));
	delete withoutAdmin["underclass-admin"];
	writeFileSync(authPath, JSON.stringify(withoutAdmin));
	notifications.length = 0;
	await commands.get("underclass").handler("status", commandCtx);
	assert.equal(notifications.at(-1).level, "warning");
	assert.match(notifications.at(-1).message, /Run \/underclass setup/);
} finally {
	if (originalFetch === undefined) delete globalThis.fetch;
	else globalThis.fetch = originalFetch;
	delete process.env.PI_CODING_AGENT_DIR;
	delete process.env.UNDERCLASS_ORIGIN;
	delete process.env.UNDERCLASS_PROXY_KEY;
	rmSync(root, { recursive: true, force: true });
}

console.log("Underclass integration test passed");
