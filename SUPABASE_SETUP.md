# Supabase Setup — Step by Step Guide

## Step 1: Create Free Account

1. Go to **https://supabase.com**
2. Click **"Start your project"** (top right)
3. Sign up with **GitHub** (fastest)
4. Verify email if asked

---

## Step 2: Create New Project

1. Click **"New Project"** button
2. Fill in:
   - **Organization:** Select your org (or create one)
   - **Project name:** `mr-cleaner-demo`
   - **Database password:** Enter a strong password (save this!)
   - **Region:** Choose **US East** (closest to Texas)
3. Click **"Create new project"**
4. Wait 1-2 minutes for setup

---

## Step 3: Get Your Keys

Once project is ready:

1. Go to **Settings** (gear icon, top left)
2. Click **"API"** in the sidebar
3. You'll see two keys:

### Copy These Values:

```
Project URL:    https://xxxxxxxx.supabase.co
anon key:       eyJhbGciOiJIUzI1NiIs...
service_role:   eyJhbGciOiJIUzI1NiIs...
```

**⚠️ NEVER share the `service_role` key publicly!**

---

## Step 4: Add Keys to .env.local

Open `.env.local` and paste:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...your_service_role_key_here
```

Save the file.

---

## Step 5: Create Database Tables

1. In Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase/schema.sql` from the project
4. Copy ALL the contents
5. Paste into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)

### You should see:
```
Success. No rows returned
```

### This creates:
- `bookings` table — stores customer bookings
- `chat_sessions` table — stores conversation history
- `usage_logs` table — stores Maya's tool calls
- `application_config` table — stores Google Calendar tokens
- Unique index — prevents double-booking
- RLS policies — security rules

---

## Step 6: Verify Tables

1. Go to **"Table Editor"** (left sidebar)
2. You should see 4 tables:
   - `application_config`
   - `bookings`
   - `chat_sessions`
   - `usage_logs`
3. Click each table to verify columns exist

---

## Step 7: Test the Connection

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000

3. Chat with Maya — say "Hi, I need my car detailed"

4. Check Supabase dashboard:
   - Go to **Table Editor** → `chat_sessions`
   - You should see a new row with session data

---

## Troubleshooting

### "relation 'bookings' does not exist"
- You didn't run the SQL script
- Go to SQL Editor → Run the schema.sql contents

### "permission denied for table bookings"
- RLS policies are blocking access
- Make sure you're using `supabaseAdmin` in API routes, not `supabase`

### "new row violates row-level security policy"
- The anon key doesn't have INSERT permission
- Check that the RLS policies in schema.sql are correct

### Data not persisting
- Check `.env.local` has the correct Supabase keys
- Check browser console for errors
- Check server console for "CRITICAL: SUPABASE_SERVICE_ROLE_KEY missing"

---

## What Each Table Does

| Table | Purpose | Who Writes |
|-------|---------|------------|
| `bookings` | Customer appointments | API routes (service role) |
| `chat_sessions` | Conversation history + booking data | Chat API (service role) |
| `usage_logs` | Maya's tool calls for debugging | Chat API (service role) |
| `application_config` | Google Calendar OAuth tokens | Calendar API (service role) |

---

## Security Model

| Key | Can Do | Cannot Do |
|-----|--------|-----------|
| **anon** | INSERT bookings, INSERT chat_sessions | SELECT anything, UPDATE anything |
| **service_role** | Everything (bypasses RLS) | Nothing restricted |

---

## Next Steps

After Supabase is set up:
1. Get Gemini API key (free): https://aistudio.google.com/apikey
2. Add to `.env.local`: `GEMINI_API_KEY=your_key_here`
3. Deploy to Vercel (see DEPLOY.md)
