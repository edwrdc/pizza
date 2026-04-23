// https://x.com/nicopreme/status/2044986256535466146
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const TOOL_CALL_BEHAVIOR = `
<tool_call_behavior>
- Before a meaningful tool call, send one concise sentence describing the immediate action.
- Always do this before edits and verification commands.
- Skip it for routine reads, obvious follow-up searches, and repetitive low-signal tool calls.
- When you preface a tool call, make that tool call in the same turn.
</tool_call_behavior>`;

  pi.on("before_agent_start", async (event, _ctx) => {
    return {
      systemPrompt: event.systemPrompt + TOOL_CALL_BEHAVIOR,
    };
  });
}
