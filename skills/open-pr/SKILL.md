---
name: open-pr
description: Open a GitHub pull request from the current branch to main/master. Use after implementing and reviewing an issue branch.
---

# Open PR

Open a GitHub pull request for the current branch.

## When to use

- User says "open a PR" or "create PR"
- User wants to land a reviewed branch via pull request
- Called as the next step after `implement-issue` + `review-branch`

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | No | Branch to open PR from. Defaults to current branch. |
| `title` | No | PR title. Defaults to the first commit message line. |
| `body` | No | PR body. Defaults to auto-generated from commits + issue reference. |
| `draft` | No | Open as draft PR. Default: false. |

## Process

### 1. Detect branch

If not provided:

```bash
git branch --show-current
```

### 2. Gather PR content

**Title** — if not provided, use the first commit message line:

```bash
git log main..HEAD --oneline --reverse | head -1
```

**Body** — auto-generate from commits and linked issue:

```bash
git log main..HEAD --format="- %s"
```

If the branch name contains an issue number (`issue-42-*`), reference it:

```
Closes #42

## Changes

- commit message 1
- commit message 2
```

### 3. Push branch

```bash
git push -u origin <branch>
```

### 4. Open PR

```bash
gh pr create \
  --base main \
  --head <branch> \
  --title "<title>" \
  --body "<body>" \
  ${draft:+--draft}
```

### 5. Done

Share the PR URL with the user.

## Rules

- Never open a PR from `main` or `master`
- If the branch has no commits ahead of main, warn and stop
- If a PR already exists for this branch, share the existing URL instead

## Output

- PR URL
- Branch name
- Title and body preview
