# 🍕 Pizza

Pizza is a private personal Pi distribution package. It keeps Pizza-owned skills and support configuration in one Git repository while leaving third-party skills and community extensions outside Pizza's ownership.

## Install

```bash
pi install git:git@github.com:edwrdc/pizza
```

Then start Pi and run:

```text
/pizza setup
```

`/pizza setup`:

1. Links Pizza's agent definitions and MCP configuration into the active Pi agent directory.
2. Migrates loose copies of Pizza-owned skills from Pi and shared Agent Skills directories into a timestamped backup so the package copies do not collide.
3. Opens the Pizza package pantry, where optional community packages can be installed independently.
4. Reloads Pi after changes.

Update Pizza with all other installed Pi packages:

```bash
pi update --extensions
```

## Personal resources

### Skills

Pizza-owned skills are listed in [`SKILLS.md`](SKILLS.md) and loaded from `skills/*/SKILL.md`. A user-scoped Pizza install makes them global across Pi projects. Use `pi config` to enable or disable individual skills.

Third-party skills used alongside Pizza are listed in [`SKILLS.md`](SKILLS.md). The list is documentation only. Pizza does not install or manage those skills.

### Supporting configuration

Pizza ships the definitions under `agents/*.md` and `mcp.json` even though Pi's package manifest does not natively register them.

The `/pizza setup` command links them from Pi's managed Git clone. Because the links target the managed clone, package updates update their contents without recopying them.

## Pizza commands

```text
/pizza setup       Configure support links and open the package pantry
/pizza packages    Open only the community-package pantry
/pizza doctor      Audit support links, loose skill collisions, and catalog packages
/pizza unlink      Remove only support links owned by Pizza
```

Add `--yes` to `setup` or `unlink` to approve filesystem changes without a confirmation dialog.

Pizza never removes community packages. Manage packages after installation with Pi itself:

```bash
pi list
pi update --extensions
pi remove <source>
```

Before removing Pizza itself, unlink its support files while the `/pizza` command is still available:

```text
/pizza unlink
```

Then run `pi remove git:git@github.com:edwrdc/pizza`. If Pizza was already removed, inspect the active Pi agent directory (`$PI_CODING_AGENT_DIR` or `~/.pi/agent`). Remove only dangling symlinks under `agents/` whose targets point into Pizza's package, plus the `mcp.json` symlink if it points into Pizza. Do not delete regular files.

## Community package catalog

The pantry entries live in [`catalog/community-packages.json`](catalog/community-packages.json). They are installation suggestions, not vendored dependencies and not resources owned by Pizza.

Current suggestions include Pi Subagents, Pi MCP Adapter, Context7, Synthetic, FFF, Codex Conversion, and Pi Multi Codex.

## Authoring flow

The development checkout is an authoring clone. It should not be registered as a local Pi package.

```text
Projects/pizza → git push → GitHub → pi update --extensions → Pi-managed clone
```

Historical resources removed during the clean-slate refactor are listed in [`LEGACY_RESOURCES.md`](LEGACY_RESOURCES.md).

## License

MIT
