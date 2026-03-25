#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
pi install .

# External extensions
echo "==> Installing external extensions"
pi install npm:@tintinweb/pi-subagents
pi install npm:pi-mcp-adapter

# Symlink MCP config (pizza is source of truth for global MCP servers)
mkdir -p ~/.pi/agent
ln -sf "$ROOT_DIR/mcp.json" ~/.pi/agent/mcp.json

cat <<EOF

Pizza installed!

Installed packages:
  - pizza (skills, extensions, prompts)

You can now run pi in any project.
EOF
