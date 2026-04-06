---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Question format

Use this format for every question:

```
Q1. <question text>
If <condition>, do we:
- A) <option>
- B) <option>
- C) <option>
Recommended: <your recommendation>
Reason: <why>
```

Not all questions need options. Use the format that fits — single-line questions are fine when there are no options to present. Always include your recommendation and reasoning.

## Collecting answers with /answer

After presenting your questions, tell the user: **"Press Ctrl+. to answer these interactively"**

The `/answer` extension (Ctrl+.) will:
1. Extract all your questions, options, recommendations, and reasoning
2. Present them in an interactive TUI with one question at a time
3. Show the full context (options, recommendations) below each question
4. Let the user type answers with Tab/Enter navigation and multi-line support (Shift+Enter)
5. Submit structured answers back as a message

Continue the interview based on their answers. Ask follow-ups in the same format.
