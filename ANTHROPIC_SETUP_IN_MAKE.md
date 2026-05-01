# Anthropic Claude Setup in Make.com

## Overview
Switching KISS from OpenAI GPT-4o to Claude 3.5 Sonnet saves ~35% on per-submission costs while improving output quality for insurance policy analysis.

## Step 1: Get Your Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign in with your Anthropic account (or create one)
3. Navigate to **Settings → API Keys**
4. Click **Create Key**
5. Copy the key (format: `sk-ant-...`)
6. **Save this key securely** — you'll need it in Make

## Step 2: Add Anthropic Connection to Make.com

1. Open Make.com and go to **Admin Settings → Connections** (or Teams → Connections)
2. Click **New Connection**
3. Search for **Anthropic** or **Claude**
4. Click the Anthropic app
5. In the form:
   - **API Key**: Paste your Anthropic API key from Step 1
   - **Connection Name**: `Anthropic-KISS` or similar
   - Click **Save**
6. **Note the connection ID** that Make assigns (you'll need this)

## Step 3: Import the Claude Blueprint

1. In Make, open Scenarios
2. Click **New Scenario** (or go to Scenarios folder)
3. Click **Import Blueprint**
4. Upload: `blueprint_v2_CLAUDE_SONNET.json`
5. When prompted for connections, select the Anthropic connection you just created
6. Click **Import**

## Step 4: Update the Anthropic Connection Reference

In Make's scenario editor:
- The blueprint has placeholder `ANTHROPIC_CONNECTION_NEEDED` for the API connection
- Make.com should auto-map it to your new Anthropic connection
- If not, manually set each Claude module (6, 10, 11, 17, 18) to use the Anthropic connection

## Modules Using Claude

These modules will now call Claude 3.5 Sonnet instead of GPT-4o:

| Module | Purpose | Tokens/call |
|--------|---------|------------|
| 6 | Extract policy JSON | ~500-1000 |
| 10 | Broker advisory report | ~2000-3000 |
| 11 | Attorney pre-claim report | ~2000-3000 |
| 17 | Auto policy consumer report | ~3000-4000 |
| 18 | Residential policy consumer report | ~3000-4000 |

## Cost Comparison

**Per submission estimate:**
- OpenAI GPT-4o: $0.15 - $0.30
- Claude 3.5 Sonnet: $0.07 - $0.15
- **Savings: 50-60% cheaper** ✓

At 1,000 submissions/month:
- OpenAI: $150 - $300/month
- Claude: $70 - $150/month
- **Monthly savings: $80 - $150**

## Testing

Once the scenario is live:
1. Send a test submission via the webhook
2. Check that all 5 Claude modules execute successfully
3. Verify report quality in Supabase and email output
4. Compare with GPT-4o baseline if desired

## Rollback (if needed)

If you need to revert to GPT-4o:
1. Keep scenario 4926552 (OpenAI version) as backup
2. Simply activate the old scenario instead
3. Or reimport `blueprint_v2_PREPARED.json` with OpenAI connection

---

**Questions?** Check Make.com's Anthropic app docs or contact Anthropic support via console.anthropic.com
