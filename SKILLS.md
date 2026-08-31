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

These skills may be installed independently in the user's global Agent Skills directory. Their presence is not required or managed by Pizza.

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

### `svelte-code-writer`

Provides Svelte documentation lookup and code-analysis instructions.

- Upstream: <https://github.com/sveltejs/ai-tools/tree/main/tools/skills/svelte-code-writer>
- Reference command:

  ```bash
  npx skills@latest add sveltejs/ai-tools --skill svelte-code-writer --agent pi --global --yes
  ```

### `svelte-core-bestpractices`

Provides guidance for writing modern Svelte components and modules.

- Upstream: <https://github.com/sveltejs/ai-tools/tree/main/tools/skills/svelte-core-bestpractices>
- Reference command:

  ```bash
  npx skills@latest add sveltejs/ai-tools --skill svelte-core-bestpractices --agent pi --global --yes
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
