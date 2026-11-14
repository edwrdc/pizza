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

1. Links Pizza's agent definitions, MCP configuration, and global agent instructions into the active Pi agent directory.
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

Third-party skills used alongside Pizza are listed in [`SKILLS.md`](SKILLS.md). The list is documentation only. Pizza does not install, update, or remove those skills.

Two third-party skills are vendored unchanged under `skills/` because the `svelte-file-editor` agent depends on them: `svelte-code-writer` and `svelte-core-bestpractices`. `SKILLS.md` records their upstream commit and how to refresh them.

### Supporting configuration

Pizza ships the agent profiles under `profiles/<name>/` and `mcp.json` even though Pi's package manifest does not natively register them.

Each profile directory holds `profile.json` and `prompt.md`. `/pizza setup` links those files into `<agent-dir>/shepherdr/profiles/<name>/`, which is where the Shepherdr extension reads them. The profile directory itself is created by setup and is not a symlink, because Shepherdr only loads real directories.

The `/pizza setup` command links them from Pi's managed Git clone. Because the links target the managed clone, package updates update their contents without recopying them.

### Global agent instructions

[`GLOBAL_AGENTS.md`](GLOBAL_AGENTS.md) holds instructions that apply in every project. `/pizza setup` links it to `<agent-dir>/AGENTS.md`, and `/pizza unlink` removes only that link.

Pi loads `<agent-dir>/AGENTS.md` as a context file, so a project's own `AGENTS.md` adds to it and never replaces it. An `AGENTS.override.md` overrides files only in its own directory. If `<agent-dir>/AGENTS.md` already exists and is not a Pizza link, setup moves it into `<agent-dir>/pizza-backups/` first.

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

## Elephant-Goldfish workflow

Pizza includes a Pi adaptation of [Google's Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model). It is a design and review workflow, not a model provider. It uses `npm:@howaboua/pi-shepherdr` installed globally through Pi.

```text
/egm setup
/egm settings
/egm brainstorm Add webhook delivery
/egm draft
/egm review design_draft.md
/egm implement design_draft.md
/egm code-review design_draft.md
/egm status
/egm off
```

The main session is the Elephant. Choose its model with Pi's `/model` command. Brainstorming develops requirements and acceptance criteria without application code. Drafting writes one section at a time and waits for your approval. You can pass a local notes file to `/egm draft`.

Design review runs five stages: architecture, comprehension, design critique, another architecture check, and implementation readiness. Each stage uses a fresh Goldfish session. After each report, choose whether to revise and rerun, continue, or stop. Review never approves implementation automatically. `/egm implement <design>` is your explicit approval to delegate that design to the implementer. `/egm code-review <design>` checks the resulting code against it.

### Role settings

`/egm setup` creates six dedicated Shepherdr profiles: `egm-zoom-out`, `egm-comprehension`, `egm-critic`, `egm-readiness`, `egm-code-review`, and `egm-implementer`. Their initial model and thinking level come from the main session at setup time. They do not follow later main-session model changes. `/egm settings` changes one role's model and supported thinking level. New workers use the change immediately.

Settings live directly in `<agent-dir>/shepherdr/profiles/egm-*/profile.json`. These are writable files, not links into Pizza's managed clone. You can also edit their `model` and `thinking` fields directly. Setup preserves those two fields and restores the managed profile instructions and tool settings. It refuses unmarked directories, symlinked profiles, and malformed configuration rather than overwriting them. The `.pizza-egm` file marks each generated profile. `/pizza unlink` leaves these regular files alone.

### Reports and limits

Each review or implementation run gets a new `.egm-review-*` directory beside its design document. The main agent saves complete reports and a `progress.md` checkpoint there. EGM's active phase persists in the current session branch across reloads. `/egm off` removes its instructions but does not stop workers. Cancelling a blocking Shepherdr call also leaves its worker running. Ask the main agent to send `/quit` to that worker if you need to stop it.

EGM asks the main agent to use Shepherdr's normal `agents` tool. Dispatch, checkpoints, report saving, and cleanup are model-mediated, not a deterministic background scheduler. EGM stops instead of substituting an in-session review when fresh workers or configured models are unavailable.

Goldfish profiles disable shared Notes/history and expose only `read`, `grep`, `find`, and `ls`. They load only Shepherdr and Pizza's Underclass/Multi Codex provider extensions. This excludes shared Board, other extensions, skills, and automatic project/system prompts. Built-in models and Pizza providers work in reviewers. Models that require another provider extension are outside this version. The implementer uses the normal project environment.

These tool limits are not a filesystem sandbox. The main session's no-code rule is an instruction, not a permission boundary. Use trusted projects. This first version combines some upstream reviewer personas. It does not port upstream skill installation, bootstrap, or drift reporting.

### Installed Board check

After installing `npm:@howaboua/pi-agent-board` and Shepherdr globally through Pi, run:

```bash
npm run test:egm-board
```

This optional check uses the installed Board package and the Node-based Pi SDK on `PATH`. It tests posts, shared membership, unread catch-up, active notifications, enablement, and Goldfish exclusion. It uses temporary sessions and a temporary SQLite archive with in-memory transport. It makes no model requests and does not change your Board settings or history. The browser viewer and live Herdr transport are outside this check.

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

Then run `pi remove git:github.com/edwrdc/pizza`. If Pizza was already removed, inspect the active Pi agent directory (`$PI_CODING_AGENT_DIR` or `~/.pi/agent`). Remove only dangling symlinks under `shepherdr/profiles/` whose targets point into Pizza's package, plus the `mcp.json` symlink if it points into Pizza. Do not delete regular files.

## Underclass

Pizza includes an Underclass extension under `extensions/underclass/`. It registers a self-hosted [underclass](https://github.com/ghuntley/underclass) instance on the OpenAI Responses API (`/v1/responses`) and exposes that instance's admin state and usage.

Pizza vendors the Codex model list in `extensions/underclass/codex-models.ts`, including GPT-6.1 Sol, because underclass's own `/v1/models` is stale and incomplete. Models underclass reports that are not in that list are added as extras; discovered entries that do not advertise `codex` in `owned_by` are skipped, because Copilot-backed ids only serve `/v1/chat/completions`.

Pi refreshes the Underclass catalog from `/v1/models` automatically at interactive startup, after `/login underclass`, and when you open `/model`. Failed refreshes keep the cached catalog.

Underclass uses Pi's legacy provider registration so PCC's proxy Responses Lite stream override merges with its models, authentication, and catalog refresh. PCC is optional.

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
