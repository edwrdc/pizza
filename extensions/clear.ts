/**
 * Command Alias Extension - Maps /clear to /new
 * 
 * This extension registers /clear as a command that executes /new,
 * creating a new session. This provides a familiar alias for users who
 * are used to typing /clear from other tools.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	// Register /clear command that delegates to /new
	pi.registerCommand("clear", {
		description: "Alias for /new - Start a new session",
		handler: async (_args, ctx) => {
			// Send /new as a user message to trigger the built-in command
			pi.sendUserMessage("/new");
		},
	});
}
