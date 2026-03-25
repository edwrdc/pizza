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
npm run setup
```

This runs `pi install .` which registers pizza with pi. The repo stays wherever you cloned it - pi references it directly.

After setup, symlink agents and skills for multi-harness support (run from pizza directory):
```bash
# Symlink agents (for pi-subagents)
for agent in agents/*.md; do
  ln -sf "$(pwd)/$agent" ~/.pi/agent/agents/$(basename $agent)
done

# Symlink skills (for Claude Code, Codex, OpenCode)
for skill in skills/*/; do
  ln -sfn "$(pwd)/$skill" ~/.agents/skills/$(basename $skill)
done
```

## Prerequisites

- `pi` - pi coding agent
- `gh` - GitHub CLI
- `gh dl` - [gh-download](https://github.com/yuler/gh-download) extension for downloading specific files/folders from GitHub

## Structure

```
pizza/
├── scripts/install.sh   # Setup script
├── extensions/          # Custom extensions (small ones)
├── skills/              # Skills (copied + modified)
├── agents/              # Custom subagent definitions
├── prompts/             # Prompt templates (currently empty)
└── package.json         # Pi package manifest
```

## Workflows

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

Then symlink to `~/.agents/skills/` for multi-harness support (Claude Code, Codex, OpenCode):
```bash
rm -rf ~/.agents/skills/some-skill
ln -s "$(pwd)/skills/some-skill" ~/.agents/skills/some-skill
```

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

Commit when done. Use in pi: `Agent({ subagent_type: "auditor", prompt: "...", description: "..." })`

**Note:** Model changes in agents (e.g., swapping `model: haiku` for `model: sonnet`) are minor tweaks. Don't mention them in commit messages — just lump them in with other changes.

### Adding an Extension

**Small/simple extensions** - Add directly to `extensions/`:

```bash
# Write or copy the .ts file
cp my-extension.ts ./extensions/
```

Then commit and `/reload`.

**External extensions** (npm packages, git repos) - Don't copy. Add to `scripts/install.sh`:

1. Append the `pi install` line to the "External extensions" section in `scripts/install.sh`
2. Commit the change
3. Run `./scripts/install.sh` to install

Example:
```bash
# 1. Edit scripts/install.sh, add:
pi install npm:some-extension

# 2. Commit
git add scripts/install.sh
git commit -m "Add some-extension"

# 3. Run the script
./scripts/install.sh
```

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
- Symlink skills to `~/.agents/skills/` for multi-harness support (Claude Code, Codex, OpenCode)
