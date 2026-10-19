import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir, readStoredCredential } from "@earendil-works/pi-coding-agent";
import type { ApiKeyAuth, ApiKeyCredential, AuthResult, Model, Provider } from "@earendil-works/pi-ai";
import { createProvider } from "@earendil-works/pi-ai";
import { openAIResponsesApi } from "@earendil-works/pi-ai/compat";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatAccounts, formatStatus, formatUsage } from "./admin.ts";
import { CODEX_MODELS, type LocalCodexModel } from "./codex-models.ts";

const PROVIDER_ID = "underclass";
const ADMIN_CREDENTIAL_ID = "underclass-admin";
const DEFAULT_ORIGIN = "https://underclass.edwrdc.me";
const PROXY_KEY_ENV = "UNDERCLASS_PROXY_KEY";
const ORIGIN_ENV = "UNDERCLASS_ORIGIN";
// Discovered ids that are not in the vendored catalog use these fallbacks.
const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEFAULT_MAX_TOKENS = 32_000;

const HELP = [
	"/underclass setup     Set the origin and store the admin ui_token",
	"/underclass status    Summarize admin state (accounts, flow)",
	"/underclass accounts  List accounts from admin state",
	"/underclass usage     Show usage totals and top model groups",
	"/underclass refresh   Re-discover models and re-register the provider",
	"/underclass pcc       Add underclass to Codex Conversion's providers",
	"/underclass help      Show this help",
].join("\n");

function authFilePath(): string {
	return join(getAgentDir(), "auth.json");
}

function configFilePath(): string {
	return join(getAgentDir(), "extensions", "underclass.json");
}

function normalizeOrigin(value: string | undefined): string | undefined {
	// People paste the API root from the docs; the origin itself carries no /v1 path.
	const trimmed = (value ?? "").trim().replace(/\/+$/, "").replace(/\/v1$/i, "").replace(/\/+$/, "");
	if (!trimmed) return undefined;
	try {
		const protocol = new URL(trimmed).protocol;
		return protocol === "http:" || protocol === "https:" ? trimmed : undefined;
	} catch {
		return undefined;
	}
}

function resolveOrigin(): string {
	const fromEnv = normalizeOrigin(process.env[ORIGIN_ENV]);
	if (fromEnv) return fromEnv;
	try {
		const parsed = JSON.parse(readFileSync(configFilePath(), "utf8")) as { origin?: unknown };
		const fromConfig = typeof parsed.origin === "string" ? normalizeOrigin(parsed.origin) : undefined;
		if (fromConfig) return fromConfig;
	} catch {
		// Missing or unreadable config falls back to the default origin.
	}
	return DEFAULT_ORIGIN;
}

