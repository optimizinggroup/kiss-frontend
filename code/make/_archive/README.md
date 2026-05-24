# Archived blueprints — DO NOT USE

The single source of truth is **`code/make/blueprint_v2_MASTER.json`** (Claude 3.5 Sonnet).

These files are kept only for rollback/history:

- `blueprint_v2_OPENAI.deprecated.json` — old GPT-4o scenario (renamed from blueprint_v2.json). Superseded when we moved to Sonnet.
- `blueprint_v2_PREPARED.json` — early OpenAI prep blueprint.
- `blueprint_v2_CLAUDE_SONNET.json` — first Sonnet attempt (May 1); wrong Make module slugs, superseded by the MASTER.
- `blueprint_v2.pre-2026-05-01.json.bak` — pre-router backup.
- `_rewrite_blueprint.py.deprecated` — generator that built the OpenAI blueprint from the .txt prompt files. The live Sonnet scenario does NOT use the .txt files; its prompts are inline in the MASTER.
