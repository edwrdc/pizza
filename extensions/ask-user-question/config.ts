import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface GuidanceFields {
	promptSnippet?: string;
	promptGuidelines?: string[];
}

interface AskUserQuestionConfig {
	guidance?: GuidanceFields;
}

const CONFIG_PATH = join(homedir(), ".config", "rpiv-ask-user-question", "config.json");

export function loadConfig(): AskUserQuestionConfig {
	try {
		return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as AskUserQuestionConfig;
	} catch {
		return {};
	}
}

export function validateGuidanceFields(value: unknown): GuidanceFields {
	if (!value || typeof value !== "object") return {};
	const guidance = value as Record<string, unknown>;
	return {
		...(typeof guidance.promptSnippet === "string" ? { promptSnippet: guidance.promptSnippet } : {}),
		...(Array.isArray(guidance.promptGuidelines) && guidance.promptGuidelines.every((item) => typeof item === "string")
			? { promptGuidelines: guidance.promptGuidelines }
			: {}),
	};
}
