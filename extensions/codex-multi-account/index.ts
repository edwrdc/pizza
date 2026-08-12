import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { createProvider, lazyOAuth, type Model, type OAuthAuth } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { pathToFileURL } from "node:url";
import { codexConversionPaths, ensureUsagePatched, unpatchAllUsage } from "./usage-patch.ts";

const BASE_PROVIDER = "openai-codex";
const MAX_ACCOUNTS = 4;
const ACCOUNT_PROVIDERS = Array.from(
	{ length: MAX_ACCOUNTS - 1 },
	(_, index) => `${BASE_PROVIDER}-${index + 2}`,
);

type ResetCredit = {
	expiresAt?: string;
	status?: string;
};

type UsageSnapshot = {
	resetCredits?: {
		availableCount?: number;
		credits?: ResetCredit[];
	};
};

type CodexUsageModule = {
	fetchCodexUsage(ctx: ExtensionContext): Promise<UsageSnapshot>;
	formatCodexUsage(snapshot: UsageSnapshot): string;
};

function formatResetCreditExpiry(expiresAtMs: number): string {
	const minutes = Math.round((expiresAtMs - Date.now()) / 60_000);
	if (minutes <= 0) return "expired";
	if (minutes < 90) return `in ~${minutes}m`;
	if (minutes < 60 * 48) return `in ~${Math.round(minutes / 60)}h`;
	return `in ~${Math.round(minutes / 1_440)}d`;
}

function formatResetCreditExpiries(credits: ResetCredit[]): string {
	const expiringCredits = credits
		.map((credit) => ({ credit, expiresAtMs: credit.expiresAt ? Date.parse(credit.expiresAt) : Number.NaN }))
		.filter((item) => Number.isFinite(item.expiresAtMs) && (!item.credit.status || item.credit.status === "available"))
		.sort((left, right) => left.expiresAtMs - right.expiresAtMs);
	if (expiringCredits.length === 0) return "unknown";

	const shown = expiringCredits
		.slice(0, 3)
		.map((item, index) => `#${index + 1} ${formatResetCreditExpiry(item.expiresAtMs)}`);
	const hiddenCount = expiringCredits.length - shown.length;
	return `${shown.join(" · ")}${hiddenCount > 0 ? ` · +${hiddenCount} more` : ""}`;
}

function formatResetCreditExpiryLine(snapshot: UsageSnapshot): string | undefined {
	const resetCredits = snapshot.resetCredits;
	if (!resetCredits || (resetCredits.availableCount ?? 0) <= 0) return undefined;
	return `- banked reset expiry: ${formatResetCreditExpiries(resetCredits.credits ?? [])}`;
}

