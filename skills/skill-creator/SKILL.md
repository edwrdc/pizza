---
name: skill-creator
description: Create, update, review, and validate Agent Skills specifically for Pi. Use when the user asks to make or improve a Pi skill, write SKILL.md, choose global/project/package placement, troubleshoot discovery or /skill:name commands, or audit frontmatter, progressive disclosure, scripts, references, assets, and name collisions.
---

# Pi Skill Creator

Create skills for **Pi's implementation of the Agent Skills standard**. Prefer Pi's current documentation and behavior over conventions from Claude Code, Codex, or another harness.

## Start with the current source of truth

Before creating or changing a skill:

1. Read the repository's instructions and ownership records, if present.
2. Read the installed Pi `docs/skills.md` completely. If it is unavailable, use [Pi's skills documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).
3. If the skill belongs to a Pi package, also read Pi's `docs/packages.md`.
4. Read [references/pi-skills.md](references/pi-skills.md) when choosing placement, frontmatter, discovery, or validation behavior.

Pi evolves. Treat the bundled reference as a compact checklist, not a replacement for current Pi docs.

## Workflow

### 1. Establish intent

Infer as much as possible from the conversation and existing files before asking questions. Resolve only material gaps:

- What recurring task should the skill make more reliable?
- What realistic requests should trigger it?
- What should not trigger it?
- What output or behavior defines success?
- Does it need reusable scripts, detailed references, or output assets?

For an existing skill, inspect its current behavior and preserve its name, location, and useful conventions unless the user requests a migration.

### 2. Choose the owning location

Choose placement deliberately rather than copying files into every supported directory:

- **Existing Pi package:** follow its manifest and ownership policy; normally add `skills/<name>/SKILL.md` and update the package's records.
- **Project-only:** use `.pi/skills/<name>/SKILL.md` after the project is trusted.
- **Cross-harness project:** use `.agents/skills/<name>/SKILL.md` when portability is intentional.
- **Personal global:** use `~/.pi/agent/skills/<name>/SKILL.md`, or `~/.agents/skills/` when cross-harness sharing is intentional.
- **One-off trial:** keep it anywhere and start Pi with `--skill <path>`.

Do not install, symlink, or duplicate a skill globally without the user's consent. Search likely skill locations for an existing name before writing because Pi keeps the first skill when names collide.

### 3. Design progressive disclosure

Keep only the core procedure in `SKILL.md`. Add resources only when they provide concrete value:

```text
skill-name/
├── SKILL.md
├── scripts/       # deterministic or repeatedly rewritten operations
├── references/    # detailed knowledge loaded only when needed
└── assets/        # templates or files used in produced output
```

Use these principles:

- Assume Pi's model already knows general software concepts; document non-obvious workflow and domain knowledge.
- Match precision to fragility: use flexible guidance for judgment calls and scripts for error-prone repeatable operations.
- Keep references one level from `SKILL.md` and say exactly when to read each one.
- Avoid duplicating the same guidance in `SKILL.md` and references.
- Keep `SKILL.md` concise and preferably below 5,000 tokens. The Agent Skills specification recommends staying under 500 lines, but this is a design guideline rather than a Pi loading rule.
- Do not add auxiliary files such as a skill-specific README, changelog, or installation guide unless they are actual task resources.
- Do not create harness-specific metadata such as `agents/openai.yaml` or Claude-specific eval machinery unless the user explicitly needs cross-harness support.

### 4. Write the skill

For a new skill, either create the files directly or scaffold a minimal skill:

```bash
node <this-skill-dir>/scripts/init-skill.mjs <skill-name> \
  --path <parent-directory> \
  --description "What it does and when Pi should use it."
```

Add `--manual-only` only when the skill should be available through `/skill:name` but hidden from automatic model invocation.

Write frontmatter first:

- `name`: concise lowercase hyphen-case, 1-64 characters.
- `description`: specific description of both capability and triggering contexts, 1-1024 characters.
- Optional fields only when useful: `license`, `compatibility`, `metadata`, experimental `allowed-tools`, and Pi's `disable-model-invocation`.

Although Pi permits a frontmatter name that differs from its directory, keep them equal for Agent Skills portability unless there is a deliberate reason not to.

Write body instructions in direct, imperative language. Include:

- the workflow or decision process
- tool and resource usage
- important edge cases and failure handling
- exact output constraints when they matter
- a small number of realistic examples when they clarify behavior

The description is Pi's selection signal: Pi exposes it to the model, which decides whether to read the full skill. Put trigger language there, not only in a body section that is unavailable before selection. Models do not always load a matching skill automatically, so use `/skill:<name>` when explicit invocation matters.

### 5. Implement resources

Create only resources identified during design:

- Make scripts self-contained, parameterized, and safe by default. Document dependencies and actionable errors.
- Test every added script directly, including at least one failure case.
- Keep reference files focused and link them directly from `SKILL.md`.
- Use assets as output inputs; do not waste context describing binary assets in detail.

For a package-owned skill, update its manifest or ownership index according to repository instructions. Avoid hardcoded registration if the package already discovers `skills/` recursively.

### 6. Validate and exercise

Run the bundled static checker:

```bash
node <this-skill-dir>/scripts/check-skill.mjs <path-to-skill>
```

Then perform focused integration checks:

1. Confirm the intended Pi location or `pi.skills` manifest includes the skill.
2. Reload Pi after changing a loaded skill.
3. Check startup diagnostics for malformed frontmatter or collisions.
4. Invoke `/skill:<name>` to verify explicit loading; pass arguments if the skill expects them.
5. Try two or three realistic natural-language prompts, including one near-miss that should not select the skill.
6. Verify relative links, scripts, and assets from the skill directory.

Do not claim validation passed if scripts fail, links are missing, Pi reports a collision, or the skill was not exercised.

### 7. Iterate from real use

When a skill under-triggers, improve the description with intent words and concrete contexts rather than an exhaustive phrase list. When it over-triggers, narrow the scope and add discriminating context. When execution is inconsistent, clarify the decision process or move repeatable fragile work into a tested script.

Keep revisions general enough to work beyond the examples used during development.

## Completion report

Summarize:

- created or changed paths
- chosen scope and why
- resources added
- checks run and their outcomes
- whether `/reload` or a fresh Pi session is needed
