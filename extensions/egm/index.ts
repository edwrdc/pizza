import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { mkdtempSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readSettings, setupProfiles, updateSettings } from "./profiles.ts";
import { ROLE_NAMES, ROLES, workflowPrompt, type Phase, type Role, type WorkflowState } from "./prompts.ts";

const STATE_KEY = "pizza:egm";
const HELP = [
	"/egm setup                 Create dedicated Shepherdr profiles using the current model",
	"/egm settings              Choose a model and thinking level for one role",
	"/egm brainstorm <idea>     Explore requirements without writing application code",
	"/egm draft [notes-file]    Draft a design one section at a time",
	"/egm review <design>       Run five fresh-session design-review stages with checkpoints",
	"/egm implement <design>    Approve the design and delegate implementation",
	"/egm code-review <design>  Review the implementation against the design",
	"/egm status                Show the active phase and role settings",
	"/egm off                   Leave EGM mode, without closing running workers",
].join("\n");

function state(ctx: ExtensionContext): WorkflowState | undefined {
	for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
		if (entry.type === "custom" && entry.customType === STATE_KEY) return entry.data as WorkflowState | undefined;
	}
	return undefined;
}

function requireController(pi: ExtensionAPI, ctx: ExtensionContext): void {
	let worker: boolean | undefined;
	pi.events.emit("shepherdr:worker-role:v1", {
		sessionManager: ctx.sessionManager,
		reply: (value: boolean) => { worker = value; },
	});
	if (worker === undefined || !pi.getAllTools().some((tool) => tool.name === "agents")) {
		throw new Error("EGM requires enabled pi-shepherdr with its agents tool. Install it through /pizza packages, then /reload.");
	}
	if (worker) throw new Error("Run /egm in the main session, not in a Shepherdr worker.");
}

function requireModels(ctx: ExtensionContext, roles: Role[]): void {
	const available = ctx.modelRegistry.getAvailable();
	for (const role of roles) {
		const settings = readSettings(role);
		const model = available.find((candidate) => `${candidate.provider}/${candidate.id}` === settings.model);
		if (!model) throw new Error(`egm-${role} model ${settings.model} is unavailable. Check /login or /egm settings.`);
		if (!getSupportedThinkingLevels(model).includes(settings.thinking)) {
			throw new Error(`egm-${role} thinking level ${settings.thinking} is unsupported by ${settings.model}. Use /egm settings.`);
		}
	}
}