export default function codexMultiAccountExtension(pi: ExtensionAPI) {
	const baseCodex = builtinProviders().find((provider) => provider.id === BASE_PROVIDER);
	if (!baseCodex) throw new Error("openai-codex provider was not found in this Pi build");

	const codexOAuth = baseCodex.auth.oauth as OAuthAuth | undefined;
	if (!codexOAuth) throw new Error("openai-codex provider has no OAuth authentication in this Pi build");

	const codexModels = baseCodex.getModels();
	const codexApi = {
		stream: baseCodex.stream.bind(baseCodex),
		streamSimple: baseCodex.streamSimple.bind(baseCodex),
	};
	const userPatchState = ensureUsagePatched();

	pi.on("session_start", (_event, ctx) => {
		const patchState = ctx.isProjectTrusted()
			? ensureUsagePatched(ctx.cwd, CONFIG_DIR_NAME)
			: userPatchState;
		const patchMessage = patchState.kind === "patched"
			? patchState.already
				? `Multi Codex usage patch is active for Codex Conversion v${patchState.version}.`
				: `Patched Codex Conversion v${patchState.version} usage checks for additional accounts. Restart Pi if Codex Conversion loaded before Pizza.`
			: patchState.kind === "drifted"
				? `Codex Conversion v${patchState.version} no longer matches the Multi Codex usage patch. Clone usage through /codex is unavailable.`
				: undefined;
		if (patchMessage) ctx.ui.notify(patchMessage, patchState.kind === "drifted" ? "error" : "info");
	});

	pi.registerCommand("codex-usage-unpatch", {
		description: "Restore Codex Conversion's original usage provider checks",
		handler: async (_args, ctx) => {
			const result = unpatchAllUsage(ctx.isProjectTrusted() ? ctx.cwd : undefined, CONFIG_DIR_NAME);
			ctx.ui.notify(result.message, result.ok ? "info" : "error");
		},
	});

	for (const id of ACCOUNT_PROVIDERS) {
		const accountNumber = id.slice(BASE_PROVIDER.length + 1);
		pi.registerProvider(createProvider({
			id,
			name: `OpenAI Codex #${accountNumber}`,
			baseUrl: "https://chatgpt.com/backend-api",
			auth: {
				oauth: lazyOAuth({
					name: `OpenAI Codex #${accountNumber} (ChatGPT Plus/Pro)`,
					isSubscription: true,
					load: async () => codexOAuth,
				}),
			},
			models: codexModels.map((model) => ({ ...model, provider: id })),
			api: codexApi,
		}));
	}

	pi.registerCommand("codex-accounts", {
		description: "List Codex accounts and their login state",
		handler: async (_args, ctx) => {
			ctx.ui.notify(await accountReport(ctx), "info");
		},
	});

	pi.registerCommand("codex-usage-all", {
		description: "Show usage for every logged-in Codex account",
		handler: async (_args, ctx) => {
			const loggedIn = await loggedInAccounts(ctx);
			if (loggedIn.length === 0) {
				ctx.ui.notify("No Codex accounts are logged in. Run /login openai-codex-2 to add an account.", "warning");
				return;
			}

			const usageModule = await loadUsageModule(ctx);
			if (!usageModule) {
				ctx.ui.notify("Codex Conversion usage support is unavailable. Install it from /pizza packages.", "error");
				return;
			}

			const sections = await Promise.all(loggedIn.map(async (provider) => {
				const model = ctx.modelRegistry.getAll().find(
					(candidate) => candidate.provider === provider && candidate.input.includes("text"),
				);
				if (!model) return `== ${provider} ==\nno model registered`;

				try {
					const snapshot = await usageModule.fetchCodexUsage({ ...ctx, model } as ExtensionContext);
					const expiryLine = formatResetCreditExpiryLine(snapshot);
					return `== ${provider} ==\n${usageModule.formatCodexUsage(snapshot)}${expiryLine ? `\n${expiryLine}` : ""}`;
				} catch (error) {
					return `== ${provider} ==\n${error instanceof Error ? error.message : String(error)}`;
				}
			}));
			ctx.ui.notify(sections.join("\n\n"), "info");
		},
	});

	pi.registerCommand("codex-switch", {
		description: "Switch to another Codex account or model",
		handler: async (_args, ctx) => {
			const options: Array<{ label: string; model: Model<any> }> = [];
			for (const provider of [BASE_PROVIDER, ...ACCOUNT_PROVIDERS]) {
				for (const model of ctx.modelRegistry.getAll().filter((candidate) => candidate.provider === provider)) {
					options.push({ label: `${provider}/${model.id} — ${model.name}`, model });
				}
			}
			if (options.length === 0) {
				ctx.ui.notify("No Codex models were found.", "warning");
				return;
			}

			const labels = options.map((option) =>
				option.model.provider === ctx.model?.provider && option.model.id === ctx.model?.id
					? `${option.label}  (current)`
					: option.label,
			);
			const selected = await ctx.ui.select("Switch Codex account/model:", labels);
			if (!selected) return;

			const target = options[labels.indexOf(selected)];
			if (!target) return;
			const changed = await pi.setModel(target.model);
			ctx.ui.notify(
				changed
					? `Switched to ${target.model.provider}/${target.model.id}`
					: `Could not switch. Run /login ${target.model.provider} and try again.`,
				changed ? "info" : "warning",
			);
		},
	});
}

async function loggedInAccounts(ctx: ExtensionContext): Promise<string[]> {
	const loggedIn: string[] = [];
	for (const provider of [BASE_PROVIDER, ...ACCOUNT_PROVIDERS]) {
		const auth = await ctx.modelRegistry.getProviderAuth(provider).catch(() => undefined);
		if (auth) loggedIn.push(provider);
	}
	return loggedIn;
}

async function accountReport(ctx: ExtensionContext): Promise<string> {
	const lines: string[] = [];
	for (const provider of [BASE_PROVIDER, ...ACCOUNT_PROVIDERS]) {
		const auth = await ctx.modelRegistry.getProviderAuth(provider).catch(() => undefined);
		lines.push(auth
			? `${provider}: logged in (${auth.source ?? "oauth"})`
			: `${provider}: not logged in — run /login ${provider}`);
	}
	return lines.join("\n");
}

async function loadUsageModule(ctx: ExtensionContext): Promise<CodexUsageModule | undefined> {
	const { filePath } = codexConversionPaths(ctx.isProjectTrusted() ? ctx.cwd : undefined, CONFIG_DIR_NAME);
	try {
		return await import(pathToFileURL(filePath).href) as CodexUsageModule;
	} catch {
		return undefined;
	}
}
