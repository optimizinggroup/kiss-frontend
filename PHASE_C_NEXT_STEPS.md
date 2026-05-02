# Phase C: Next Steps for Vercel Deployment

**Status**: Frontend scaffolding complete. Ready for GitHub + Vercel deployment.

## What's Been Done

✓ Full React + Vite project structure created in `/Users/keith-macstudio-1/Documents/Claude/Projects/OptimizingGroup/KISS/`
✓ All dependencies configured in `package.json`
✓ Entry points ready: `index.html`, `src/main.jsx`, `src/App.jsx`
✓ React Router set up for three routes: `/`, `/start`, `/:slug`
✓ KissIntakeForm.jsx integrated and ready
✓ Environment variables documented (`.env.example`)
✓ Git repository initialized and first commit created
✓ Vercel configuration file (`vercel.json`) prepared

## Immediate Next Steps (5 minutes each)

### Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `kiss-frontend`
3. Description: "KISS - Keep Insurance Super Simple. Insurance policy intake form with Supabase & Make.com integration."
4. Public (for Vercel integration)
5. Click **Create repository**
6. Copy the HTTPS URL

### Step 2: Push to GitHub
```bash
cd /Users/keith-macstudio-1/Documents/Claude/Projects/OptimizingGroup/KISS
git remote add origin https://github.com/YOUR_USERNAME/kiss-frontend.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Deploy to Vercel
1. Go to https://vercel.com
2. Sign in or create account
3. Click **Add New Project**
4. Search for and select `kiss-frontend` repository
5. Vercel will auto-detect Vite framework
6. Click **Deploy**

### Step 4: Add Environment Variables in Vercel
Once deployment starts, go to **Settings → Environment Variables** in Vercel project:

Add three variables (available in `/Users/keith-macstudio-1/Documents/Claude/Projects/OptimizingGroup/KISS/.env.local`):

```
VITE_SUPABASE_URL=https://diyctwdqmqwemswekyvb.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_-ogMeQXdbd9hhzCPony7uQ_R0CHsM6E
VITE_MAKE_WEBHOOK_URL=https://hook.us2.make.com/pskxsnskes42gsngq7n24u7wih2jir
```

Set each to apply to: **Production**, **Preview**, **Development**

Then redeploy (Vercel will pick up the env vars on next push or manual redeploy).

### Step 5: Configure Domain
1. In Vercel project settings, go to **Domains**
2. Add custom domain: `kiss.optimizinggroup.com`
3. Vercel will show you DNS records to add
4. In GoDaddy:
   - Go to your domain DNS settings
   - Add CNAME or Nameserver records as shown by Vercel
   - (Or use Vercel's nameservers directly — easier)
5. DNS propagation: 5–30 minutes

### Step 6: Test the Form
Once deployed:
1. Visit `https://kiss.optimizinggroup.com`
2. Test the form:
   - Try the branded path with a partner slug (e.g., `/attorney-smith`)
   - Try the generic `/start` path
   - Upload a test PDF (any PDF)
   - Check that Supabase receives the submission
3. Verify webhook fires to Make.com
4. Confirm email is sent from Resend

## File Structure (for reference)

```
KISS/
├── package.json              ← Dependencies & scripts
├── vite.config.js            ← Build config
├── vercel.json               ← Vercel-specific config
├── index.html                ← Entry HTML
├── .env.local                ← Dev secrets (NOT tracked)
├── .gitignore
├── src/
│   ├── main.jsx              ← React Router setup
│   ├── App.jsx               ← Main app component
│   ├── index.css             ← Global styles
│   └── components/
│       └── KissIntakeForm.jsx ← Intake form
├── code/
│   ├── make/blueprint_v2_CLAUDE_SONNET.json
│   ├── supabase/schema.sql
│   └── ...
└── VERCEL_DEPLOYMENT.md      ← Full deployment guide
```

## Verification Checklist

Once live at `kiss.optimizinggroup.com`:

- [ ] Page loads without errors
- [ ] Form fields render correctly
- [ ] PDF file upload accepts `.pdf` files
- [ ] Supabase auth works (anonymous key)
- [ ] Submit button fires webhook to Make
- [ ] Submission row appears in Supabase `submissions` table
- [ ] Report email is received (5-10 min delay)

## Parallel Work: Phase B (Make)

While Phase C deploys, Phase B (Make.com Anthropic setup) can continue independently:
1. Set up Anthropic connection in Make
2. Import Claude blueprint
3. Activate scenario

The frontend will work with both OpenAI and Claude versions — it just fires the webhook.

---

<!-- Test deployment trigger - Phase C Vercel deployment verification -->

**Total time to live**: ~30 minutes (mostly DNS propagation waiting)

For detailed Vercel troubleshooting, see `VERCEL_DEPLOYMENT.md`.
