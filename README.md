# 🍕 Pizza

Pizza is a personal Pi distribution package. It keeps Pizza-owned skills, extensions, and support configuration in one Git repository while leaving third-party skills and community extensions outside Pizza's ownership.

## Install

```bash
pi install git:github.com/edwrdc/pizza
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

### Exploration routing prompt

[`APPEND_SYSTEM.md`](APPEND_SYSTEM.md) teaches the main agent when to inspect code directly, launch one scout, or split an investigation across several scouts. Each interactive scout opens in its own Herdr pane when Pi runs inside Herdr.

Pizza does not manage this prompt link yet. Create it manually after installation:

```bash
ln -s "$HOME/.pi/agent/git/github.com/edwrdc/pizza/APPEND_SYSTEM.md" \
  "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/APPEND_SYSTEM.md"
```

Run `/reload` afterward. Pi uses a trusted project's `.pi/APPEND_SYSTEM.md` instead of the global file when both exist. Remove the global link manually if you no longer want the routing policy.

## Pizza commands

```text
/pizza setup       Configure support links and open the package pantry
/pizza packages    Open only the community-package pantry
/pizza doctor      Audit support links, loose skill collisions, and catalog packages
/pizza unlink      Remove only support links owned by Pizza
```

Add `--yes` to `setup` or `unlink` to approve filesystem changes without a confirmation dialog.

## Multi Codex

Pizza includes its own Multi Codex extension under `extensions/codex-multi-account/`. It registers `openai-codex-2`, `openai-codex-3`, and `openai-codex-4` so each additional ChatGPT subscription account has a separate credential entry.

```text
/login openai-codex-2
/codex-accounts
/codex-switch
/codex-usage-all
```

Codex Conversion is selected by default in the package pantry because the Multi Codex usage commands use it. It remains an independent package and can be skipped or removed separately.

Multi Codex loads Codex Conversion's usage client read-only. Codex Conversion 3.0.15+ validates subscription models by API and base URL (not provider id), so numbered OpenAI Codex clone providers work without any patching. Earlier Codex Conversion versions required a `/codex-usage-unpatch`-managed file patch; that machinery is gone.

If the older standalone Multi Codex package is installed, Pizza reports the duplicate. Remove it manually and reload Pi:

```bash
pi remove git:github.com/edwrdc/pi-multi-codex
```

```text
/reload
```

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

Then run `pi remove git:github.com/edwrdc/pizza`. If Pizza was already removed, inspect the active Pi agent directory (`$PI_CODING_AGENT_DIR` or `~/.pi/agent`). Remove only dangling symlinks under `agents/` whose targets point into Pizza's package, plus the `mcp.json` symlink if it points into Pizza. Do not delete regular files.

## Underclass

Pizza includes an Underclass extension under `extensions/underclass/`. It registers a self-hosted [underclass](https://github.com/ghuntley/underclass) instance on the OpenAI Responses API (`/v1/responses`) and exposes that instance's admin state and usage.

Pizza vendors the Codex model list in `extensions/underclass/codex-models.ts`, including GPT-6.1 Sol, because underclass's own `/v1/models` is stale and incomplete. Models underclass reports that are not in that list are added as extras; discovered entries that do not advertise `codex` in `owned_by` are skipped, because Copilot-backed ids only serve `/v1/chat/completions`.

Pi refreshes the Underclass catalog from `/v1/models` automatically at interactive startup, after `/login underclass`, and when you open `/model`. Failed refreshes keep the cached catalog.

```text
/login underclass
/underclass setup
/underclass status
/underclass accounts
/underclass usage
/underclass pcc
/underclass help
```

The default origin is `https://underclass.edwrdc.me`. Point at your own instance with the `UNDERCLASS_ORIGIN` environment variable or `/underclass setup`, which writes the origin to `extensions/underclass.json` in the active Pi agent directory. `/underclass pcc`, and `/underclass setup` with it, add `underclass` to `scope.additionalProviders` in `pi-codex-conversion.json` so Codex Conversion's Codex-shaped adapter activates for underclass models (Additional providers). Both secrets live in `auth.json`: the proxy key under `underclass` (written by `/login underclass`) and the admin `ui_token` under `underclass-admin` (written by `/underclass setup`).

## Community package catalog

The pantry entries live in [`catalog/community-packages.json`](catalog/community-packages.json). They are installation suggestions, not vendored dependencies and not resources owned by Pizza.

Current suggestions include Pi Subagents, Pi MCP Adapter, Context7, Synthetic, FFF, Ponytail, and Codex Conversion.

## Authoring flow

The development checkout is an authoring clone. It should not be registered as a local Pi package.

```text
Projects/pizza → git push → GitHub → pi update --extensions → Pi-managed clone
```

Historical resources removed during the clean-slate refactor are listed in [`LEGACY_RESOURCES.md`](LEGACY_RESOURCES.md).

## License

MIT