function readJsonObject(path: string): Record<string, unknown> {
	let contents: string;
	try {
		contents = readFileSync(path, "utf8");
	} catch {
		return {};
	}
	if (!contents.trim()) return {};
	const parsed = JSON.parse(contents) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${path} is not a JSON object`);
	return parsed as Record<string, unknown>;
}

function atomicWrite(path: string, contents: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(temp, contents, { mode: 0o600 });
	renameSync(temp, path);
}

function readAdminToken(): string | undefined {
	const credential = readStoredCredential(ADMIN_CREDENTIAL_ID, authFilePath());
	return credential?.type === "api_key" ? credential.key : undefined;
}

function readProxyKey(): string | undefined {
	const credential = readStoredCredential(PROVIDER_ID, authFilePath());
	return credential?.type === "api_key" ? credential.key : undefined;
}

const proxyKeyAuth: ApiKeyAuth = {
	name: "Underclass proxy key",
	async login(interaction): Promise<ApiKeyCredential> {
		const key = await interaction.prompt({
			type: "secret",
			message: "Enter Underclass proxy key (sk-underclass-…)",
		});
		return { type: "api_key", key: key.trim() };
	},
	async resolve({ ctx, credential }): Promise<AuthResult | undefined> {
		const stored = credential?.type === "api_key" ? credential.key?.trim() : undefined;
		const apiKey = stored || (await ctx.env(PROXY_KEY_ENV))?.trim();
		if (!apiKey) return undefined;
		return { auth: { apiKey }, source: stored ? "auth.json" : PROXY_KEY_ENV };
	},
};

function positiveNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

type UnderclassModel = {
	id: string;
	name?: string;
	contextWindow?: number;
	maxTokens?: number;
};

function parseModel(value: unknown): UnderclassModel | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	if (typeof record.id !== "string" || !record.id) return undefined;
	// Copilot-backed ids only serve /v1/chat/completions, not /v1/responses.
	if (typeof record.owned_by === "string" && !record.owned_by.includes("codex")) return undefined;
	return {
		id: record.id,
		name: typeof record.name === "string" && record.name ? record.name : undefined,
		// context_window is the total window; Pi wants the input budget.
		contextWindow: positiveNumber(record.max_input_tokens) ?? positiveNumber(record.context_window),
		maxTokens: positiveNumber(record.max_output_tokens),
	};
}

function vendoredModel(origin: string, model: LocalCodexModel): Model<"openai-responses"> {
	return { ...model, api: "openai-responses", provider: PROVIDER_ID, baseUrl: `${origin}/v1` };
}

function extraModel(origin: string, model: UnderclassModel): Model<"openai-responses"> {
	return {
		id: model.id,
		name: model.name ?? model.id,
		api: "openai-responses",
		provider: PROVIDER_ID,
		baseUrl: `${origin}/v1`,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: model.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
		maxTokens: model.maxTokens ?? DEFAULT_MAX_TOKENS,
		reasoning: false,
	};
}

// Vendored codex models first; discovered ids not already listed come after.
function buildCatalog(origin: string, extras: UnderclassModel[]): Model<"openai-responses">[] {
	const models = CODEX_MODELS.map((model) => vendoredModel(origin, model));
	const known = new Set(models.map((model) => model.id));
	for (const extra of extras) {
		if (known.has(extra.id)) continue;
		known.add(extra.id);
		models.push(extraModel(origin, extra));
	}
	return models;
}

function buildProvider(origin: string, models: Model<"openai-responses">[]): Provider {
	return createProvider({
		id: PROVIDER_ID,
		name: "Underclass",
		baseUrl: `${origin}/v1`,
		auth: { apiKey: proxyKeyAuth },
		models,
		api: openAIResponsesApi(),
	});
}

// undefined means discovery was skipped or failed; an empty array means the
// instance answered with no models.
async function discoverModels(origin: string, apiKey: string | undefined): Promise<UnderclassModel[] | undefined> {
	if (!apiKey) return undefined;
	try {
		const response = await fetch(`${origin}/v1/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
		if (!response.ok) return undefined;
		const payload = await response.json() as { data?: unknown };
		if (!Array.isArray(payload.data)) return [];
		const seen = new Set<string>();
		const models: UnderclassModel[] = [];
		for (const value of payload.data) {
			const entry = parseModel(value);
			if (!entry || seen.has(entry.id)) continue;
			seen.add(entry.id);
			models.push(entry);
		}
		return models;
	} catch {
		return undefined;
	}
}

