# Pizza - Personal Pi Package

This is a personal pi package containing skills, extensions, and prompts. It's designed for new machine setup.

## Install on New Machine

```bash
# Using git
git clone git@github.com:edwrdc/pizza.git ~/code/pizza

# Or using GitHub CLI
gh repo clone edwrdc/pizza ~/code/pizza
# See gh dl --help for other options

cd ~/code/pizza
npm run setup
```

This runs `pi install .` which registers pizza with pi. The repo stays at `~/code/pizza/` - pi references it directly.

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

Changes reflect immediately after `/reload` in pi.

### Adding an Extension

**Small/simple extensions** - Add directly to `extensions/`:

```bash
# Write or copy the .ts file
cp my-extension.ts ./extensions/
```

Then commit and `/reload`.

**Big/complex extensions** (like pi-agents, pi-mcp-access) - Don't copy. Instead, add to `scripts/install.sh`:

```bash
# In install.sh, add after "pi install .":
pi install git:github.com:someone/pi-big-extension
```

Then:
```bash
git add scripts/install.sh
git commit -m "Add pi-big-extension"
git push
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
