# Make.com Scenario Blueprint

The full validated blueprint of scenario 4581471 is saved alongside this file as
`scenario-blueprint.json`. That file is what you'd see if you exported the scenario via
Make's "Export Blueprint" feature.

## Quick reference

- **Scenario ID:** 4581471
- **Scenario name:** KISS Insurance Policy Review - Core Pipeline
- **Folder ID in Make:** 224737
- **Hook ID (webhook trigger):** 2088742
- **Hook name:** GHL-Policy-Upload-Incoming
- **Webhook URL:** https://hook.us2.make.com/6tvcwb2d2b7nuimiewpfe6rw1g11u97y
- **Status:** Active, never executed (0 runs as of 2026-04-30)
- **Last edited:** 2026-04-08

## Connections referenced

| Connection ID | What it is | Used by modules |
|---|---|---|
| `6008119` | OpenAI API (used by all 4 GPT-4o calls) | 5, 7, 9, 11, 15, 17 |
| `7992256` | Gmail (sends report emails) | 13, 14, 18 |

Both connections are already configured in your Make account — no further setup needed
on the connection side. If you ever rotate keys, update them in Make's Connections panel
and the modules will pick up the new credentials automatically.

## Module count

18 modules total across:
- 1 webhook trigger
- 1 Set Variables (locks vars before the router fork)
- 1 HTTP GET (downloads the policy PDF)
- 1 Router (3 routes)
- 6 OpenAI calls (2 per route: extraction + report)
- 3 ParseJSON modules
- 2 HTTP POST callbacks (Broker, Attorney — to GHL inbound webhook)
- 3 Gmail send modules

## Route summary

| Route | Filter | Modules | Output |
|---|---|---|---|
| 1 (Broker) | `tenant_persona = broker` | 5, 6, 7, 8, 13 | POST to GHL webhook + email |
| 2 (Attorney) | `tenant_persona = attorney` | 9, 10, 11, 12, 14 | POST to GHL webhook + email |
| 3 (Consumer, Phase 1) | `tenant_persona = consumer` | 15, 16, 17, 18 | Email only (no GHL POST — direct-to-consumer) |

## Important architectural decisions baked in

1. **Set Variables before the router** so all branches reliably reference `{{2.fieldname}}`
   instead of `{{1.fieldname}}` — Make's router can lose webhook variable scope inside
   nested routes.
2. **HTTP GET with parseResponse=false and requestCompressedContent=false** — needs raw
   PDF bytes for the OpenAI call, not a parsed object.
3. **Two-temperature pattern**: extraction at 0.1 (deterministic), report at 0.2–0.3
   (slightly creative for natural language).
4. **Output schema is `output[].content[].text`** — this is OpenAI's Responses API format,
   not the older Chat Completions `choices[].message.content`. The blueprint uses the
   correct path everywhere.

## Inconsistency to clean up

The Attorney route's extraction prompt (module 9) has a different JSON schema than Broker
and Consumer — `policy_type` is shaped as an array there but a string elsewhere. This is
likely a bug/leftover from iteration. See `prompts/01-extraction-prompt.txt` for details.
