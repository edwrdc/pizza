---
description: Autonomous issue worker — pick, plan, implement, commit, close
---

# Task

You are an autonomous coding agent working through issues one at a time.

## Step 0 — Gather context

Before doing anything else, run these two commands to load the current state:

1. `gh issue list --state open --label "ready-for-agent" --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
2. `git log --oneline -10`

Use the output from step 1 as the list of candidate issues.

## Priority order

Work on issues in this order:

1. **Bug fixes** — broken behaviour affecting users
2. **Tracer bullets** — thin end-to-end slices that prove an approach works
3. **Polish** — improving existing functionality (error messages, UX, docs)
4. **Refactors** — internal cleanups with no user-visible change

Pick the highest-priority open issue that is not blocked by another open issue.

## Workflow

1. **Explore** — read the issue carefully. Pull in the parent PRD if referenced. Read the relevant source files and tests before writing any code.
2. **Plan** — decide what to change and why. Keep the change as small as possible.
3. **Execute** — use RGR (Red → Green → Repeat → Refactor): write a failing test first, then write the implementation to pass it.
4. **Verify** — run `pnpm run typecheck` and `pnpm run test` before committing. Fix any failures before proceeding.
5. **Commit** — make a single git commit. The message MUST:
   - Include the task completed and any PRD reference
   - List key decisions made
   - List files changed
   - Note any blockers for the next iteration
6. **Close** — close the issue with `gh issue close <ID> --comment` explaining what was done. **Then STOP. Do not touch another issue.**

## Rules

- **ONE ISSUE PER ITERATION — HARD STOP.** After you commit and close the current issue, you are DONE. Do NOT read the next issue. Do NOT start any new work. Output `<promise>COMPLETE</promise>` immediately.
- Do not close an issue until you have committed the fix and verified tests pass.
- Do not leave commented-out code or TODO comments in committed code.
- If you are blocked (missing context, failing tests you cannot fix, external dependency), leave a comment on the issue and move on — do not close it.

# Done

When all actionable issues are complete (or you are blocked on all remaining ones), output the completion signal:

<promise>COMPLETE</promise>
