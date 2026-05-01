# KISS Frontend - Vercel Deployment Guide

## Phase C: Deploy React Frontend to Vercel

This guide walks through deploying the KISS intake form to Vercel (kiss.optimizinggroup.com).

### Prerequisites

- GitHub account and repo (KISS source code)
- Vercel account (free tier OK for dev/prod)
- Environment variables prepared (see below)

### Step 1: Prepare Environment Variables

Vercel needs three environment variables configured:

```
VITE_SUPABASE_URL=https://diyctwdqmqwemswekyvb.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_-ogMeQXdbd9hhzCPony7uQ_R0CHsM6E
VITE_MAKE_WEBHOOK_URL=https://hook.us2.make.com/pskxsnskes42gsngq7n24u7wih2jir
```

These variables are already in `.env.local` (not tracked, for local dev only).

### Step 2: Push Code to GitHub

```bash
cd /Users/keith-macstudio-1/Documents/Claude/Projects/OptimizingGroup/KISS
git init
git add .
git commit -m "Initial KISS frontend commit"
git branch -M main
git remote add origin https://github.com/YourUsername/kiss-frontend.git
git push -u origin main
```

### Step 3: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Sign in or create account
3. Click **Add New Project**
4. Select your GitHub repo: `kiss-frontend`
5. Configure build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 4: Add Environment Variables in Vercel

1. In the Vercel project settings, go to **Settings → Environment Variables**
2. Add the three variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_MAKE_WEBHOOK_URL`

3. Set **Environments**: select **Production**, **Preview**, **Development**

### Step 5: Configure Domain

1. In Vercel project settings, go to **Domains**
2. Add custom domain: `kiss.optimizinggroup.com`
3. Vercel will provide DNS records
4. In GoDaddy (or your registrar):
   - Add CNAME record pointing to Vercel's domain
   - Or use Vercel nameservers (recommended)

DNS propagation: 5-30 minutes

### Step 6: Verify Deployment

1. Vercel will auto-deploy on every push to `main`
2. Visit your URL to test the form
3. Check that environment variables are loaded:
   - Browser DevTools → Network → XHR requests
   - Verify Supabase calls succeed

### Rollback

If needed, Vercel keeps deployment history:
1. Go to **Deployments** in Vercel dashboard
2. Click the previous working deployment
3. Click **Promote to Production**

### Troubleshooting

**Build Error: `Command "npm run build" exited with 1`**
- Check `npm install` succeeds locally
- Verify all dependencies in package.json
- Check build logs in Vercel dashboard

**Env vars not loading**
- Ensure variable names start with `VITE_` (Vite requirement)
- Redeploy after changing env vars in Vercel Settings
- Check `.env.local` is in `.gitignore`

**Form not submitting**
- Verify Supabase connectivity: check Network tab in DevTools
- Verify Make webhook URL is correct
- Check Supabase RLS policies allow anonymous reads/writes

### Local Development

```bash
npm install
npm run dev
# Server runs on http://localhost:3000
```

### Production Checklist

- [ ] GitHub repo linked to Vercel
- [ ] All 3 environment variables set in Vercel
- [ ] Domain DNS pointed to Vercel
- [ ] Build succeeds (check Vercel Deployments)
- [ ] Form submits successfully
- [ ] Supabase receives submission row
- [ ] Make webhook is triggered
- [ ] Report email is received

---

**Note**: Phase C (frontend) can proceed independently from Phase B (Make scenario). Phase B (Claude integration) will be activated once the Anthropic connection is configured in Make. The frontend will work with both OpenAI and Claude versions of the scenario — it just fires the webhook, Make handles the LLM choice.
