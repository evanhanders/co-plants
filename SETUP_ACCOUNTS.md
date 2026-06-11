# Accounts & favourites — Supabase setup

This is the one-time, click-by-click setup that turns on sign-in and favourites. It takes
~15 minutes and is **your** part (creating the account on the hosting service). Once it's done,
paste two values into `config.js`, push, and the feature goes live.

Nothing here changes how the rest of the site is built — it's still plain files on GitHub Pages.
The only addition is that, when you're signed in, the page talks to Supabase to read/write your
favourites.

---

## 1. Create a Supabase project

1. Go to **https://supabase.com**, sign up (the free tier is plenty), and click **New project**.
2. Give it a name (e.g. `co-plants`), set a database password (save it somewhere; you won't need
   it for the site), pick the region closest to you, and create it. It takes a minute to spin up.

## 2. Create the favourites table + security rules

In the project, open **SQL Editor → New query**, paste this in, and click **Run**:

```sql
-- One row per (user, saved plant). The plant_slug is the guide's path, e.g. 'trees/chokecherry'.
create table if not exists public.favorites (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  plant_slug text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, plant_slug)
);

-- Turn on Row-Level Security so the table is private by default...
alter table public.favorites enable row level security;

-- ...then allow each signed-in user to see and change ONLY their own rows.
create policy "read own favourites"   on public.favorites for select using (auth.uid() = user_id);
create policy "add own favourites"    on public.favorites for insert with check (auth.uid() = user_id);
create policy "remove own favourites" on public.favorites for delete using (auth.uid() = user_id);
```

That's the entire database. (Sign-in itself needs no table — Supabase manages users for you.)

## 3. Turn on magic-link email + set the redirect URLs

1. **Authentication → Providers → Email**: make sure **Email** is enabled. Leave "Confirm email"
   on. You don't need a password provider.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://evanhanders.github.io/co-plants/`
   - **Redirect URLs**: add `https://evanhanders.github.io/co-plants/index.html`
     (and, if you want to test from your computer, also `http://localhost:8000/index.html`).
   These are the only pages Supabase will send the sign-in link back to.

> Email note: Supabase's built-in email sender is rate-limited (a handful of messages per hour) —
> fine for you and a few users. If the guide ever gets popular, plug in a real email provider
> under **Authentication → Emails → SMTP** (SendGrid, Resend, etc.).

## 4. Copy your two values into `config.js`

In Supabase, open **Project Settings → API**. Copy:

- **Project URL** → paste as `SUPABASE_URL`
- **Project API keys → `anon` / `public`** → paste as `SUPABASE_ANON_KEY`

Then edit `config.js` in this repo:

```js
window.SUPABASE_URL      = "https://abcd1234.supabase.co";   // your Project URL
window.SUPABASE_ANON_KEY = "eyJhbGciOi...";                  // your anon / public key
```

**Both are safe to commit.** The `anon` key is a public, publishable key — the security comes from
the Row-Level Security rules in step 2, not from hiding it. ⚠️ Never paste the **`service_role`**
(secret) key here.

## 5. Ship it

```
git add config.js && git commit -m "Configure Supabase for accounts" && git push
```

Merge to `main` as usual; GitHub Pages redeploys. Visit the site: a **Sign in** button appears in
the top corner and a **♥** appears on every plant. Enter your email, click the link in your inbox
(open it on the same device/browser), and your favourites now sync everywhere you sign in.

---

## How it behaves before you finish

Until `config.js` holds real values, `auth.js` does nothing — no Sign-in button, no hearts, and
the Supabase library isn't even fetched. The guide is exactly as it was. So it's safe to have this
code live before you've set up the project.

## Troubleshooting

- **"Sign in" button doesn't appear:** `config.js` still has the `YOUR_...` placeholders, or the
  URL doesn't start with `https://`.
- **Link email never arrives:** check spam; confirm the address under **Authentication → Users**;
  you may have hit the built-in email rate limit (wait an hour or add SMTP).
- **Clicking the link doesn't sign me in:** the redirect URL (step 3) must exactly match the page
  the link returns to, and you must open the link in the **same browser** you requested it from.
- **Favourites don't save (console shows a row-level-security error):** re-run the policies in
  step 2.
