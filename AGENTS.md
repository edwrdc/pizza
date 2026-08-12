# Pizza — Personal Pi Distribution

Pizza is installed globally as one private Git-backed Pi package. The repository is the source of truth for personal Pi skills, the Pizza setup extension, agent definitions, MCP configuration, and the optional community-package catalog.

## Installation model

```bash
pi install git:git@github.com:edwrdc/pizza
pi update --extensions
```

The checkout under `Projects/pizza` is the authoring clone. Do not register it with Pi as a local-path package.

## Ownership boundaries

Pizza owns:

- `extensions/pizza.ts`
- personal package skills under `skills/`
- support files under `agents/` and `mcp.json`
- the installation catalog in `catalog/community-packages.json`

Community packages remain independent Pi package sources. Pizza may offer to install them but must not vendor, update, disable, or remove them itself.

Third-party skills are also outside Pizza's ownership. Pizza records them in `SKILLS.md` for personal reference only and must not install, update, remove, migrate, or vendor them.

## Skills

Before adding, removing, replacing, or updating any skill, read `SKILLS.md` and keep its ownership records current.

Pizza-owned skills are declared through the root `pi.skills` manifest and are globally available when Pizza is installed at user scope. Do not copy them into `~/.pi/agent/skills/` or `~/.agents/skills/`; duplicate names create collisions.

Current package skills are listed in `SKILLS.md` and discovered from direct `skills/<name>/SKILL.md` entries.

Do not copy an unchanged third-party skill into `skills/`. Add it to the external references in `SKILLS.md` instead. Reference commands in that file are documentation for a future agent or user; Pizza must never execute them.

## Support files

Pi packages do not natively register agents or MCP configuration. `/pizza setup` creates explicit symlinks from the active Pi agent directory to Pizza's managed clone. It backs up conflicts and migrates duplicate loose skills before linking.

`/pizza unlink` may remove only symlinks that resolve to files inside this Pizza package. Never remove independent packages or arbitrary user files.

## Package pantry

Maintain third-party suggestions in `catalog/community-packages.json`, not in TypeScript. Every entry requires a stable id, display label, valid Pi package source, and concise description.

The pantry is install-only. Package removal and updating remain Pi responsibilities.

## Adding resources

- Personal skill: read `SKILLS.md`, add a standard `<name>/SKILL.md` directory under `skills/`, and update the owned-skills section in `SKILLS.md`.
- Third-party skill reference: update `SKILLS.md` only. Do not add installer behavior to Pizza.
- Pizza behavior: update `extensions/pizza.ts`.
- Agent definition: add a top-level `.md` file under `agents/`; Pizza setup discovers direct `agents/*.md` entries.
- MCP server: update `mcp.json`.
- Community suggestion: update `catalog/community-packages.json`.

Run focused validation before committing. Changes become available after push plus `pi update --extensions` and `/reload` where needed.
