/* config.js — back-end configuration for the accounts + favourites feature.

   These two values come from your Supabase project (Dashboard → Project Settings →
   API). Paste them in, commit, and the "Sign in" button + heart toggles light up.

   ⚠ BOTH ARE SAFE TO COMMIT. The anon key is a *public, publishable* key — it is
   meant to ship in front-end code. Your data is protected by Row-Level Security
   rules in the database (see SETUP_ACCOUNTS.md), NOT by hiding this key. Never put
   the Supabase *service_role* / *secret* key here — that one is a real secret.

   Until you replace the placeholders below, every account feature stays hidden and
   the guide behaves exactly as it did before — nothing else on the site changes. */

window.SUPABASE_URL      = "YOUR_SUPABASE_URL";       // e.g. https://abcd1234.supabase.co
window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";  // the "anon" / "publishable" key
