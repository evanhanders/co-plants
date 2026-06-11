// Real-browser test for accounts + favourites (Chromium). Supabase is STUBBED via request
// interception — config.js is swapped for real-looking values and the Supabase ESM module is
// fulfilled with an in-memory fake — so this runs fully offline and never needs a real project.
//
//   # one-time: npm install playwright && npx playwright install chromium
//   python3 -m http.server 8077 &        # serve the repo
//   node tests/accounts.spec.mjs         # BASE defaults to http://localhost:8077
//
// Covers: (1) placeholder config → no hamburger / no hearts (site unchanged); (2) the nav drawer
// with Home/Favourites/Privacy + a Sign-in link; (3) the sign-in PAGE (magic-link submit + the
// already-signed-in state); (4) the favourites PAGE (signed-out prompt, signed-in cards, live
// unfavourite); (5) grid hearts reflect saved state; (6) Sign out from the drawer.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8077';
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

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
      // realistic: sending a magic link does NOT sign you in — you must click the emailed link
      signInWithOtp: async ({ email }) => { window.__lastOtp = email; return { data:{}, error:null }; },
      signOut: async () => { session = null; fire('SIGNED_OUT'); return { error:null }; }
    },
    from(){ return { select(){ return makeQuery('select'); }, upsert(o){ return makeQuery('upsert', o); }, delete(){ return makeQuery('delete'); } }; }
  };
}
`;
const CONFIG_JS = `window.SUPABASE_URL="https://stub.supabase.co";window.SUPABASE_ANON_KEY="sb_publishable_stub";`;

async function ctxConfigured(browser, { signedIn = false, seed = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addInitScript(([s, f]) => { window.__START_SIGNED_IN = s; window.__SEED_FAVS = f; }, [signedIn, seed]);
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CONFIG_JS }));
  await ctx.route(u => /supabase-js/.test(u.href || u.toString()), r =>
    r.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE_MODULE }));
  return ctx;
}
const errsOf = (page) => { const e = []; page.on('pageerror', x => e.push(String(x))); return e; };

const browser = await chromium.launch();

// ============ 1) UNCONFIGURED: no drawer, no hearts, site unchanged ============
// (config.js is shipped with REAL values now, so route it back to placeholders to simulate off)
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.SUPABASE_URL="YOUR_SUPABASE_URL";window.SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY";' }));
  const page = await ctx.newPage(); const errs = errsOf(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card', { timeout: 20000 });
  await page.waitForTimeout(500);
  ok((await page.locator('#navburger').count()) === 0, 'unconfigured: no hamburger button');
  ok((await page.locator('.fav-btn').count()) === 0, 'unconfigured: no heart buttons');
  ok((await page.locator('.card').count()) > 50, 'unconfigured: grid still renders');
  ok(errs.length === 0, 'unconfigured: no page errors (' + errs.join('; ') + ')');
  await ctx.close();
}

// ============ 2) DRAWER (signed out): nav links + Sign-in link, hearts on cards ============
// (the drawer slides off-screen via transform, so open/closed is the nav-open class / aria-hidden,
//  not isHidden() — Playwright treats a translated element as still "visible")
{
  const ctx = await ctxConfigured(browser, { signedIn: false });
  const page = await ctx.newPage(); const errs = errsOf(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.card .fav-btn', { timeout: 20000 });
  ok((await page.locator('.fav-btn').count()) > 50, 'configured: hearts render on cards');
  ok((await page.evaluate(() => document.body.classList.contains('nav-open'))) === false, 'drawer starts closed');
  ok((await page.locator('#navdrawer').getAttribute('aria-hidden')) === 'true', 'closed drawer is aria-hidden');
  await page.click('#navburger');
  await page.waitForTimeout(350);
  ok((await page.evaluate(() => document.body.classList.contains('nav-open'))) === true, 'hamburger opens the drawer');
  ok((await page.locator('#navdrawer').getAttribute('aria-hidden')) === 'false', 'open drawer is not aria-hidden');
  ok((await page.locator('.navlink', { hasText: 'Favourites' }).getAttribute('href')) === 'favorites.html', 'drawer has a Favourites link → favorites.html');
  await page.waitForFunction(() => !!document.querySelector('#acctSignin'), null, { timeout: 5000 });
  ok((await page.locator('#acctSignin').getAttribute('href')) === 'signin.html', 'drawer Sign-in link → signin.html');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => document.body.classList.contains('nav-open'))) === false, 'Escape closes the drawer');
  ok(errs.length === 0, 'drawer: no page errors (' + errs.join('; ') + ')');
  await ctx.close();
}

// ============ 3) SIGN-IN PAGE ============
{
  // signed out → magic-link form works
  let ctx = await ctxConfigured(browser, { signedIn: false });
  let page = await ctx.newPage(); const errs = errsOf(page);
  await page.goto(BASE + '/signin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#signinForm', { timeout: 20000 });
  ok(await page.locator('#signinForm').isVisible(), 'signin page: form shows when signed out');
  await page.fill('#signinEmail', 'test@example.com');
  await page.click('#signinSend');
  await page.waitForSelector('.auth-msg.ok', { timeout: 5000 });
  ok(await page.locator('.auth-msg.ok').isVisible(), 'signin page: submit shows the "check your inbox" message');
  ok((await page.evaluate(() => window.__lastOtp)) === 'test@example.com', 'signin page: signInWithOtp got the email');
  ok(errs.length === 0, 'signin page (out): no errors (' + errs.join('; ') + ')');
  await ctx.close();

  // already signed in → shows the signed-in panel + sign out works
  ctx = await ctxConfigured(browser, { signedIn: true });
  page = await ctx.newPage();
  await page.goto(BASE + '/signin.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('signedInState'); return e && !e.hidden; }, null, { timeout: 20000 });
  ok((await page.locator('#signedInState').textContent()).includes('test@example.com'), 'signin page: signed-in panel shows the email');
  ok(await page.locator('#signinForm').isHidden(), 'signin page: form hidden when already signed in');
  await page.click('#signinOut');
  await page.waitForSelector('#signinForm:not([hidden])', { timeout: 5000 });
  ok(await page.locator('#signinForm').isVisible(), 'signin page: signing out brings the form back');
  await ctx.close();
}

// ============ 4) FAVOURITES PAGE ============
{
  // signed out → prompt, no cards
  let ctx = await ctxConfigured(browser, { signedIn: false });
  let page = await ctx.newPage();
  await page.goto(BASE + '/favorites.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /sign in/i.test(document.getElementById('favState')?.textContent || ''), null, { timeout: 20000 });
  ok((await page.locator('#favGrid .card').count()) === 0, 'favourites (signed out): no cards, just a prompt');
  ok((await page.locator('#favState a[href="signin.html"]').count()) === 1, 'favourites (signed out): prompt links to sign-in');
  await ctx.close();

  // signed in with one seeded favourite → it renders; unfavouriting removes it live
  ctx = await ctxConfigured(browser, { signedIn: true, seed: ['trees/chokecherry'] });
  page = await ctx.newPage(); const errs = errsOf(page);
  await page.goto(BASE + '/favorites.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#favGrid .card', { timeout: 20000 });
  ok((await page.locator('#favGrid .card').count()) === 1, 'favourites (signed in): the one saved plant renders');
  ok((await page.locator('.fav-btn[data-slug="trees/chokecherry"].on').count()) === 1, 'favourites: its heart is filled');
  await page.locator('.fav-btn[data-slug="trees/chokecherry"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#favGrid .card').length === 0, null, { timeout: 5000 });
  ok((await page.locator('#favGrid .card').count()) === 0, 'favourites: unfavouriting removes the card live');
  ok(/No saved plants/i.test(await page.locator('#favState').textContent()), 'favourites: empty prompt appears after removing the last one');
  ok(errs.length === 0, 'favourites page: no errors (' + errs.join('; ') + ')');
  await ctx.close();
}

// ============ 5) GRID HEARTS + 6) SIGN OUT FROM DRAWER ============
{
  const ctx = await ctxConfigured(browser, { signedIn: true, seed: ['trees/chokecherry'] });
  const page = await ctx.newPage(); const errs = errsOf(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.fav-btn[data-slug="trees/chokecherry"]', { timeout: 20000 });
  ok(await page.locator('.fav-btn[data-slug="trees/chokecherry"]').first().evaluate(b => b.classList.contains('on')), 'grid: seeded favourite shows a filled heart');

  await page.click('#navburger');
  await page.waitForFunction(() => !!document.querySelector('#acctSignout'), null, { timeout: 5000 });
  ok((await page.locator('.acct-email').textContent()).includes('test@example.com'), 'drawer: shows the signed-in email');
  await page.click('#acctSignout');
  await page.waitForFunction(() => !!document.querySelector('#acctSignin'), null, { timeout: 5000 });
  ok((await page.locator('#acctSignin').count()) === 1, 'drawer: Sign out returns the Sign-in link');
  ok((await page.locator('.fav-btn.on').count()) === 0, 'sign out: hearts no longer filled');
  ok(errs.length === 0, 'grid/sign-out: no errors (' + errs.join('; ') + ')');
  await ctx.close();
}

await browser.close();
console.log(fails ? `\nFAIL (${fails})` : '\nPASS — accounts (drawer + sign-in page + favourites page) work end-to-end (stubbed backend)');
process.exit(fails ? 1 : 0);
