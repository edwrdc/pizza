# 🍕 pizza

Personal pi bootstrap repo with skills, extensions, prompts, agents, and one-click setup for a new machine.

## Install

```bash
# Clone the repo
git clone git@github.com:edwrdc/pizza.git ~/code/pizza
# or using GitHub CLI: gh repo clone edwrdc/pizza ~/code/pizza

cd ~/code/pizza
./install.sh
```

## What's Inside

| Directory | Contents |
|-----------|----------|
| `extensions/` | Custom pi extensions |
| `skills/` | Skills (copied + modified for my use) |
| `prompts/` | Reusable prompt templates |
| `themes/` | Custom themes |
| `agents/` | pi-subagents agent definitions |
| `mcp.json` | Global MCP server config |
| `install.sh` | New-machine bootstrap script |

### Skills

- `visual-explainer` - Generate HTML diagrams and visualizations
- `deepwiki` - Public GitHub repository research via DeepWiki with compact handoff notes

### Extensions

- `clear` - `/clear` alias for `/new`
- `ask-user-question` - vendored structured `ask_user_question` TUI tool

### Subagents

- `deepwiki-research` - Isolated DeepWiki repo research with `explore`, `architect`, and `mixed` modes

## Adding New Stuff

### Skills

```bash
# Copy a skill into pizza
cp -r ~/.agents/skills/some-skill ./skills/
```

### Extensions

Create `.ts` files in `extensions/`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("mycommand", {
    description: "Does something",
    handler: async (_args, ctx) => {
      // ...
    },
  });
}
```

### Prompts

Create `.md` files in `prompts/`:

```markdown
Review this code for bugs and security issues.
Focus on: {{focus}}
```

Use with `/filename` in pi.

## License

MIT
