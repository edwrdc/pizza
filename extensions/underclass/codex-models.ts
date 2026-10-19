// Codex model catalog provided by Pizza.
//
// Underclass pools Codex subscription accounts, and its own /v1/models catalog is
// both stale and incomplete: it omits GPT-6.1 Sol entirely and reports a total
// window instead of an input budget. Pizza therefore ships this list itself.
//
// Values mirror what Pi's openai-codex provider advertises: the builtin catalog plus
// the supplementals from Codex Conversion 4.0.2. Responses-specific fields (api,
// baseUrl, compat, promptCache, samplingParams) are intentionally excluded.

import type { ModelCost, ThinkingLevelMap } from "@earendil-works/pi-ai";

export type LocalCodexModel = {
	id: string;
	name: string;
	input: ("text" | "image")[];
	cost: ModelCost;
	contextWindow: number;
	maxTokens: number;
	reasoning: boolean;
	thinkingLevelMap?: ThinkingLevelMap;
};

export const CODEX_MODELS: LocalCodexModel[] = [
	{
		id: "gpt-5.3-codex-spark",
		name: "GPT-5.3 Codex Spark",
		input: ["text"],
		cost: {"input":1.75,"output":14,"cacheRead":0.175,"cacheWrite":0},
		contextWindow: 128000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"xhigh":"xhigh","minimal":"low"},
	},
	{
		id: "gpt-5.5",
		name: "GPT-5.5",
		input: ["text","image"],
		cost: {"input":5,"output":30,"cacheRead":0.5,"cacheWrite":0,"tiers":[{"inputTokensAbove":272000,"input":10,"output":45,"cacheRead":1,"cacheWrite":0}]},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"xhigh":"xhigh","minimal":"low"},
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		input: ["text","image"],
		cost: {"input":0.2,"output":1.2,"cacheRead":0.02,"cacheWrite":0.25,"tiers":[{"inputTokensAbove":272000,"input":0.4,"output":1.8,"cacheRead":0.04,"cacheWrite":0.5}]},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"xhigh":"xhigh","max":"max","minimal":"low"},
	},
	{
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol",
		input: ["text","image"],
		cost: {"input":4,"output":20,"cacheRead":0.4,"cacheWrite":5,"tiers":[{"inputTokensAbove":272000,"input":8,"output":30,"cacheRead":0.8,"cacheWrite":10}]},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"xhigh":"xhigh","max":"max","minimal":"low"},
	},
	{
		id: "gpt-5.6-terra",
		name: "GPT-5.6 Terra",
		input: ["text","image"],
		cost: {"input":2,"output":12,"cacheRead":0.2,"cacheWrite":2.5,"tiers":[{"inputTokensAbove":272000,"input":4,"output":18,"cacheRead":0.4,"cacheWrite":5}]},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"xhigh":"xhigh","max":"max","minimal":"low"},
	},
	{
		id: "gpt-6-astra",
		name: "GPT-6 Astra",
		input: ["text","image"],
		cost: {"input":10,"output":50,"cacheRead":1,"cacheWrite":12.5,"tiers":[{"inputTokensAbove":272000,"input":20,"output":75,"cacheRead":2,"cacheWrite":25}]},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"off":null,"minimal":"low","low":"low","medium":"medium","high":"high","xhigh":"xhigh","max":"max"},
	},
	{
		id: "gpt-6-luna",
		name: "GPT-6 Luna",
		input: ["text","image"],
		cost: {"input":0.1,"output":0.5,"cacheRead":0.01,"cacheWrite":0.125,"tiers":[{"inputTokensAbove":272000,"input":0.2,"output":0.75,"cacheRead":0.02,"cacheWrite":0.25}]},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"off":null,"minimal":"low","low":"low","medium":"medium","high":"high","xhigh":"xhigh","max":"max"},
	},
	{
		id: "gpt-6-sol",
		name: "GPT-6 Sol",
		input: ["text","image"],
		cost: {"input":2,"output":10,"cacheRead":0.2,"cacheWrite":2.5,"tiers":[{"inputTokensAbove":272000,"input":4,"output":15,"cacheRead":0.4,"cacheWrite":5}]},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"off":null,"minimal":"low","low":"low","medium":"medium","high":"high","xhigh":"xhigh","max":"max"},
	},
	{
		id: "gpt-6.1-sol",
		name: "GPT-6.1 Sol",
		input: ["text","image"],
		cost: {"input":2,"output":10,"cacheRead":0.1,"cacheWrite":2.5,"tiers":[{"inputTokensAbove":272000,"input":4,"output":15,"cacheRead":0.2,"cacheWrite":5}]},
		contextWindow: 500000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"off":null,"minimal":null,"low":"low","medium":"medium","high":"high","xhigh":"xhigh","max":"max"},
	},
	{
		id: "gpt-daybreak-blue-latest",
		name: "Daybreak Blue",
		input: ["text","image"],
		cost: {"input":0,"output":0,"cacheRead":0,"cacheWrite":0},
		contextWindow: 272000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"minimal":"low","xhigh":"xhigh","max":"max"},
	},
	{
		id: "gpt-daybreak-red-latest",
		name: "Daybreak Red",
		input: ["text","image"],
		cost: {"input":0,"output":0,"cacheRead":0,"cacheWrite":0},
		contextWindow: 372000,
		maxTokens: 128000,
		reasoning: true,
		thinkingLevelMap: {"minimal":"low","xhigh":"xhigh","max":"max"},
	},
];
