# Skills

This file records the skills used with this personal Pi setup and identifies which resources Pizza owns.

Read this file before adding, removing, replacing, or updating a skill.

## Ownership policy

- Pizza includes only personal skills that it owns or intentionally maintains.
- Third-party skills stay outside the Pizza package, with one defined exception: a third-party skill may be vendored when a Pizza agent definition depends on it. Each vendored copy records its upstream path and commit, and is refreshed by hand.
- Pizza still does not install, update, remove, or migrate loose third-party skills.
- Installation commands below are references for a future user or coding agent. Pizza must not execute them.
- Before using a reference command, verify it against the current upstream documentation.

## Pizza-owned skills

Pizza ships the personal skills listed below. The `skills/` entry stays in the package manifest, so adding `skills/<name>/SKILL.md` is enough to publish a new personal skill.

The `deepwiki` skill was removed when DeepWiki research was dropped from this setup.

### `skill-creator`

Creates, updates, reviews, and validates Agent Skills specifically for Pi, including Pi discovery, placement, frontmatter, progressive disclosure, and package integration.

Source: [`skills/skill-creator/`](skills/skill-creator/)

### `svelte-code-writer`

Svelte documentation lookup and code analysis through the `@sveltejs/mcp` CLI. The delegated Svelte workflow in [`profiles/svelte-file-editor/`](profiles/svelte-file-editor/) uses it as the fallback when the Svelte MCP server is unreachable.

- Source: [`skills/svelte-code-writer/`](skills/svelte-code-writer/)
- Upstream: <https://github.com/sveltejs/ai-tools/tree/main/tools/skills/svelte-code-writer>
- Vendored: `sveltejs/ai-tools` commit `75a688cd090b7b8326bfc988cf4ed69d5abd38fd` (2026-10-29)

### `svelte-core-bestpractices`

Svelte 5 reactivity, event, styling, and legacy-feature rules. Loaded for Svelte component and module work.

- Source: [`skills/svelte-core-bestpractices/`](skills/svelte-core-bestpractices/)
- Upstream: <https://github.com/sveltejs/ai-tools/tree/main/tools/skills/svelte-core-bestpractices>
- Vendored: `sveltejs/ai-tools` commit `75a688cd090b7b8326bfc988cf4ed69d5abd38fd` (2026-10-29)
- Note: `SKILL.md` links `references/*.md` inside the skill directory. Keep those files when updating.

## Third-party skill references

These skills may be installed independently as loose global skills or through separate Pi packages. Their presence is not required or managed by Pizza.

### `grilling`

Stress-tests plans and decisions with a design-tree interview.

- Upstream: <https://github.com/mattpocock/skills>
- Reference command:

  ```bash
  npx skills@latest add mattpocock/skills --skill grilling --agent pi --global --yes
  ```

### `gh-stack`

Provides GitHub stacked PR workflow guidance.

- Upstream: <https://github.com/github/gh-stack/tree/main/skills/gh-stack>
- Reference command:

  ```bash
  npx skills@latest add github/gh-stack --skill gh-stack --agent pi --global --yes
  ```

### `impeccable`

Provides frontend design guidance and interface review tools.

- Upstream: <https://github.com/pbakaus/impeccable>
- Reference command:

  ```bash
  npx skills@latest add pbakaus/impeccable --skill impeccable --agent pi --global --yes
  ```

### `show-me`

Provides image and screenshot display workflow guidance.

- Upstream: <https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md>
- Reference command:

  ```bash
  npx skills@latest add humanlayer/skills --skill show-me --agent pi --global --yes
  ```

### `pi-pstack` (package)

Provides pstack orchestration workflows adapted to reuse pi-subagents, including private role-based model routing and ordered fallback handling.

- Upstream: <https://github.com/edwrdc/pi-pstack>
- Derived from: <https://github.com/kkgogogo17/pi-pstack> and Cursor's <https://github.com/cursor/plugins/tree/main/pstack>
- Reference command:

  ```bash
  pi install git:github.com/edwrdc/pi-pstack
  ```

After installation, run `/pstack setup` and `/reload` to expose its bundled agent definitions.

### `svelte-mcp-feedback`

Reports cases where the Svelte MCP autofixer missed or mis-fixed a mistake the user corrected. Opt-in: it files issues in `sveltejs/ai-tools` with `gh`, or opens a prefilled issue form.

- Upstream: <https://github.com/sveltejs/ai-tools/tree/main/tools/skills/svelte-mcp-feedback>
- Reference command:

  ```bash
  npx skills@latest add sveltejs/ai-tools --skill svelte-mcp-feedback --agent pi --global --yes
  ```

### `technical-writing`

Provides a layered technical-writing standard: Diátaxis document modes, Google developer style sentences, STE instruction rules, and Global English sentence checks.

- Upstream: <https://github.com/cursor/plugins/blob/main/pstack/skills/technical-writing/SKILL.md>
- Local copy: `~/.agents/skills/technical-writing/SKILL.md`
- Reference command:

  ```bash
  npx skills@latest add cursor/plugins --skill technical-writing --agent pi --global --yes
  ```

- Local deviation: the installed copy omits `disable-model-invocation: true` from the frontmatter on purpose. Upstream sets that key, which hides the skill from automatic model selection in Pi. A reinstall restores the key, so remove it again after any install or update. The local copy is not tracked in `~/.agents/.skill-lock.json`, because the install was written by hand rather than by the `skills` CLI.

### `thermo-nuclear-code-quality-review`

Provides a strict maintainability review rubric: structural simplification, abstraction quality, giant files, spaghetti-condition growth, and review tone.

- Upstream: <https://github.com/cursor/plugins/blob/main/thermos/skills/thermo-nuclear-code-quality-review/SKILL.md>
- Local copy: `~/.agents/skills/thermo-nuclear-code-quality-review/SKILL.md`
- Reference command:

  ```bash
  npx skills@latest add cursor/plugins --skill thermo-nuclear-code-quality-review --agent pi --global --yes
  ```

- Local deviation: the installed copy omits `disable-model-invocation: true` from the frontmatter on purpose. Upstream sets that key, which hides the skill from automatic model selection in Pi. A reinstall restores the key, so remove it again after any install or update. The local copy is not tracked in `~/.agents/.skill-lock.json`, because the install was written by hand rather than by the `skills` CLI.
- Duplicate upstream path: `cursor/plugins` ships this skill twice, at `thermos/skills/` and at `cursor-team-kit/skills/`. The two files are byte-identical today. `thermos` is the maintained home, so record that path when the copies diverge. A `--skill thermo-nuclear-code-quality-review` install may resolve either copy, so check the fetched content before trusting an update.

## Adding or changing skills

### Add a personal skill

1. Add `skills/<name>/SKILL.md`.
2. Add the skill to the Pizza-owned section above.
3. Confirm that no third-party skill with the same name is installed as a loose global skill.

The Pizza extension discovers owned skill names from the `skills/` directory. Do not add a separate hardcoded name list.

### Record a third-party skill

1. Add it to the third-party references above.
2. Record its upstream repository and purpose.
3. Optionally record a reference installation command.
4. Do not copy the skill into `skills/` or add installation behavior to Pizza. Vendoring is reserved for a skill a Pizza agent definition depends on, and it is recorded in the Pizza-owned section instead.

### Update a vendored skill

1. Compare the copy in `skills/<name>/` with upstream, including any `references/` or `scripts/` files.
2. Copy the changed files over the local copy. Do not hand-edit vendored content, so the next update is a plain copy.
3. Update the recorded upstream commit and date in the Pizza-owned section above.
4. Run `/reload` and confirm the skill still lists in Pi.
