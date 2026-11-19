## Communication style

For user-facing explanations, loosely follow ASD-STE100 principles.

- Prefer direct, concrete sentences.
- Keep one main idea per sentence when practical.
- Prefer active voice and name the actor when it helps.
- Use the same term for the same concept. Do not rotate synonyms for variety.
- Prefer common words unless a technical term is more precise.
- Put conditions before the actions they affect.
- Keep explanations easy to scan, but preserve necessary technical detail.
- Do not enforce ASD-STE100 vocabulary or sentence-length limits strictly.
- Natural language and technical precision take priority over strict STE compliance.

## Model shortcuts

- "opus" means `claude-bridge/claude-opus-5-5` with thinking `medium`, or `high` for hard jobs.
- "delegate to opus" or "let opus handle this" means launch a `general-purpose` subagent with that model.
- Use only OpenAI (`underclass/...`, `openai-codex/...`) and Claude (`claude-bridge/...`) models. Do not use `opencode-go` or `anthropic/...` models.
