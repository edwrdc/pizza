---
name: review-branch
description: Review code changes on a git branch against main/master for clarity, consistency, correctness, and maintainability. Auto-detects the current branch if none is specified. Use when the user says "review this branch" or "review branch X".
---

# Review Branch

Review code changes on a branch and improve clarity, consistency, and maintainability while preserving exact functionality.

## When to use

- User says "review this branch" or "review the current branch"
- User says "review branch X" — explicit branch name
- User wants a pre-merge code review
- User wants to clean up a branch before opening a PR

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | No | Branch name to review. Defaults to the currently checked-out branch. |

## Process

### 1. Detect the branch

If no branch argument is provided:

```bash
git branch --show-current
```

If the current branch is `main` or `master`, warn the user and stop — you cannot review main against itself.

### 2. Gather context

```bash
git fetch origin
git diff main...<branch>
git log main..<branch> --oneline
```

If available, also read any `CODING_STANDARDS.md` or similar project standards file.

### 3. Understand the change

Read the diff and commits to understand the intent. Check if there is a linked issue or PR description that provides additional context.

### 4. Analyze for improvements

Look for opportunities to:
- Reduce unnecessary complexity and nesting
- Eliminate redundant code and abstractions
- Improve readability through clear variable and function names
- Consolidate related logic
- Remove unnecessary comments that describe obvious code
- Avoid nested ternary operators — prefer switch statements or if/else chains
- Choose clarity over brevity — explicit code is often better than overly compact code

### 5. Check correctness

- Does the implementation match the intent? Are edge cases handled?
- Are new/changed behaviours covered by tests?
- Are there unsafe casts, `any` types, or unchecked assumptions?
- Does the change introduce injection vulnerabilities, credential leaks, or other security issues?
- Are there off-by-one errors, race conditions, or resource leaks?

### 6. Maintain balance

Avoid over-simplification that could:
- Reduce code clarity or maintainability
- Create overly clever solutions that are hard to understand
- Combine too many concerns into single functions or components
- Remove helpful abstractions that improve code organization
- Make the code harder to debug or extend

### 7. Apply project standards

Follow any coding standards defined in the repo (e.g. `CODING_STANDARDS.md`, `CONTRIBUTING.md`, linter configs).

### 8. Preserve functionality

Never change what the code does — only how it does it. All original features, outputs, and behaviors must remain intact.

### 9. Execute improvements

If you find improvements to make:
1. Make the changes directly on the branch
2. Run tests and type checking to ensure nothing is broken
3. Commit with a clear message describing the refinements (e.g. `Review: simplify error handling, rename variables for clarity`)

If the code is already clean and well-structured, tell the user and do nothing.

## Output

Present the review as a structured summary:

1. **Branch reviewed** — name and base comparison (`main...<branch>`)
2. **What the change does** (1-2 sentences)
3. **Issues found** (if any) — categorized as correctness, clarity, style, or testing
4. **Changes made** (if any) — list of edits with rationale
5. **Verdict** — approve, approve with minor notes, or needs rework
