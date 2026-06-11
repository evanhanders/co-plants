/* auth.js — user accounts + favourites, shared by the encyclopedia grid (index.html /
   app.js) and the standalone detail page (plant.html / plant.js).

   Sign-in is passwordless "magic link" email via Supabase Auth; a signed-in user's
   favourited plants live in a Supabase `favorites` table (one row per saved plant,
   protected by Row-Level Security so each person sees only their own). See
   SETUP_ACCOUNTS.md for the one-time Supabase setup + the SQL.

   Design: this file is the ONLY place that talks to Supabase. It exposes a small,
   backend-agnostic `window.Account` API (ready/isSignedIn/isFavorite/toggleFavorite/
   onChange/favButtonHTML/…); app.js and plant.js only call that API, so swapping or
   extending the backend later never touches the page code. Loaded after config.js +
   reel.js, BEFORE app.js / plant.js.

   When config.js still holds the placeholders, `window.Account` is a no-op stub and
   no account UI renders — the Supabase library isn't even fetched — so the guide is
   byte-for-byte unchanged until you finish the Supabase setup. */
(function(){
'use strict';

var URL_ = window.SUPABASE_URL, KEY_ = window.SUPABASE_ANON_KEY;
var configured = !!(URL_ && KEY_ &&
  URL_.indexOf('YOUR_') !== 0 && KEY_.indexOf('YOUR_') !== 0 && /^https?:\/\//.test(URL_));

/* a filled-on-toggle heart; CSS fills it when the button carries .on */
var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3l-1.45-1.32C5.4 14.24 2 11.16 2 7.5 2 4.92 4.02 3 6.5 3c1.74 0 3.41.9 4.5 2.3C12.09 3.9 13.76 3 15.5 3 17.98 3 20 4.92 20 7.5c0 3.66-3.4 6.74-8.55 11.49L12 20.3z"/></svg>';
function E(s){ return window.esc ? window.esc(s) : String(s==null?'':s); }

/* ---------- not configured yet → harmless stub, account UI stays hidden ---------- */
if(!configured){
  var noop=function(){}, no=function(){return false;};
  window.Account = {
    configured:false,
    ready:function(){ return Promise.resolve(); },
    isSignedIn:no, user:function(){ return null; }, isFavorite:no, count:function(){ return 0; },
    toggleFavorite:noop, signIn:function(){ return Promise.resolve({ error:{ message:'Accounts are not configured.' } }); },
    signOut:noop, openLogin:noop, onChange:function(){ return noop; },
    favButtonHTML:function(){ return ''; }, syncButtons:noop, deleteAllData:function(){ return Promise.resolve(); }
  };
  if(window.console && console.info){
    console.info('[accounts] Not configured — set SUPABASE_URL + SUPABASE_ANON_KEY in config.js to enable sign-in & favourites (see SETUP_ACCOUNTS.md). The guide runs normally without them.');
  }
  return;
}

/* ---------- configured: live state ---------- */
var supa=null, user=null, favSet=new Set(), listeners=[];
var readyResolve, readyP=new Promise(function(r){ readyResolve=r; });

/* one notification = refresh the masthead menu + every heart on the page + tell subscribers */
function emit(){ renderMenu(); syncButtons(); listeners.forEach(function(cb){ try{ cb(); }catch(e){} }); }

/* ---------- favourites ---------- */
function isFav(slug){ return !!slug && favSet.has(slug); }
async function loadFavorites(){
  favSet=new Set();
  if(!user || !supa) return;
  try{
    var res=await supa.from('favorites').select('plant_slug');
    if(res.error) throw res.error;
    (res.data||[]).forEach(function(r){ favSet.add(r.plant_slug); });
  }catch(e){ console.warn('[accounts] could not load favourites:', e.message||e); }
}
async function toggleFavorite(slug){
  if(!slug) return;
  if(!user){ openLogin(); return; }            // saving requires an account
  var add = !favSet.has(slug);
  if(add) favSet.add(slug); else favSet.delete(slug);
  emit();                                        // optimistic — UI updates immediately
  try{
    var r = add
      ? await supa.from('favorites').upsert({ user_id:user.id, plant_slug:slug }, { onConflict:'user_id,plant_slug' })
      : await supa.from('favorites').delete().eq('user_id', user.id).eq('plant_slug', slug);
    if(r.error) throw r.error;
  }catch(e){
    console.warn('[accounts] favourite sync failed:', e.message||e);
    if(add) favSet.delete(slug); else favSet.add(slug);   // roll back the optimistic change
    emit();
    authMsg('Couldn’t save that just now — check your connection and try again.', false);
  }
}
async function deleteAllData(){
  if(!user || !supa) return;
  try{ var r=await supa.from('favorites').delete().eq('user_id', user.id); if(r.error) throw r.error; }
  catch(e){ console.warn('[accounts] could not delete favourites:', e.message||e); }
  favSet=new Set();
  await signOut();
}

/* ---------- auth ---------- */
async function signInWithEmail(email){
  return supa.auth.signInWithOtp({ email:email, options:{ emailRedirectTo:new URL('index.html', location.href).href } });
}
async function signOut(){ try{ await supa.auth.signOut(); }catch(e){} user=null; favSet=new Set(); emit(); }

/* ---------- account block (rendered into #account, which lives inside the nav drawer) ---------- */
function renderMenu(){
  var host=document.getElementById('account'); if(!host) return;
  if(user){
    host.innerHTML='<div class="acct-info"><span class="acct-who">Signed in as</span>'+
      '<span class="acct-email" title="'+E(user.email)+'">'+E(user.email)+'</span>'+
      '<button type="button" class="acct-btn ghost" id="acctSignout">Sign out</button></div>';
    var so=document.getElementById('acctSignout'); if(so) so.onclick=function(){ signOut(); };
  } else {
    host.innerHTML='<a class="acct-btn" id="acctSignin" href="signin.html">Sign in</a>';
  }
}

/* Sign-in is its own page (signin.html / signin.js, which calls Account.signIn). openLogin() just
   routes there — used when a signed-out visitor taps a heart. */
function openLogin(){ location.href='signin.html'; }

/* ---------- heart buttons (rendered into cards by app.js and the sheet by plant.js) ---------- */
function favButtonHTML(slug, labeled){
  if(!slug) return '';
  var on=favSet.has(slug);
  return '<button type="button" class="fav-btn'+(on?' on':'')+(labeled?' labeled':'')+'" data-slug="'+E(slug)+'" '+
    'aria-pressed="'+(on?'true':'false')+'" aria-label="'+(on?'Remove from favourites':'Save to favourites')+'" '+
    'title="'+(on?'Remove from favourites':'Save to favourites')+'">'+HEART+(labeled?'<span class="favlbl">'+(on?'Saved':'Save')+'</span>':'')+'</button>';
}
function syncButtons(){
  Array.prototype.forEach.call(document.querySelectorAll('.fav-btn'), function(b){
    var on=favSet.has(b.dataset.slug);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on?'true':'false');
    b.setAttribute('aria-label', on?'Remove from favourites':'Save to favourites');
    b.title=on?'Remove from favourites':'Save to favourites';
    var l=b.querySelector('.favlbl'); if(l) l.textContent=on?'Saved':'Save';
  });
}
/* one delegated handler covers every heart — grid cards, family carousels, the detail sheet */
document.addEventListener('click', function(e){
  var b=e.target&&e.target.closest?e.target.closest('.fav-btn'):null; if(!b) return;
  e.preventDefault(); e.stopPropagation(); toggleFavorite(b.dataset.slug);
});

/* ---------- public API ---------- */
window.Account = {
  configured:true,
  ready:function(){ return readyP; },
  isSignedIn:function(){ return !!user; },
  user:function(){ return user; },
  isFavorite:isFav,
  count:function(){ return favSet.size; },
  toggleFavorite:toggleFavorite,
  signIn:function(email){ return readyP.then(function(){ return signInWithEmail(email); }); },
  signOut:signOut,
  openLogin:openLogin,
  onChange:function(cb){ listeners.push(cb); return function(){ var i=listeners.indexOf(cb); if(i>-1) listeners.splice(i,1); }; },
  favButtonHTML:favButtonHTML,
  syncButtons:syncButtons,
  deleteAllData:deleteAllData
};

/* ---------- boot: lazily load the Supabase client (only when configured) + open the session.
   Loaded as an ESM module straight from the CDN — no build step, no local dependency. If a
   magic-link redirect lands here with auth tokens in the URL, detectSessionInUrl consumes and
   cleans them; app.js waits on Account.ready() before it first writes the URL hash, so its
   filter-state hash never clobbers an in-flight auth token. ---------- */
import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(async function(mod){
  supa=mod.createClient(URL_, KEY_, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  supa.auth.onAuthStateChange(function(_evt, session){
    user = session ? session.user : null;
    if(user){ loadFavorites().then(emit); } else { favSet=new Set(); emit(); }
  });
  try{
    var s=await supa.auth.getSession();
    user = (s.data && s.data.session) ? s.data.session.user : null;
    if(user) await loadFavorites();
  }catch(e){ console.warn('[accounts] init failed:', e.message||e); }
  emit();
  readyResolve();
}).catch(function(e){
  console.warn('[accounts] could not load the Supabase library (CDN unreachable?):', (e&&e.message)||e);
  renderMenu();      // still show the (non-functional) menu rather than nothing
  readyResolve();    // never hang the page waiting on auth
});
})();
