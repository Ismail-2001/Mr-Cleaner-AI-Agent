# Vercel Deployment — Step by Step Guide

## Step 1: Create Vercel Account

1. Go to **https://vercel.com**
2. Click **"Sign Up"**
3. Sign up with **GitHub** (same as Supabase)
4. Authorize Vercel to access your repos

---

## Step 2: Install Vercel CLI

Open terminal and run:

```bash
npm install -g vercel
```

---

## Step 3: Login to Vercel

```bash
vercel login
```

Enter your email when prompted. Check email for verification link.

---

## Step 4: Deploy

From your project folder:

```bash
cd Mobile-Detailing-AI-Agent-main
vercel
```

### You'll be prompted:

```
? Set up and deploy? → Y
? Which scope? → Select your account
? Link to existing project? → N
? Project name? → mr-cleaner
? Directory is empty? → N
? Override settings? → N
```

Wait 1-2 minutes for build.

---

## Step 5: Add Environment Variables

1. Go to **https://vercel.com/dashboard**
2. Click on your **mr-cleaner** project
3. Go to **Settings** tab
4. Click **"Environment Variables"**
5. Add these variables:

### Required (Copy from .env.local):

| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `DASHBOARD_PASSWORD` | A strong password |
| `DASHBOARD_SESSION_SECRET` | Random 32+ char string |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (see Step 6) |

### Optional:

| Name | Value |
|------|-------|
| `GOOGLE_CALENDAR_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | From Google Cloud Console |
| `TWILIO_ACCOUNT_SID` | From Twilio |
| `TWILIO_AUTH_TOKEN` | From Twilio |
| `TWILIO_PHONE_NUMBER` | Your Twilio number |

6. Click **"Save"** for each variable

---

## Step 6: Get Your Live URL

1. Go to your project in Vercel dashboard
2. You'll see a URL like:
   ```
   https://mr-cleaner-xyz.vercel.app
   ```
3. Copy this URL
4. Update `NEXT_PUBLIC_APP_URL` environment variable with this URL
5. Redeploy (see Step 7)

---

## Step 7: Redeploy with Env Vars

```bash
vercel --prod
```

Or click **"Redeploy"** in Vercel dashboard.

---

## Step 8: Verify Deployment

1. Open your Vercel URL
2. Check the landing page loads
3. Click "Book Now" — chat with Maya
4. Go to `/dashboard` — login with your password
5. Check Supabase — bookings should appear

---

## Custom Domain (Optional)

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Enter your domain (e.g., `mrcleaner.com`)
3. Follow DNS instructions from Vercel
4. Wait for SSL certificate (automatic)

---

## Troubleshooting

### "Function has timed out"
- Gemini API is slow
- Check if GEMINI_API_KEY is correct

### "Module not found"
- Dependencies not installed
- Run `npm install` locally, then redeploy

### Dashboard shows "Server configuration error"
- DASHBOARD_PASSWORD or DASHBOARD_SESSION_SECRET not set
- Add them in Vercel environment variables

### Chat returns mock responses
- GEMINI_API_KEY not set
- Check environment variables in Vercel

---

## Auto-Deploy from GitHub

Vercel auto-deploys when you push to GitHub:

```bash
# Make changes locally
git add -A
git commit -m "feat: new feature"
git push origin main
```

Vercel will automatically rebuild and deploy.

---

## Cost

**Vercel Free Tier includes:**
- 100 GB bandwidth/month
- 100 hours of serverless functions
- Automatic SSL
- Custom domains

**For a demo site, free tier is more than enough.**

---

## Summary

| Step | Time | What |
|------|------|------|
| 1 | 2 min | Create Vercel account |
| 2 | 1 min | Install CLI |
| 3 | 1 min | Login |
| 4 | 2 min | Deploy |
| 5 | 5 min | Add env vars |
| 6 | 1 min | Get URL |
| 7 | 2 min | Redeploy |
| 8 | 2 min | Verify |

**Total: ~15 minutes to live**
