// Real-browser test for accounts + favourites (Chromium). Supabase is STUBBED via request
// interception — config.js is swapped for real-looking values and the Supabase ESM module is
// fulfilled with an in-memory fake — so this runs fully offline and never needs a real project.
// It exercises auth.js's actual code paths against that fake.
//
//   # one-time: npm install playwright && npx playwright install chromium
//   python3 -m http.server 8077 &        # serve the repo
//   node tests/accounts.spec.mjs         # BASE defaults to http://localhost:8077
//
// Asserts: (1) with placeholder config the feature stays hidden + the site is unchanged;
// (2) configured-but-signed-out shows Sign in + hearts, and a heart tap opens the login modal,
// and the magic-link submit flow signs you in; (3) signed-in hearts reflect/toggle saved state,
// the Favourites toggle filters to saved plants, and Sign out tears it all down.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8077';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

// ---- the in-memory fake Supabase client, served in place of the CDN ESM module ----
const FAKE_MODULE = `
export function createClient(url, key, opts){
  let session = (typeof window!=='undefined' && window.__START_SIGNED_IN) ? { user:{ id:'u1', email:'test@example.com' } } : null;
  const seed = (typeof window!=='undefined' && window.__SEED_FAVS) || [];
  const rows = seed.map(s => ({ user_id:'u1', plant_slug:s }));
  const listeners = [];
  const fire = (evt) => listeners.forEach(cb => { try{ cb(evt, session); }catch(e){} });
  function makeQuery(action, payload){
    const conds = [];
    const exec = () => {
      if(action==='select') return { data: rows.map(r => ({ plant_slug:r.plant_slug })), error:null };
      if(action==='upsert'){ if(!rows.some(r => r.plant_slug===payload.plant_slug)) rows.push(payload); return { data:[payload], error:null }; }
      if(action==='delete'){ for(let i=rows.length-1;i>=0;i--){ if(conds.every(([c,v]) => rows[i][c]===v)) rows.splice(i,1); } return { data:[], error:null }; }
      return { data:null, error:null };
    };
    const q = { eq(c,v){ conds.push([c,v]); return q; }, then(res,rej){ return Promise.resolve(exec()).then(res,rej); } };
    return q;
  }
  return {
    auth: {
      getSession: async () => ({ data:{ session }, error:null }),
      onAuthStateChange: (cb) => { listeners.push(cb); return { data:{ subscription:{ unsubscribe(){} } } }; },
      signInWithOtp: async ({ email }) => { window.__lastOtp = email; session = { user:{ id:'u1', email } }; setTimeout(() => fire('SIGNED_IN'), 10); return { data:{}, error:null }; },
      signOut: async () => { session = null; fire('SIGNED_OUT'); return { error:null }; }
    },
    from(){ return { select(){ return makeQuery('select'); }, upsert(o){ return makeQuery('upsert', o); }, delete(){ return makeQuery('delete'); } }; }
  };
}
`;
const CONFIG_JS = `window.SUPABASE_URL="https://stub.supabase.co";window.SUPABASE_ANON_KEY="stub-anon-key";`;

async function configuredContext(browser, { signedIn = false, seed = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(([s, f]) => { window.__START_SIGNED_IN = s; window.__SEED_FAVS = f; }, [signedIn, seed]);
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CONFIG_JS }));
  await ctx.route(u => /supabase-js/.test(u.href || u.toString()), r =>
    r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE_MODULE }));
  return ctx;
}

const browser = await chromium.launch();

// ============ 1) UNCONFIGURED: feature hidden, site unchanged ============
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });
  ok((await page.locator('#account .acct-btn').count()) === 0, 'unconfigured: no Sign in button');
  ok((await page.locator('.fav-btn').count()) === 0, 'unconfigured: no heart buttons on cards');
  ok((await page.locator('#favToggle').isHidden()), 'unconfigured: Favourites toggle hidden');
  ok((await page.locator('.card').count()) > 50, 'unconfigured: the grid still renders all plants');
  ok(errs.length === 0, 'unconfigured: no page errors (' + errs.join('; ') + ')');
  await ctx.close();
}