async function buildAndRegister(pi: ExtensionAPI): Promise<string> {
	const origin = resolveOrigin();
	const apiKey = readProxyKey();
	const discovered = await discoverModels(origin, apiKey);
	const models = buildCatalog(origin, discovered ?? []);
	pi.registerProvider(buildProvider(origin, models));
	if (discovered !== undefined) return `Underclass ready at ${origin}/v1 (${models.length} models).`;
	return apiKey
		? `Underclass registered at ${origin}/v1 with ${models.length} built-in models after discovery failed; retry with /underclass refresh.`
		: `Underclass registered at ${origin}/v1 with ${models.length} built-in models. Run /login underclass, then /underclass refresh.`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function adminFetch(path: string, token: string): Promise<Record<string, unknown>> {
	const response = await fetch(`${resolveOrigin()}${path}`, { headers: { Authorization: `Bearer ${token}` } });
	if (!response.ok) throw new Error(`underclass ${path} returned HTTP ${response.status}`);
	const payload = await response.json() as unknown;
	return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

async function withAdminToken(
	ctx: ExtensionCommandContext,
	run: (token: string) => Promise<string>,
): Promise<void> {
	const token = readAdminToken();
	if (!token) {
		ctx.ui.notify("No underclass admin token stored. Run /underclass setup.", "warning");
		return;
	}
	try {
		ctx.ui.notify(await run(token), "info");
	} catch (error) {
		ctx.ui.notify(`Underclass request failed: ${errorMessage(error)}`, "error");
	}
}

function codexConversionPath(): string {
	return join(getAgentDir(), "pi-codex-conversion.json");
}

// Codex Conversion activates a provider only when it is listed in
// scope.additionalProviders and the model api is Responses-shaped.
function mergeCodexConversionProviders(): { message: string; level: "info" | "error" } {
	const path = codexConversionPath();
	try {
		if (!existsSync(path)) {
			return { message: "Codex Conversion is not configured; no pi-codex-conversion.json to update.", level: "info" };
		}
		const config = readJsonObject(path);
		const scope = config.scope;
		if (scope !== undefined && (typeof scope !== "object" || scope === null || Array.isArray(scope))) {
			throw new Error("scope is not an object");
		}
		const scopeObject = (scope ?? {}) as Record<string, unknown>;
		const configured = scopeObject.additionalProviders;
		if (configured !== undefined && !Array.isArray(configured)) {
			throw new Error("scope.additionalProviders is not an array");
		}
		const providers = Array.isArray(configured) ? [...configured] : [];
		const normalized = providers
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.trim().toLowerCase());
		if (normalized.includes(PROVIDER_ID)) {
			return { message: "underclass is already in Codex Conversion's additional providers.", level: "info" };
		}
		config.scope = { ...scopeObject, additionalProviders: [...providers, PROVIDER_ID] };
		atomicWrite(path, JSON.stringify(config, null, 2));
		return { message: `Added underclass to ${path} (scope.additionalProviders).`, level: "info" };
	} catch (error) {
		return { message: `Could not update Codex Conversion config: ${errorMessage(error)}`, level: "error" };
	}
}

async function setupCommand(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
	const current = resolveOrigin();
	const originInput = await ctx.ui.input("Underclass origin", current);
	if (originInput === undefined) {
		ctx.ui.notify("Underclass setup cancelled.", "info");
		return;
	}
	const origin = normalizeOrigin(originInput);
	if (!origin) {
		ctx.ui.notify("Origin must be an http(s) URL.", "error");
		return;
	}
	try {
		atomicWrite(configFilePath(), JSON.stringify({ ...readJsonObject(configFilePath()), origin }, null, 2));
	} catch (error) {
		ctx.ui.notify(`Could not write underclass config: ${errorMessage(error)}`, "error");
		return;
	}

	// Pi has no masked input dialog, so the admin token is typed in clear text.
	const conversion = mergeCodexConversionProviders();
	const tokenInput = await ctx.ui.input("Underclass admin ui_token");
	const token = tokenInput?.trim();
	if (!token) {
		ctx.ui.notify(`Origin saved to ${origin}. No admin token stored.\n${conversion.message}`, "warning");
		return;
	}
	try {
		const credentials = readJsonObject(authFilePath());
		credentials[ADMIN_CREDENTIAL_ID] = { type: "api_key", key: token };
		atomicWrite(authFilePath(), JSON.stringify(credentials, null, 2));
	} catch (error) {
		ctx.ui.notify(`Could not update auth.json: ${errorMessage(error)}`, "error");
		return;
	}

	ctx.ui.notify(`${await buildAndRegister(pi)}\nAdmin token stored in auth.json as ${ADMIN_CREDENTIAL_ID}.\n${conversion.message}`, "info");
}

export default async function underclassExtension(pi: ExtensionAPI): Promise<void> {
	let failure: string | undefined;
	try {
		await buildAndRegister(pi);
	} catch (error) {
		failure = errorMessage(error);
		try {
			// Never let a provider registration failure break Pi startup.
			const origin = resolveOrigin();
			pi.registerProvider(buildProvider(origin, buildCatalog(origin, [])));
		} catch {
			// A failed fallback registration must not break Pi startup either.
		}
	}

	pi.on("session_start", (_event, ctx) => {
		if (failure) {
			ctx.ui.notify(`Underclass setup failed: ${failure}`, "error");
			return;
		}
		if (readProxyKey()) return;
		ctx.ui.notify(
			`Underclass is registered at ${resolveOrigin()}/v1 without a proxy key. Run /login underclass, then /underclass refresh.`,
			"warning",
		);
	});

	pi.registerCommand("underclass", {
		description: "Set up and inspect a self-hosted underclass instance",
		handler: async (args, ctx) => {
			const [subcommand] = args.trim().split(/\s+/).filter(Boolean);
			switch (subcommand) {
				case "setup":
					await setupCommand(pi, ctx);
					return;
				case "status":
					await withAdminToken(ctx, async (token) =>
						formatStatus(await adminFetch("/admin/api/state", token), resolveOrigin()),
					);
					return;
				case "accounts":
					await withAdminToken(ctx, async (token) => formatAccounts(await adminFetch("/admin/api/state", token)));
					return;
				case "usage":
					await withAdminToken(ctx, async (token) =>
						formatUsage(await adminFetch("/admin/api/usage?group_by=model&limit=10", token)),
					);
					return;
				case "refresh":
					try {
						ctx.ui.notify(await buildAndRegister(pi), "info");
					} catch (error) {
						ctx.ui.notify(`Underclass refresh failed: ${errorMessage(error)}`, "error");
					}
					return;
				case "pcc": {
					const conversion = mergeCodexConversionProviders();
					ctx.ui.notify(conversion.message, conversion.level);
					return;
				}
				case undefined:
					ctx.ui.notify(HELP, "info");
					return;
				default:
					ctx.ui.notify(`Unknown subcommand "${subcommand}".\n\n${HELP}`, "warning");
			}
		},
	});
}
