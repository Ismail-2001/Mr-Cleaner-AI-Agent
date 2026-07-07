# Gemini API Key Setup — Free Tier

## Step 1: Get Your Free API Key

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select a project (or create new one)
5. Copy the API key (starts with `AIza...`)

**That's it! Free tier includes:**
- 15 requests per minute
- 1 million tokens per day
- No credit card required

---

## Step 2: Add to .env.local

```ini
GEMINI_API_KEY=AIzaSy...your_key_here
```

---

## Step 3: Add to Vercel

1. Go to Vercel dashboard
2. Project → Settings → Environment Variables
3. Add `GEMINI_API_KEY` with your key
4. Redeploy

---

## Gemini Models

The app uses `gemini-2.0-flash` by default (fastest, cheapest).

Other options you can change in `app/api/chat/route.js`:
- `gemini-2.0-flash` — Fast, good for chat (recommended)
- `gemini-1.5-pro` — More capable, slower
- `gemini-1.5-flash` — Balanced speed/capability

---

## Pricing

| Tier | Requests | Tokens | Cost |
|------|----------|--------|------|
| Free | 15/min | 1M/day | $0 |
| Pay-as-you-go | Unlimited | Unlimited | ~$0.01/conversation |

**For a demo, free tier is perfect.**
