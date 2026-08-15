import assert from "node:assert/strict";
import test from "node:test";

import { parseModelCatalog } from "./models.ts";

const chatModel = {
  id: "model-1",
  name: "Model One",
  context_length: 128_000,
  max_output_length: 8_192,
  input_modalities: ["text"],
  output_modalities: ["text"],
  pricing: { input: "0.000001", output: "0.000002" },
};

test("maps a Catalog Model to a Pi Chat Model", () => {
  assert.deepEqual(parseModelCatalog({ data: [chatModel] }), [
    {
      id: "model-1",
      name: "Model One",
      api: "openai-completions",
      provider: "akashml",
      baseUrl: "https://api.akashml.com/v1",
      reasoning: false,
      input: ["text"],
      cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 8_192,
      compat: { supportsDeveloperRole: true, supportsUsageInStreaming: true },
    },
  ]);
});

test("malformed entries: zeroed costs, skipped, or rejected", () => {
  // malformed prices become 0
  const badPrices = { ...chatModel, id: "bad-prices", pricing: { input: "NaN", output: "-1" } };
  assert.deepEqual(parseModelCatalog({ data: [badPrices] })[0].cost, {
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
  });
  // invalid entries skipped, valid siblings kept
  const badEntries = [{}, { ...chatModel, id: "x", context_length: 0 }, { ...chatModel, output_modalities: ["image"] }];
  assert.deepEqual(parseModelCatalog({ data: [...badEntries, chatModel] }).map((m) => m.id), ["model-1"]);
  // whole catalog rejected when malformed or empty
  assert.throws(() => parseModelCatalog(null), /data array/);
  assert.throws(() => parseModelCatalog({ data: {} }), /data array/);
  assert.throws(() => parseModelCatalog({ data: [] }), /no valid text-to-text/);
});

test("flags reasoning models and vision input from catalog metadata", () => {
  const reasoning = { ...chatModel, id: "r", supported_features: ["streaming", "force_reasoning"] };
  const vision = {
    ...chatModel,
    id: "v",
    input_modalities: ["text", "image"],
    pricing: { input: "0.000001", output: "0.000002", input_cache_read: "0.00000025" },
  };
  const [r, v] = parseModelCatalog({ data: [reasoning, vision] });
  assert.equal(r.reasoning, true);
  assert.equal(v.reasoning, false);
  assert.deepEqual(v.input, ["text", "image"]);
  assert.equal(v.cost.cacheRead, 0.25);
});
