/**
 * Side Conversation Extension
 *
 * Inspired by Codex CLI's /side command. Forks the current thread into a
 * temporary read-only side conversation for quick questions without polluting
 * the main thread.
 *
 * Commands:
 *   /side [question]     — Fork into a side conversation (inherits history)
 *   /side-return         — Switch back to the parent session
 *   /side-allow          — Toggle mutation blocking in the side session
 *
 * State is persisted in a sidecar JSON file next to the session file so
 * side-session detection survives reload/resume.
 */

import { readFile, writeFile, unlink } from "node:fs/promises";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const SIDE_STATE_SUFFIX = ".side-state.json";

interface SideState {
	parentSession: string;
	allowMutations: boolean;
	createdAt: number;
}

function sideStatePath(sessionFile: string): string {
	return sessionFile.replace(/\.jsonl$/, "") + SIDE_STATE_SUFFIX;
}

async function readSideState(sessionFile: string): Promise<SideState | null> {
	try {
		const raw = await readFile(sideStatePath(sessionFile), "utf-8");
		return JSON.parse(raw) as SideState;
	} catch {
		return null;
	}
}

async function writeSideState(sessionFile: string, state: SideState | null): Promise<void> {
	const path = sideStatePath(sessionFile);
	if (state) {
		await writeFile(path, JSON.stringify(state));
	} else {
		await unlink(path).catch(() => {});
	}
}

/** Check whether a bash command should be blocked in read-only side mode. */
function isBashBlocked(command: string): boolean {
	const normalized = command.trim().toLowerCase();

	// Allow read-only git commands
	const readOnlyGit = /^\s*git\s+(status|log|diff|show|branch|remote|config\s+--list|stash\s+list)\b/;
	if (readOnlyGit.test(normalized)) return false;

	// Block any other git command
	if (/^\s*git\s/.test(normalized)) return true;

	// Block file mutations and dangerous operations
	const blocked = [
		/\brm\b/, /\bmv\b/, /\bcp\b/, /\bmkdir\b/, /\btouch\b/,
		/\bchmod\b/, /\bchown\b/, /\bsudo\b/, /\btee\b/,
		// shell output redirections (heuristic)
		/>[> ]*[^ >]/,
		// package managers / build tools that mutate files
		/\bnpm\s+(install|i|add|remove|uninstall|publish)\b/,
		/\bpnpm\s+(install|i|add|remove)\b/,
		/\byarn\s+(add|remove|install)\b/,
		/\bpip\s+(install|uninstall)\b/,
		/\bcargo\s+(add|remove|init)\b/,
		/\bmake\b/,
		// disk operations
		/\bmkfs\b/, /\bmount\b/, /\bumount\b/,
	];

	return blocked.some((p) => p.test(normalized));
}

function updateSideUI(ctx: ExtensionContext, state: SideState | null) {
	if (!ctx.hasUI) return;

	const status = state
		? state.allowMutations
			? "🡆 SIDE (mutations allowed)"
			: "🡆 SIDE (read-only)"
		: undefined;

	ctx.ui.setStatus("side", status);

	if (state) {
		const lines = state.allowMutations
			? [
					"┌─ 🡆 SIDE CONVERSATION (mutations allowed) ─┐",
					"│  Use /side-return to go back to main thread   │",
					"└────────────────────────────────────────────────┘",
				]
			: [
					"┌─ 🡆 SIDE CONVERSATION (read-only) ─┐",
					"│  Use /side-return to go back to main thread   │",
					"└────────────────────────────────────────────────┘",
				];
		ctx.ui.setWidget("side-banner", lines);
	} else {
		ctx.ui.setWidget("side-banner", undefined);
	}
}

