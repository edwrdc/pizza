---
description: CLI tools for Svelte 5 documentation lookup and code analysis. Use when creating, editing or analyzing any Svelte component (.svelte) or Svelte module (.svelte.ts/.svelte.js).
---

<!-- Source: https://github.com/sveltejs/ai-tools -->

# Svelte 5 Code Writer

## MCP Tools

You have access to the Svelte MCP server for Svelte-specific assistance. Use the `mcp` tool:

### list-sections

Discover all available documentation sections with titles, use_cases, and paths.

```
mcp({ tool: "svelte_list-sections", args: '{}' })
```

### get-documentation

Retrieves full documentation for specified sections. Use after `list-sections` to fetch relevant docs.

```
mcp({ tool: "svelte_get-documentation", args: '{"section": "$state"}' })
mcp({ tool: "svelte_get-documentation", args: '{"section": ["$state", "$derived", "$effect"]}' })
```

**Parameter:**
- `section` - Section name(s) as string or array. Can search by title (e.g., "$state", "load functions") or file path (e.g., "cli/overview")

### svelte-autofixer

Analyzes Svelte code and suggests fixes for common issues.

```
mcp({ tool: "svelte_svelte-autofixer", args: '{"code": "<script>let count = $state(0);</script>", "desired_svelte_version": 5}' })
```

**Parameters:**
- `code` (required) - The Svelte code to analyze
- `desired_svelte_version` (required) - Target version: 4 or 5. Check package.json if available, otherwise use hints (runes = 5). Default to 5.
- `async` (optional) - Enable async Svelte mode (only for version 5)
- `filename` (optional) - Component name with extension (e.g., "Counter.svelte"), not the full path

**Examples:**

```
# Analyze code with Svelte 5
mcp({ tool: "svelte_svelte-autofixer", args: '{"code": "...", "desired_svelte_version": 5}' })

# With filename for better context
mcp({ tool: "svelte_svelte-autofixer", args: '{"code": "...", "desired_svelte_version": 5, "filename": "TodoList.svelte"}' })

# For Svelte 4
mcp({ tool: "svelte_svelte-autofixer", args: '{"code": "...", "desired_svelte_version": 4}' })
```

### playground-link

Generates a Svelte Playground link with the provided code.

```
mcp({ tool: "svelte_playground-link", args: '{"code": "..."}' })
```

## Workflow

1. **Uncertain about syntax?** Call `list-sections` then `get-documentation` for relevant topics
2. **Reviewing/debugging?** Call `svelte-autofixer` on the code to detect issues
3. **Always validate** - Call `svelte-autofixer` before finalizing any Svelte component
4. **Share code?** Generate a `playground-link` after user confirmation
