import type { Model } from "@earendil-works/pi-ai";

const BASE_URL = "https://api.akashml.com/v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function perTokenPriceToPerMillion(value: unknown): number {
  if (typeof value !== "string" || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed * 1_000_000 : 0;
}

function isReasoningModel(item: Record<string, unknown>): boolean {
  const features = item.supported_features;
  if (!isStringArray(features)) return false;
  return features.some((feature) => feature.toLowerCase().includes("reason"));
}

function parseModel(item: unknown): Model<"openai-completions"> | undefined {
  if (!isRecord(item)) return undefined;
  const { id, name, context_length, max_output_length, input_modalities, output_modalities } = item;
  const valid =
    typeof id === "string" && id.trim() !== "" &&
    typeof context_length === "number" && Number.isFinite(context_length) && context_length > 0 &&
    typeof max_output_length === "number" && Number.isFinite(max_output_length) && max_output_length > 0 &&
    isStringArray(input_modalities) && input_modalities.includes("text") &&
    isStringArray(output_modalities) && output_modalities.includes("text");
  if (!valid) return undefined;

  const pricing = isRecord(item.pricing) ? item.pricing : undefined;
  return {
    id,
    name: typeof name === "string" && name.trim() !== "" ? name : id,
    api: "openai-completions",
    provider: "akashml",
    baseUrl: BASE_URL,
    reasoning: isReasoningModel(item),
    input: input_modalities.includes("image") ? ["text", "image"] : ["text"],
    cost: {
      input: perTokenPriceToPerMillion(pricing?.input),
      output: perTokenPriceToPerMillion(pricing?.output),
      cacheRead: perTokenPriceToPerMillion(pricing?.input_cache_read),
      cacheWrite: 0,
    },
    contextWindow: context_length,
    maxTokens: max_output_length,
    compat: { supportsDeveloperRole: true, supportsUsageInStreaming: true },
  };
}

export function parseModelCatalog(payload: unknown): Model<"openai-completions">[] {
  const data = isRecord(payload) ? payload.data : undefined;
  if (!Array.isArray(data)) throw new Error("AkashML model catalog must contain a data array");
  const models = data.flatMap((item) => parseModel(item) ?? []);
  if (models.length === 0) throw new Error("AkashML catalog contains no valid text-to-text Chat Models");
  return models;
}