export default function (pi: ExtensionAPI) {
	let sideState: SideState | null = null;

	/** Lazy-load side state from disk. Cached in-memory after first read. */
	async function getSideState(ctx: ExtensionContext): Promise<SideState | null> {
		if (sideState) return sideState;

		const sessionFile = ctx.sessionManager.getSessionFile();
		if (!sessionFile) return null;

		// Optimisation: side sessions are always forks, skip disk read otherwise.
		const header = ctx.sessionManager.getHeader();
		if (!header.parentSession) return null;

		const state = await readSideState(sessionFile);
		if (state) {
			sideState = state;
			updateSideUI(ctx, state);
			pi.setSessionName("🡆 side");
		}
		return state;
	}

	// ── Lifecycle ────────────────────────────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		await getSideState(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		if (ctx.hasUI) {
			ctx.ui.setStatus("side", undefined);
			ctx.ui.setWidget("side-banner", undefined);
		}
	});

	// ── Mutation blocking ────────────────────────────────────────────────────

	pi.on("tool_call", async (event, ctx) => {
		const state = await getSideState(ctx);
		if (!state || state.allowMutations) return;

		if (event.toolName === "write" || event.toolName === "edit") {
			return {
				block: true,
				reason: "File mutations are blocked in side conversation. Use /side-allow to enable, or /side-return to go back.",
			};
		}

		if (event.toolName === "bash") {
			const command = event.input.command;
			if (isBashBlocked(command)) {
				return {
					block: true,
					reason: `Blocked in side conversation: ${command}\nUse /side-allow to enable mutations, or /side-return to go back.`,
				};
			}
		}
	});

	// ── System prompt injection ──────────────────────────────────────────────

	pi.on("before_agent_start", async (event, ctx) => {
		const state = await getSideState(ctx);
		if (!state) return;

		const suffix = state.allowMutations
			? "You are in a SIDE CONVERSATION. Mutations are currently ALLOWED. Keep responses concise."
			: "You are in a SIDE CONVERSATION (read-only). Do NOT edit, write, or mutate files. Keep responses concise.";

		return { systemPrompt: event.systemPrompt + "\n\n" + suffix };
	});

	// ── Commands ─────────────────────────────────────────────────────────────

	pi.registerCommand("side", {
		description: "Start a side conversation (temporary fork for quick questions)",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("/side requires interactive mode", "error");
				return;
			}

			if (sideState) {
				ctx.ui.notify("Already in a side conversation. Use /side-return first.", "warning");
				return;
			}

			const parentSession = ctx.sessionManager.getSessionFile();
			const leafId = ctx.sessionManager.getLeafId();

			if (!parentSession || !leafId) {
				ctx.ui.notify("Cannot start side conversation: no active session", "error");
				return;
			}

			const question = args.trim();
			const result = await ctx.fork(leafId, {
				position: "at",
				withSession: async (replacementCtx) => {
					const newSessionFile = replacementCtx.sessionManager.getSessionFile();
					const state: SideState = {
						parentSession,
						allowMutations: false,
						createdAt: Date.now(),
					};

					if (newSessionFile) {
						await writeSideState(newSessionFile, state);
					}

					sideState = state;
					updateSideUI(replacementCtx, state);

					replacementCtx.ui.notify(
						"Side conversation started (read-only). Use /side-allow to enable mutations, /side-return to go back.",
						"info",
					);

					if (question) {
						await replacementCtx.sendUserMessage(question);
					}
				},
			});

			if (result.cancelled) {
				ctx.ui.notify("Side conversation cancelled", "info");
			}
		},
	});

	pi.registerCommand("side-return", {
		description: "Return to the parent session from a side conversation",
		handler: async (_args, ctx) => {
			if (!sideState) {
				ctx.ui.notify("Not in a side conversation", "error");
				return;
			}

			const parentSession = sideState.parentSession;
			const currentSessionFile = ctx.sessionManager.getSessionFile();

			if (currentSessionFile) {
				await writeSideState(currentSessionFile, null);
			}
			sideState = null;

			const result = await ctx.switchSession(parentSession, {
				withSession: async (replacementCtx) => {
					replacementCtx.ui.notify("Returned to main thread", "info");
				},
			});

			if (result.cancelled) {
				ctx.ui.notify("Return cancelled", "info");
			}
		},
	});

	pi.registerCommand("side-allow", {
		description: "Toggle mutation permissions in the current side conversation",
		handler: async (_args, ctx) => {
			if (!sideState) {
				ctx.ui.notify("Not in a side conversation", "error");
				return;
			}

			sideState.allowMutations = !sideState.allowMutations;

			const currentSessionFile = ctx.sessionManager.getSessionFile();
			if (currentSessionFile) {
				await writeSideState(currentSessionFile, sideState);
			}

			updateSideUI(ctx, sideState);

			ctx.ui.notify(
				sideState.allowMutations
					? "⚠️ Mutations ALLOWED in side conversation"
					: "Mutations BLOCKED in side conversation",
				sideState.allowMutations ? "warning" : "info",
			);
		},
	});
}
