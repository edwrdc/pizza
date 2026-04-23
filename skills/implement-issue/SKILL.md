---
name: implement-issue
description: Implement a single GitHub issue end-to-end on a dedicated branch. Can auto-pick the highest-priority unblocked issue or work on a specific one. Creates a branch, works through the issue using RGR, commits, and optionally reviews the result.
---

# Implement Issue

Implement a single GitHub issue on a dedicated branch, then optionally review the result.

## When to use

- User says "implement issue #N" or "fix issue #N" (explicit)
- User says "implement next issue" or "work on the next issue" (auto-pick)
- User wants to build a specific feature described in a GitHub issue

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `issue-number` | No | Specific issue to work on. If omitted, auto-pick from open issues. |

## Process

### 1. Determine which issue to work on

#### Explicit mode (issue number provided)

```bash
gh issue view <number> --json number,title,body,comments,labels
```

#### Auto-pick mode (no issue number provided)

```bash
gh issue list --state open --json number,title,body,labels,comments
```

Filter and prioritize:

1. **Filter out blocked issues** — skip any issue whose body contains "Blocked by #N" where N is also open, or has a `blocked` label
2. **Prioritize in this order:**
   1. **Bug fixes** — broken behaviour affecting users
   2. **Tracer bullets** — thin end-to-end slices that prove an approach works
   3. **Polish** — improving existing functionality (error messages, UX, docs)
   4. **Refactors** — internal cleanups with no user-visible change
3. **Pick the highest-priority unblocked issue**

If no unblocked issues exist, report that to the user and stop.

If the picked issue references a parent PRD or design doc, read that too.

### 2. Create a branch

```bash
git checkout -b issue-<number>-<slug>
```

where `<slug>` is a short kebab-case descriptor from the issue title (max 4-5 words).

Example: issue `#42` titled "Fix auth token expiration" → `issue-42-fix-auth-token`

### 3. Explore the codebase

Read relevant source files and tests **before writing any code**. Pay extra attention to test files touching the relevant parts of the codebase. Fill your context window with enough information to complete the task.

### 4. Execute with RGR

Use **Red → Green → Repeat → Refactor**:

1. **RED:** Write a failing test that captures the expected behavior
2. **GREEN:** Write the minimal implementation to pass that test
3. **REPEAT** until the issue is fully resolved
4. **REFACTOR** once everything works — clean up without changing behavior

### 5. Verify before committing

Run the project's type checker and test suite. Fix failures before proceeding. Common commands:
- `npm run typecheck` / `npm run test`
- `go test ./...`
- `cargo test`
- `pytest`

Adapt to whatever the project uses.

### 6. Commit

```bash
git add -A
git commit -m "Fix #<number>: <title>

- <what changed and why>
- <key decisions>

Files: <file1>, <file2>"
```

### 7. Push the branch

```bash
git push -u origin issue-<number>-<slug>
```

### 8. Optionally review

Ask the user: **"Want me to review the branch before merging?"**

If yes, run the review checklist:

#### Review checklist

1. **Diff:** `git diff main...HEAD`
2. **Commits:** `git log main..HEAD --oneline`
3. **Check for:**
   - Unnecessary complexity or nesting
   - Redundant code/abstractions
   - Unclear variable/function names
   - Missing tests for new/changed behavior
   - Unsafe casts, unchecked assumptions, security issues
   - Commented-out code or TODOs left in
4. **Apply fixes** directly on the branch if found
5. **Re-verify** tests still pass after review fixes

### 9. Done

Summarize what was built and the branch name. Then stop. **Do not merge.**

The branch stays pushed to origin until you are ready to batch-merge.

For solo work, the pattern is:

```
Chat 1: implement issue #42 → review → done (branch pushed)
Chat 2: implement issue #43 → review → done (branch pushed)
Chat 3: merge branches issue-42-fix-auth issue-43-add-rate-limiter
```

Only merge after all branches are ready. This keeps main clean and lets you batch-verify everything lands cleanly together.

If you ever need team workflow, use the `open-pr` skill instead.

## Rules

- Work on **only one issue** per session
- Do not close the GitHub issue — leave that to PR merge or user
- Do not leave commented-out code or TODO comments in committed code
- If blocked (missing context, failing tests you cannot fix, external dependency), explain the blocker to the user and stop — do not commit broken code
- Prefer small, focused commits over large ones
- If review finds issues, fix them before declaring done
