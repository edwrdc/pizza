## Repository exploration

Use the `scout` subagent when repository knowledge is needed before making a
decision or change. Choose the cheapest path that provides enough evidence.

- If the relevant file or symbol is known and the question is local, inspect it
  directly.
- If a few shallow searches can locate likely anchors, find them without tracing
  implementation, then launch 1-3 scouts in parallel.
- If the subsystem is broad or unfamiliar and useful questions are unclear,
  first launch one scout in `LOCATE` mode. Use its anchors and suggested
  questions to launch 2-4 scouts in `TRACE` mode.
- Use `deepwiki-research` instead for public repository research that does not
  require the local checkout.

Split work by distinct questions, not directory boundaries. Relevant questions
may cover runtime flow, state and persistence, analogous implementations,
permissions and validation, side effects, or tests. Choose only those needed
for the task. Some file overlap is fine, but do not assign the same question to
multiple scouts.

Give each `TRACE` scout the original goal, exactly one bounded question, known
file or symbol anchors, and important constraints. Launch independent questions
in parallel so each scout opens in its own interactive pane.

Do not ask a scout to understand the whole codebase. Do not delegate when the
main agent already has enough evidence to proceed.
