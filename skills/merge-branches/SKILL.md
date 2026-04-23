---
name: merge-branches
description: Merge multiple feature branches into main/master, resolving conflicts and running verification. Use when the user has one or more completed issue branches ready to merge.
---

# Merge Branches

Merge completed feature branches into main/master, resolving conflicts and verifying everything still works.

## When to use

- User says "merge branches X Y Z" or "merge my issue branches"
- User wants to land completed work into main/master
- User wants to batch-merge multiple branches after parallel work

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `branches` | **Yes** | Space-separated branch names to merge (e.g. `issue-42-fix-auth issue-43-add-rate-limiter`) |

## When to run this

Run `merge-branches` in a **fresh chat** after all your issue branches are implemented and reviewed. Do not merge immediately after implementing a single issue — batch them at the end.

## Process

### 1. Check current state

```bash
git fetch origin
git checkout main && git pull origin main
```

### 2. Merge each branch

For each branch, in the order provided:

```bash
git merge <branch> --no-edit
```

If merge conflicts occur:
1. Read both sides of the conflict
2. Choose the correct resolution based on intent
3. Mark resolved: `git add <file>`
4. Complete merge: `git commit --no-edit`

### 3. Verify after each merge

After each branch is merged:
- Run type checker and tests
- Fix any failures before proceeding to the next branch

Common commands:
- `npm run typecheck` / `npm run test`
- `go test ./...`
- `cargo test`
- `pytest`

### 4. Final commit

If multiple branches were merged and the default merge message is insufficient, make a single summary commit on top:

```bash
git commit --amend -m "Merge: <branch1>, <branch2>, <branch3>

- <brief summary of changes>"
```

### 5. Push

```bash
git push origin main
```

### 6. Close issues (optional)

For each merged branch, close its corresponding GitHub issue. If closing the issue completes a parent PRD, close that too.

```bash
gh issue close <number> --comment "Closed by merge of <branch> into main."
```

Ask the user: **"Want me to close the issues for these branches?"**

## Rules

- Merge in dependency order if branches depend on each other
- If a branch has conflicts that cannot be resolved safely, stop and ask the user
- Never push broken code — all tests must pass before `git push origin main`
- If tests fail after a merge, fix them on the merge commit before proceeding
- When in doubt about a conflict resolution, ask the user rather than guessing

## Output

Present a summary:

1. **Branches merged** — list with merge status (clean / conflict resolved)
2. **Verification** — test/typecheck results
3. **Push status** — pushed to origin/main or held locally
4. **Issues closed** — which issues were closed (if any)
