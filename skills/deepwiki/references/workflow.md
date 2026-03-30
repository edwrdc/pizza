# DeepWiki Skill Workflow Notes

This reference file explains the intended layering:

- **Skill** = user-facing entry point and progressive-disclosure prompt surface
- **Subagent** = isolated execution path for larger DeepWiki research tasks
- **MCP** = lowest-level tool transport for the DeepWiki server

Preferred stack:

1. User invokes the `deepwiki` skill
2. The skill infers whether the task is `explore`, `architect`, or `mixed`
3. The skill tells the agent to use the `deepwiki-research` project subagent when available
4. The subagent uses the `mcp` tool with the `deepwiki` server
5. Only a compact handoff returns to the parent conversation

This keeps the main context cleaner than exposing all DeepWiki details directly to the parent session.

## Why not tables?

DeepWiki answers are generally strong in prose and bullets, but table formatting can be unstable. Prefer bullet lists and short structured sections.

## Best prompt style for DeepWiki

Good:

- "Explain in concise bullets"
- "Give 3-5 key points"
- "Compare in prose, not a table"
- "List relevant sections and one next step"

Avoid:

- "Make a full comparison table"
- "Dump full documentation"
- "Summarize everything"

