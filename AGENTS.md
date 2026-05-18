# Pizza - Personal Pi Package

This is a personal pi package containing skills, extensions, and prompts. It's designed for new machine setup.

## Install on New Machine

```bash
# Using git
git clone git@github.com:edwrdc/pizza.git

# Or using GitHub CLI
gh repo clone edwrdc/pizza
# See gh dl --help for other options

cd pizza
./install.sh
```

This runs `pi install "$ROOT_DIR"`, registers vendored local extensions, and installs external extensions listed in `install.sh`.
The repo stays wherever you cloned it - pi references it directly.

Current local extensions installed by setup include:
- `extensions/ask-user-question` (vendored `ask_user_question` tool)

Current external extensions installed by setup include:
- `pi-subagents`
- `pi-mcp-adapter`
- `@howaboua/pi-codex-conversion`
- `pi-caveman`

Setup also symlinks custom agents into `~/.pi/agent/agents/` and skills into the standard multi-harness `~/.agents/skills/` directory.

## Prerequisites

- `pi` - pi coding agent
- `gh` - GitHub CLI
- `gh dl` - [gh-download](https://github.com/yuler/gh-download) extension for downloading specific files/folders from GitHub

## Structure

```
pizza/
├── install.sh           # Setup script
├── extensions/          # Custom extensions (small ones)
├── skills/              # Skills (copied + modified)
├── agents/              # Custom subagent definitions
├── prompts/             # Prompt templates (currently empty)
├── themes/              # Custom themes
└── mcp.json             # Global MCP config
```

## Workflows

### DeepWiki Research

This repo includes:

- `skills/deepwiki/` — an on-demand skill for DeepWiki-based repo research
- `agents/deepwiki-research.md` — a focused subagent that uses only the `mcp` tool
- `mcp.json` entry for the `deepwiki` MCP server

Preferred usage pattern:

- use the `deepwiki` skill for user-facing intent detection and prompt shaping
- use `deepwiki-research` when you want isolated DeepWiki research without polluting the parent context
- keep output concise and in bullets; avoid tables

### Adding a Skill

Skills are markdown-based instruction files. Copy them into `skills/`:

```bash
# From local path
cp -r ~/.agents/skills/some-skill ./skills/

# From GitHub repo using gh dl (assumes gh-download extension is installed)
gh dl someone/repo -- skills/some-skill ./skills/
# See: gh dl --help for options
```

Then commit:
```bash
git add skills/some-skill
git commit -m "Add some-skill"
git push
```

Then symlink to the standard multi-harness directory:
```bash
rm -rf ~/.agents/skills/some-skill
ln -s "$(pwd)/skills/some-skill" ~/.agents/skills/some-skill
```

> **Why `~/.agents/skills/`?** This path is the de-facto standard shared by pi, Claude Code, Codex, and OpenCode. Putting skills under `~/.pi/` would make them invisible to other harnesses.

Changes reflect immediately after `/reload` in pi.

### Adding a Subagent

Custom subagents are defined as `.md` files in `agents/`:

```markdown
<!-- agents/auditor.md -->
---
description: Security Code Reviewer
tools: read, grep, find, bash
model: haiku
thinking: high
max_turns: 30
---

You are a security auditor. Review code for vulnerabilities...
```

Then symlink to `~/.pi/agent/agents/`:
```bash
ln -sf "$(pwd)/agents/auditor.md" ~/.pi/agent/agents/auditor.md
```

Commit when done. Use in pi: `subagent({ agent: "auditor", task: "..." })`

**Note:** Model changes in agents (e.g., swapping `model: haiku` for `model: sonnet`) are minor tweaks. Don't mention them in commit messages — just lump them in with other changes.

### Adding an Extension

**Small/simple extensions** - Add directly to `extensions/`:

```bash
# Write or copy the .ts file
cp my-extension.ts ./extensions/
```

Then commit and `/reload`.

**External extensions** (npm packages, git repos) - Don't copy. Add to `install.sh`:

1. Append the `pi install` line to the "External extensions" section in `install.sh`
2. Commit the change
3. Run `./install.sh` to install

Example:
```bash
# 1. Edit install.sh, add:
pi install npm:some-extension

# 2. Commit
git add install.sh
git commit -m "Add some-extension"

# 3. Run the script
./install.sh
```

Current external installs live in `install.sh` under `# External extensions`.

### Adding a Prompt

Create a `.md` file in `prompts/`:

```markdown
Review this code for bugs and security issues.
Focus on: {{focus}}
```

Use with `/filename` in pi. Commit when done.

## Key Points

- This repo is installed via local path (`pi install .`), not git URL
- Changes to skills/extensions/prompts reflect after `/reload`
- External big extensions go in `install.sh`, not copied into this repo
- Skills can be modified freely - they're our copies
- **Skills live in `~/.agents/skills/`** — the standard multi-harness path. Never stash them under `~/.pi/`.
