---
name: plan-issues
description: Analyze open GitHub issues, build a dependency graph, and identify which issues can be worked in parallel. Use when the user wants to plan a sprint, batch of work, or understand blockers in the backlog.
---

# Plan Issues

Analyze open GitHub issues and produce a dependency-aware execution plan.

## When to use

- User says "plan the next sprint" or "which issues can we do in parallel?"
- User wants to batch work for multiple agents
- User wants to understand blockers in the backlog

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `label` | No | Filter to issues with this label (e.g. `ready`) |

## Process

### 1. Fetch open issues

```bash
gh issue list --state open --json number,title,body,labels,comments
```

If a label filter is provided, add `--label <label>`.

### 2. Build dependency graph

For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:
- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has **zero blocking dependencies** on other open issues.

If an issue appears to be a PRD and has implementation issues linking to it, the PRD itself cannot be worked on directly.

### 3. Assign branches

For each unblocked issue, suggest a branch name:
```
issue-<number>-<slug>
```
where `<slug>` is a short kebab-case descriptor derived from the title.

### 4. Output the plan

Present the plan as a structured summary:

```
## Dependency Graph

| Issue | Title | Blocked by | Blocks |
|-------|-------|------------|--------|
| #42   | Fix auth bug | — | #44, #45 |
| #43   | Add rate limiter | — | — |
| #44   | Update API docs | #42 | — |

## Parallelizable Batch (unblocked issues)

| Issue | Branch | Title |
|-------|--------|-------|
| #42   | issue-42-fix-auth-token | Fix auth bug |
| #43   | issue-43-add-rate-limiter | Add rate limiter |

## Blocked (wait for batch above)

| Issue | Blocked by | Title |
|-------|------------|-------|
| #44   | #42 | Update API docs |
```

If every issue is blocked, include the single highest-priority candidate (fewest/weakest dependencies) so work can still start.

## Rules

- Be conservative about parallelism — if two issues touch the same module, assume they conflict
- Consider not just code dependencies but also **decision dependencies** (API shape, schema design)
- If an issue body is vague, note it as "needs clarification" rather than guessing
- Suggest the plan but let the user approve before any work starts
