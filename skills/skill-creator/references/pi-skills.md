# Pi Skills Reference

Use this reference for Pi-specific placement and validation decisions. Verify details against the installed Pi documentation before making changes.

## Official sources

- Pi skills: <https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md>
- Pi packages: <https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md>
- Agent Skills specification: <https://agentskills.io/specification>

## Discovery locations

Pi discovers skills from:

- Global Pi: `~/.pi/agent/skills/`
- Global cross-harness: `~/.agents/skills/`
- Project Pi: `.pi/skills/` after the project is trusted
- Project cross-harness: `.agents/skills/` in the current or ancestor directories, after trust
- Pi packages: conventional `skills/` directories or paths in `package.json` under `pi.skills`
- Settings: entries in the `skills` array
- CLI: repeatable `--skill <path>` entries

`--no-skills` disables discovered skills, but explicit `--skill` entries remain additive.

## Discovery behavior

- A directory containing `SKILL.md` is a skill root.
- Pi recursively discovers directories containing `SKILL.md`.
- `~/.pi/agent/skills/` and `.pi/skills/` also accept direct root Markdown files with valid skill frontmatter and a non-empty description.
- Root Markdown files are ignored in `.agents/skills/`; nested grouped Markdown files can be discovered when they declare skill frontmatter.
- Project-local skills load only after project trust.
- Duplicate names produce a collision diagnostic and the first discovered skill wins.
- The same file reached through a symlink is deduplicated.
- Ignore files such as `.gitignore`, `.ignore`, and `.fdignore` can affect recursive discovery.

Prefer the portable directory form:

```text
example-skill/
└── SKILL.md
```

## Loading model

At startup Pi loads each skill's name, description, and location into the system prompt. The model can then read the full `SKILL.md` when the task matches, but Pi's documentation notes that models do not always do so. Use `/skill:<name>` when explicit loading matters. Relative paths resolve from the skill directory.

Every discovered skill also registers `/skill:<name>` when skill commands are enabled. Arguments following the slash command are appended to the skill content as a user message.

Set `disable-model-invocation: true` when a skill should be explicit-only. Pi then excludes it from the automatic skill list while preserving `/skill:<name>`.

## Frontmatter

Required:

- `name`: 1-64 characters; lowercase `a-z`, digits, and hyphens; no leading, trailing, or consecutive hyphens.
- `description`: 1-1024 characters; explain what the skill does and when to use it.

Optional Agent Skills fields:

- `license`: short license name or bundled file reference.
- `compatibility`: up to 500 characters describing actual environment requirements.
- `metadata`: string-to-string metadata mapping.
- `allowed-tools`: space-delimited pre-approved tools; experimental and not portable across all clients.

Pi-specific optional field:

- `disable-model-invocation`: Boolean; `true` makes the skill slash-command-only.

Pi warns about most naming and length violations but remains lenient. Missing or empty descriptions and malformed declared `SKILL.md` files prevent loading. Unknown fields are ignored.

The Agent Skills standard requires the skill name to match the directory. Pi intentionally allows a mismatch, but matching names remain the portable default.

## Package integration

A Pi package may use a conventional `skills/` directory without a manifest. An explicit manifest is useful when the package owns multiple resource types or needs filtering:

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "skills": ["./skills"]
  }
}
```

Manifest paths are relative to the package root and may use globs. Do not register a package-owned skill again as a loose global skill; duplicate names collide and duplicate ownership complicates updates.

## Cross-harness differences to avoid by default

Pi does not require:

- Codex `agents/openai.yaml`
- Claude Code command files or Claude-specific evaluator scripts
- a packaged `.skill` archive
- a README or separate installation guide inside each skill

Add foreign-harness files only when cross-harness operation is an explicit requirement. Keep Pi's `SKILL.md` functional without them.

## Validation checklist

### Structure

- `SKILL.md` exists and has a non-empty body.
- Every local link resolves from the skill root.
- Scripts and assets referenced by instructions exist.
- Detailed references are linked directly from `SKILL.md`.
- No unused placeholder or generated cache files remain.

### Frontmatter

- Name and description satisfy Pi limits.
- Description names both capability and trigger context.
- Optional fields are justified and correctly typed.
- Directory and frontmatter names match unless intentionally Pi-only.

### Behavior

- The owning location is discoverable and trusted where necessary.
- There is no same-name skill earlier in discovery order.
- `/skill:<name>` loads the expected file.
- Natural-language positive prompts select it when useful.
- Near-miss prompts do not select it unnecessarily.
- Bundled scripts succeed on representative and failure inputs.

### Reloading

Use `/reload` after changing resources in a running interactive Pi session. A new invocation with `--skill <path>` is useful for testing a skill before installing or registering it.
