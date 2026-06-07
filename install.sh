#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd node
need_cmd npm
need_cmd pi

cd "$ROOT_DIR"

echo "==> Installing pizza"
# Remove first so existing filtered installs become full installs.
pi remove "$ROOT_DIR" >/dev/null 2>&1 || true
pi install "$ROOT_DIR"

echo "==> Installing local extensions"
pi remove "$ROOT_DIR/extensions/ask-user-question" >/dev/null 2>&1 || true
pi install "$ROOT_DIR/extensions/ask-user-question"

# External extensions
echo "==> Installing external extensions"
pi install npm:@tintinweb/pi-subagents
pi install npm:pi-mcp-adapter
pi install npm:@howaboua/pi-codex-conversion
pi install npm:pi-caveman

# Symlink MCP config (pizza is source of truth for global MCP servers)
mkdir -p ~/.pi/agent ~/.pi/agent/agents ~/.agents/skills
ln -sf "$ROOT_DIR/mcp.json" ~/.pi/agent/mcp.json

# Symlink agents (for pi-subagents)
for agent in agents/*.md; do
  ln -sf "$ROOT_DIR/$agent" ~/.pi/agent/agents/"$(basename "$agent")"
done

# Symlink skills (for Claude Code, Codex, OpenCode)
for skill in skills/*/; do
  ln -sfn "$ROOT_DIR/$skill" ~/.agents/skills/"$(basename "$skill")"
done

cat <<EOF

Pizza installed!

Installed packages:
  - pizza (skills, extensions, prompts)

You can now run pi in any project.
EOF
