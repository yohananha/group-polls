# Setup

Everything in this repo is written; the steps below are the account-gated
parts only you can do (creating a Supabase project, a Google OAuth client,
and a Vercel project). Local dev takes about 10 minutes; Vercel deploy adds 5.

## 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → New project. Pick any name/region.
2. Project Settings → API → copy the **Project URL** and **anon public** key.
3. Copy `.env.local.example` to `.env.local` and paste those two values in.

```bash
cp .env.local.example .env.local
```

## 2. Run the migrations

Install the Supabase CLI if you don't have it, then link and push:

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF   # from the Supabase dashboard URL
npx supabase db push                                # runs supabase/migrations/*.sql in order
```

(No CLI? Paste the four files in `supabase/migrations/`, in numeric order, into
the Supabase dashboard's SQL Editor and run each one.)

## 3. Set up Google sign-in

1. In the Supabase dashboard: Authentication → Providers → Google → enable it.
   It shows you a **callback URL** like
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` — copy it.
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create a project (or use one you have).
   - Configure the OAuth consent screen (External is fine for a friend-group app;
     add yourselves as test users if it stays in "Testing" mode).
   - Create an **OAuth client ID** → Application type: **Web application**.
   - Authorized redirect URIs: paste the Supabase callback URL from step 1.
   - Copy the generated **Client ID** and **Client secret**.
3. Back in Supabase's Google provider settings, paste the Client ID and secret,
   then Save.

## 4. Run it locally

```bash
npm install   # if you haven't already
npm run dev
```

Open http://localhost:3000 — you should land on `/login` and be able to sign
in with Google, create a group, and post a poll of each type.

## 5. Deploy to Vercel

```bash
npx vercel
```

When prompted, set the two env vars from `.env.local` in the Vercel project
(Project Settings → Environment Variables), or run:

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Then add your Vercel URL as an **additional** redirect URI everywhere the
localhost one is registered:

- Supabase → Authentication → URL Configuration → Redirect URLs: add
  `https://your-app.vercel.app/auth/callback`.
- Google Cloud Console's OAuth client → Authorized redirect URIs already only
  needs the *Supabase* callback URL from step 3 — nothing to add there per
  environment, since Google only ever redirects back to Supabase.

Redeploy (`npx vercel --prod`) once the env vars are set.

## Everyday use

- **Create a group** from the home page; you become its owner automatically.
- **Invite people** with the "Copy invite link" button on the group page —
  it's `/join/<code>`, and anyone signed in who opens it can join with one click.
- **Post a poll**: pick a type (single choice, multi-select, ranking, or
  head-to-head bracket), add options, flip whichever settings you want
  (let others add options, hide results until you vote, etc.), and post.
- Bracket polls need at least 4 options — voters get shown pairs one at a
  time rather than a ballot.

## If something's off

- **"relation does not exist" errors** → the migrations haven't run; redo step 2.
- **Google sign-in redirects to an error page** → the redirect URI in Google
  Cloud Console doesn't exactly match the Supabase callback URL from step 3
  (trailing slash, http vs https, wrong project ref are the usual culprits).
- **Signed in but bounced back to `/login`** → check both env vars in
  `.env.local` (or Vercel) are the *anon* key, not the service-role key.
