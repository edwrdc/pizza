# Skills

This file records the skills used with this personal Pi setup and identifies which resources Pizza owns.

Read this file before adding, removing, replacing, or updating a skill.

## Ownership policy

- Pizza includes only personal skills that it owns or intentionally maintains.
- Third-party skills remain outside the Pizza package.
- Pizza does not install, update, remove, migrate, or vendor third-party skills.
- Installation commands below are references for a future user or coding agent. Pizza must not execute them.
- Before using a reference command, verify it against the current upstream documentation.

## Pizza-owned skills

### `deepwiki`

Researches public GitHub repositories through DeepWiki and returns compact, source-grounded handoff notes.

Source: [`skills/deepwiki/`](skills/deepwiki/)

## Third-party skill references

These skills may be installed independently as loose global skills or through separate Pi packages. Their presence is not required or managed by Pizza.

### `grilling`

Stress-tests plans and decisions with a design-tree interview.

- Upstream: <https://github.com/mattpocock/skills>
- Reference command:

  ```bash
  pnx skills@latest add mattpocock/skills --skill grilling --agent pi --global --yes
  ```

### `gh-stack`

Provides GitHub stacked PR workflow guidance.

- Upstream: <https://github.com/github/gh-stack/tree/main/skills/gh-stack>
- Reference command:

  ```bash
  pnx skills@latest add github/gh-stack --skill gh-stack --agent pi --global --yes
  ```

### `impeccable`

Provides frontend design guidance and interface review tools.

- Upstream: <https://github.com/pbakaus/impeccable>
- Reference command:

  ```bash
  pnx skills@latest add pbakaus/impeccable --skill impeccable --agent pi --global --yes
  ```

### `show-me`

Provides image and screenshot display workflow guidance.

- Upstream: <https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md>
- Reference command:

  ```bash
  pnx skills@latest add humanlayer/skills --skill show-me --agent pi --global --yes
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

### `svelte-code-writer`

Provides Svelte documentation lookup and code-analysis instructions.

- Upstream: <https://github.com/sveltejs/ai-tools/tree/main/tools/skills/svelte-code-writer>
- Reference command:

  ```bash
  pnx skills@latest add sveltejs/ai-tools --skill svelte-code-writer --agent pi --global --yes
  ```

### `svelte-core-bestpractices`

Provides guidance for writing modern Svelte components and modules.

- Upstream: <https://github.com/sveltejs/ai-tools/tree/main/tools/skills/svelte-core-bestpractices>
- Reference command:

  ```bash
  pnx skills@latest add sveltejs/ai-tools --skill svelte-core-bestpractices --agent pi --global --yes
  ```

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
4. Do not copy the skill into `skills/` or add installation behavior to Pizza.
