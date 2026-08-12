# Legacy Pizza Resources

Pizza was reset around the personal resources that were active globally. The resources below were intentionally removed from the active package during that reset. This inventory exists so useful pieces can be reconsidered later without treating them as supported today.

## Skills

- `codebase-design`
- `domain-modeling`
- `grill-me`
- `grill-with-docs`
- `prototype`
- `tdd`

## Extensions

- `clear`
- `side-conversation`
- vendored `ask-user-question`
- disabled experiments: `answer` and `tool-call-behavior`

## Other resources

- `frontend-debugger` agent
- `work-issues` prompt
- Jina MCP server entry

These names are archival notes, not package declarations. Reintroduce a resource only after reviewing its current implementation and ownership.

## Upgrade note

The old `install.sh` copied skills into `~/.agents/skills/` and linked agents from an authoring checkout. Pizza 2 does not remove those files because they are outside its current ownership boundary.

On a machine upgraded from the old bootstrap, review the skill names above under `~/.agents/skills/`. Also inspect `~/.pi/agent/agents/frontend-debugger.md`, or the corresponding path under `$PI_CODING_AGENT_DIR`. Remove a file only after confirming it came from the old Pizza checkout and is no longer wanted.