async function documentPath(input: string, ctx: ExtensionCommandContext): Promise<string | undefined> {
	const value = input || (ctx.hasUI ? await ctx.ui.input("Design document path") : undefined);
	if (value === undefined) {
		if (!ctx.hasUI) throw new Error("Provide a design document path.");
		return undefined;
	}
	const path = realpathSync(resolve(ctx.cwd, value.trim().replace(/^(["'])(.*)\1$/, "$2")));
	const fromRoot = relative(realpathSync(ctx.cwd), path);
	if (isAbsolute(fromRoot) || fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
		throw new Error("The EGM document must be inside the project, including its symlink target.");
	}
	if (!statSync(path).isFile()) throw new Error("The EGM document must be a file.");
	return path;
}

async function settingsCommand(ctx: ExtensionCommandContext): Promise<void> {
	if (!ctx.hasUI) throw new Error("/egm settings needs an interactive UI. You can also edit model and thinking in the EGM profile.json files.");
	const labels = ROLE_NAMES.map((role) => {
		const saved = readSettings(role);
		return `${role}: ${saved.model} (${saved.thinking})`;
	});
	const selected = await ctx.ui.select("EGM role", labels);
	if (selected === undefined) return;
	const role = ROLE_NAMES[labels.indexOf(selected)];
	const models = ctx.modelRegistry.getAvailable();
	if (!models.length) throw new Error("No models are available. Configure a provider with /login first.");
	const choices = models.map((model) => `${model.provider}/${model.id}`).sort();
	const modelId = await ctx.ui.select(`Model for ${role}`, choices);
	if (modelId === undefined) return;
	const model = models.find((candidate) => `${candidate.provider}/${candidate.id}` === modelId)!;
	const levels = getSupportedThinkingLevels(model);
	const thinking = await ctx.ui.select(`Thinking for ${role}`, levels);
	if (thinking === undefined) return;
	if (!levels.includes(thinking as typeof levels[number])) throw new Error("Invalid thinking level.");
	updateSettings(role, { model: modelId, thinking: thinking as typeof levels[number] });
	ctx.ui.notify(`egm-${role}: ${modelId} (${thinking}). Applies to new workers immediately.`, "info");
}

export default function egmExtension(pi: ExtensionAPI): void {
	pi.on("before_agent_start", (event, ctx) => {
		const active = state(ctx);
		if (active) return { systemPrompt: `${event.systemPrompt}\n\n${workflowPrompt(active, ctx.cwd)}` };
		return undefined;
	});

	pi.registerCommand("egm", {
		description: "Elephant-Goldfish design, fresh-session review, and role model settings",
		handler: async (args, ctx) => {
			const [, command = "help", input = ""] = args.trim().match(/^(\S+)(?:\s+([\s\S]*))?$/) ?? [];
			try {
				if (command === "help") {
					ctx.ui.notify(HELP, "info");
					return;
				}
				if (command === "setup") {
					if (!ctx.model) throw new Error("Select a model with /model before EGM setup.");
					setupProfiles({ model: `${ctx.model.provider}/${ctx.model.id}`, thinking: pi.getThinkingLevel() });
					ctx.ui.notify("EGM profiles created. Existing role models were preserved. Use /egm settings to change them. The Elephant uses the main session model from /model.", "info");
					return;
				}
				if (command === "settings") {
					await settingsCommand(ctx);
					return;
				}
				if (command === "status") {
					const active = state(ctx);
					const settings = ROLE_NAMES.map((role) => {
						const saved = readSettings(role);
						return `${ROLES[role].title}: ${saved.model} (${saved.thinking})`;
					});
					ctx.ui.notify([`EGM: ${active?.phase ?? "off"}`, active?.target, active?.reportDir, ...settings].filter(Boolean).join("\n"), "info");
					return;
				}
				if (!ctx.isIdle()) throw new Error("Wait for the current turn to finish before changing EGM phase.");
				if (command === "off") {
					pi.appendEntry(STATE_KEY, null);
					ctx.ui.notify("EGM is off. Running Shepherdr workers are unchanged.", "info");
					return;
				}
				if (!["brainstorm", "draft", "review", "implement", "code-review"].includes(command)) throw new Error(`Unknown EGM command: ${command}. Use /egm help.`);
				if (!ctx.isProjectTrusted()) throw new Error("Trust this project in Pi before starting an EGM workflow.");
				const phase = command as Phase;
				const active: WorkflowState = { phase };
				if (phase !== "brainstorm" && (phase !== "draft" || input)) {
					active.target = await documentPath(input, ctx);
					if (!active.target) return;
				}
				if (["review", "implement", "code-review"].includes(phase)) {
					requireController(pi, ctx);
					requireModels(ctx, phase === "review" ? ["zoom-out", "comprehension", "critic", "readiness"] : [phase === "implement" ? "implementer" : "code-review"]);
					active.reportDir = mkdtempSync(join(dirname(active.target!), ".egm-review-"));
				}
				pi.appendEntry(STATE_KEY, active);
				// Shepherdr's worker service cannot select isolated role profiles; use its agents tool through the Elephant.
				pi.sendUserMessage(phase === "brainstorm"
					? `Start EGM brainstorming. ${input || "Ask me what feature or problem to explore."}`
					: `Start EGM ${phase}${active.target ? ` for ${JSON.stringify(active.target)}` : ""}. Follow the active EGM instructions.`,
				{ deliverAs: "followUp" });
			} catch (error) {
				ctx.ui.notify(`EGM: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});
}
