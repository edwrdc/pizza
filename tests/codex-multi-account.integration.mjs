import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Multi Codex clones the base openai-codex provider with numbered ids. Clone
// models keep api="openai-codex-responses" and the canonical base URL, so
// Codex Conversion 3.0.15+ accepts them without any patching.

const projectRoot = resolve(import.meta.dirname, "..");
const root = mkdtempSync(join(tmpdir(), "pizza-multi-codex-"));
process.env.PI_CODING_AGENT_DIR = join(root, "agent");

try {
	const commands = new Map();
	const providers = [];
	const pi = {
		on() {},
		registerCommand(name, command) {
			commands.set(name, command);
		},
		registerProvider(provider) {
			providers.push(provider);
		},
	};

	const extensionPath = pathToFileURL(join(projectRoot, "extensions", "codex-multi-account", "index.ts"));
	const { default: registerMultiCodex } = await import(extensionPath);
	registerMultiCodex(pi);

	assert.deepEqual(providers.map((provider) => provider.id), ["openai-codex-2", "openai-codex-3", "openai-codex-4"]);
	for (const name of ["codex-accounts", "codex-switch", "codex-usage-all"]) {
		assert(commands.has(name), `Missing command: ${name}`);
	}
} finally {
	rmSync(root, { recursive: true, force: true });
}

console.log("Multi Codex integration test passed");
