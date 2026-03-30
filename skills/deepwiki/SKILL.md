---
name: deepwiki
description: Research a public GitHub repository with DeepWiki and return compact, source-grounded handoff notes. Use when the user wants architecture, API, workflow, or design guidance about a public repo without polluting the main agent context.
---

# DeepWiki Research

Use this skill when the user wants repository-grounded answers for a **public GitHub repository** and the answer would benefit from DeepWiki's repo summaries.

This skill is designed to keep the main agent context lean:

- prefer the `deepwiki-research` project subagent when available
- otherwise use the `mcp` tool with the `deepwiki` server directly
- return only a compact summary to the main conversation
- avoid dumping long raw DeepWiki output into the parent context

## When to use

Use this skill for questions like:

- "How is this repo structured?"
- "Where in the repo does X live?"
- "How should feature Y fit into this codebase?"
- "Compare implementation options for this public repo"
- "Give me a quick architectural briefing on owner/repo"

Do **not** use this skill for:

- private repositories DeepWiki cannot access
- tasks that require local workspace edits only
- generic coding questions not tied to a public repository

## Intent classification

Infer the user's intent and choose one of these modes:

- **explore**
  - use for structure, architecture, locations, APIs, and factual repo understanding
- **architect**
  - use for recommendations, tradeoffs, design fit, workflow guidance
- **mixed**
  - use when the question needs factual grounding first and recommendations second

Examples:

- "How is this repo structured?" → `explore`
- "Where does auth live?" → `explore`
- "How should this fit into pi workflow?" → `architect`
- "How do extensions work, and how should DeepWiki fit into that workflow?" → `mixed`

## Preferred execution order

### Option A: Use the `deepwiki-research` project subagent

If the `deepwiki-research` project subagent is available, prefer this path first.

Use the `subagent` tool with:

- `agent: "deepwiki-research"`
- `agentScope: "project"`
- a task that clearly includes:
  - the selected mode
  - the repository in `owner/repo` format
  - the user's actual question
  - a request for concise output

Example task phrasing:

```text
Mode: explore|architect|mixed
Repo: owner/repo
Question: <user question>
Constraints:
- Use DeepWiki only
- No tables
- Keep the result concise, factual, and actionable
```

Important:

- `deepwiki-research` is a **subagent name**
- it is **not** an MCP tool name
- if a repo is provided as `https://github.com/owner/repo`, normalize it to `owner/repo`

### Option B: Fallback to MCP directly

If the project subagent is unavailable, use the `mcp` tool against the `deepwiki` server.

Recommended sequence:

1. Connect if needed:

```text
mcp({ connect: "deepwiki" })
```

2. For orientation, inspect structure first:

```text
mcp({ tool: "deepwiki_read_wiki_structure", args: '{"repoName":"owner/repo"}' })
```

3. For targeted answers, ask a focused question:

```text
mcp({ tool: "deepwiki_ask_question", args: '{"repoName":"owner/repo","question":"<question>"}' })
```

4. Use full contents only if necessary:

```text
mcp({ tool: "deepwiki_read_wiki_contents", args: '{"repoName":"owner/repo"}' })
```

## Output rules

Always prefer:

- bullets
- short prose
- section names / evidence anchors
- a single next step

Avoid:

- tables
- long pasted DeepWiki output
- broad repetition
- claiming certainty when DeepWiki evidence is incomplete
- malformed JSON in `mcp.args`
- using `repo` instead of `repoName`
- passing a full GitHub URL where DeepWiki expects `owner/repo`

## Final answer format

Use this structure in the parent conversation:

## Handoff Summary
- 4-8 bullets with the most useful findings

## Evidence / Sections
- exact DeepWiki sections, topics, or pages used

## Uncertainty
- what still needs verification locally

## Recommended Next Step
- one concrete next action

## Repo and question extraction

Infer the repository and question from the user's request.

If the repository is missing or ambiguous, ask a clarifying question before continuing.

If the user already provided a repo and a clear question, do not ask for confirmation.