// ============ 2) CONFIGURED + SIGNED OUT: Sign in + hearts + login flow ============
{
  const ctx = await configuredContext(browser, { signedIn: false });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card .fav-btn', { timeout: 20000 });
  ok(await page.locator('#acctSignin').isVisible(), 'signed out: Sign in button shows');
  ok((await page.locator('.fav-btn').count()) > 50, 'signed out: hearts render on cards');
  ok(await page.locator('#favToggle').isHidden(), 'signed out: Favourites toggle hidden');

  // tapping a heart while signed out opens the sign-in modal
  await page.locator('.fav-btn').first().click();
  await page.waitForSelector('.authbox.open', { timeout: 5000 });
  ok(await page.locator('.authbox.open').isVisible(), 'signed out: heart tap opens the sign-in modal');

  // submit the magic-link form → fake signs us in
  await page.fill('#authEmail', 'test@example.com');
  await page.click('#authSend');
  await page.waitForSelector('.auth-msg.ok', { timeout: 5000 });
  ok(await page.locator('.auth-msg.ok').isVisible(), 'signed out: submitting email shows the "check your inbox" message');
  ok((await page.evaluate(() => window.__lastOtp)) === 'test@example.com', 'signed out: signInWithOtp received the email');
  await page.waitForFunction(() => !!document.querySelector('#acctSignout'), null, { timeout: 5000 });
  ok((await page.locator('.acct-email').textContent()).includes('test@example.com'), 'signed out → in: masthead now shows the account email');
  ok(errs.length === 0, 'signed-out flow: no page errors (' + errs.join('; ') + ')');
  await ctx.close();
}

// ============ 3) SIGNED IN: heart state, toggle persistence, Favourites filter, sign out ============
{
  const SEED = 'trees/chokecherry';
  const ctx = await configuredContext(browser, { signedIn: true, seed: [SEED] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('#acctSignout'), null, { timeout: 20000 });
  ok(await page.locator('#acctSignout').isVisible(), 'signed in: Sign out shows in the masthead');

  const seeded = page.locator('.fav-btn[data-slug="' + SEED + '"]');
  await seeded.first().waitFor({ timeout: 5000 });
  ok(await seeded.first().evaluate(b => b.classList.contains('on')), 'signed in: seeded favourite renders as a filled heart');
  ok(await page.locator('#favToggle').isVisible(), 'signed in: Favourites toggle is shown');
  ok((await page.locator('#favToggle .favn').textContent()).trim() === '1', 'signed in: Favourites count reads 1');

  // toggle a different, not-yet-saved plant on
  const other = page.locator('.fav-btn:not(.on)').first();
  const otherSlug = await other.getAttribute('data-slug');
  await other.click();
  await page.waitForFunction(s => { const b = document.querySelector('.fav-btn[data-slug="' + s + '"]'); return b && b.classList.contains('on'); }, otherSlug, { timeout: 5000 });
  ok(true, 'signed in: tapping an empty heart fills it (saved)');
  await page.waitForFunction(() => document.querySelector('#favToggle .favn').textContent.trim() === '2', null, { timeout: 5000 });
  ok(true, 'signed in: Favourites count rises to 2');

  // turn on the Favourites view → only the 2 saved plants remain
  await page.click('#favToggle');
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 2, null, { timeout: 5000 });
  ok((await page.locator('.card').count()) === 2, 'signed in: Favourites view shows only the saved plants');
  ok((await page.locator('.fav-btn[data-slug="' + SEED + '"]').count()) === 1, 'signed in: the seeded plant is among them');

  // unsave one from within the favourites view → it drops out
  await page.locator('.fav-btn[data-slug="' + SEED + '"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1, null, { timeout: 5000 });
  ok((await page.locator('.card').count()) === 1, 'signed in: unsaving inside the Favourites view removes the card');

  // sign out → toggle hidden, view resets, hearts cleared
  await page.click('#acctSignout');
  await page.waitForFunction(() => !!document.querySelector('#acctSignin'), null, { timeout: 5000 });
  ok(await page.locator('#favToggle').isHidden(), 'sign out: Favourites toggle hidden again');
  ok((await page.locator('.fav-btn.on').count()) === 0, 'sign out: no hearts remain filled');
  ok((await page.locator('.card').count()) > 50, 'sign out: full grid restored');
  ok(errs.length === 0, 'signed-in flow: no page errors (' + errs.join('; ') + ')');
  await ctx.close();
}

await browser.close();
console.log(fails ? `\nFAIL (${fails})` : '\nPASS — accounts & favourites work end-to-end (stubbed backend)');
process.exit(fails ? 1 : 0);
