import {
  createProvider,
  type ApiKeyAuth,
  type Model,
  type RefreshModelsContext,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { parseModelCatalog } from "./models.ts";

const PROVIDER_ID = "akashml";
const BASE_URL = "https://api.akashml.com/v1";
const API_KEY_ENV = "AKASHML_API_KEY";

const apiKeyAuth = {
  name: "AkashML API key",
  async login(interaction) {
    return {
      type: "api_key" as const,
      key: await interaction.prompt({ type: "secret", message: "AkashML API key" }),
    };
  },
  async check({ ctx, credential }) {
    const key = credential?.key ?? (await ctx.env(API_KEY_ENV));
    return key
      ? { type: "api_key" as const, source: credential?.key ? "stored API key" : API_KEY_ENV }
      : undefined;
  },
  async resolve({ ctx, credential }) {
    const key = credential?.key ?? (await ctx.env(API_KEY_ENV));
    return key
      ? { auth: { apiKey: key }, source: credential?.key ? "stored API key" : API_KEY_ENV }
      : undefined;
  },
} satisfies ApiKeyAuth;

async function fetchModels(
  context: RefreshModelsContext,
): Promise<readonly Model<"openai-completions">[]> {
  const key = context.credential?.type === "api_key" ? context.credential.key : undefined;
  if (!key) throw new Error("AkashML model refresh requires an API key");

  const response = await fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: context.signal,
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500).trim();
    throw new Error(`AkashML model refresh failed (${response.status})${body ? `: ${body}` : ""}`);
  }

  return parseModelCatalog(await response.json());
}

const provider = createProvider<"openai-completions">({
  id: PROVIDER_ID,
  name: "AkashML",
  baseUrl: BASE_URL,
  auth: { apiKey: apiKeyAuth },
  models: [],
  fetchModels,
  api: openAICompletionsApi(),
});

export default function register(pi: ExtensionAPI): void {
  pi.registerProvider(provider);
}
