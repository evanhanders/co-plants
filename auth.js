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
    toggleFavorite:noop, signOut:noop, openLogin:noop, onChange:function(){ return noop; },
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

/* ---------- masthead account control (#account) ---------- */
function renderMenu(){
  var host=document.getElementById('account'); if(!host) return;
  if(user){
    host.innerHTML='<div class="acct-info"><span class="acct-email" title="'+E(user.email)+'">'+E(user.email)+'</span>'+
      '<button type="button" class="acct-btn ghost" id="acctSignout">Sign out</button></div>';
    var so=document.getElementById('acctSignout'); if(so) so.onclick=function(){ signOut(); };
  } else {
    host.innerHTML='<button type="button" class="acct-btn" id="acctSignin">Sign in</button>';
    var si=document.getElementById('acctSignin'); if(si) si.onclick=function(){ openLogin(); };
  }
}

/* ---------- magic-link sign-in modal ---------- */
var box=null, lastFocus=null;
function buildModal(){
  if(box) return box;
  box=document.createElement('div'); box.className='authbox'; box.id='authbox';
  box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
  box.setAttribute('aria-hidden','true'); box.setAttribute('aria-label','Sign in');
  box.innerHTML='<div class="auth-panel">'+
    '<button type="button" class="auth-close" aria-label="Close">×</button>'+
    '<h2>Sign in or create an account</h2>'+
    '<p>Save your favourite plants so they follow you to any device. Enter your email and we’ll send a one-time sign-in link — no password to remember. New here? The same link creates your account.</p>'+
    '<form id="authForm" novalidate><label for="authEmail">Email address</label>'+
    '<input id="authEmail" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com">'+
    '<button type="submit" class="btn" id="authSend">Send me a sign-in link</button></form>'+
    '<p class="auth-msg" id="authMsg" hidden></p>'+
    '<p class="auth-fine">We only use your email to sign you in and to save your favourites. See our <a href="privacy.html">privacy policy</a>.</p>'+
    '</div>';
  document.body.appendChild(box);
  box.addEventListener('click', function(e){ if(e.target===box) closeLogin(); });
  box.querySelector('.auth-close').onclick=closeLogin;
  box.querySelector('#authForm').addEventListener('submit', onSubmit);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && box.classList.contains('open')) closeLogin(); });
  return box;
}
function authMsg(text, ok){ var m=box&&box.querySelector('#authMsg'); if(!m) return; m.hidden=false; m.textContent=text; m.className='auth-msg '+(ok?'ok':'err'); }
async function onSubmit(e){
  e.preventDefault();
  var input=box.querySelector('#authEmail'), btn=box.querySelector('#authSend');
  var email=(input.value||'').trim();
  if(!email || email.indexOf('@')<1){ authMsg('Please enter a valid email address.', false); input.focus(); return; }
  btn.disabled=true; btn.textContent='Sending…';
  try{
    var r=await signInWithEmail(email);
    if(r.error) throw r.error;
    authMsg('Check your inbox — we sent a sign-in link to '+email+'. Open it on this device to finish signing in. (It may land in spam.)', true);
  }catch(err){
    authMsg(err.message||'Something went wrong sending the link. Please try again in a moment.', false);
  }finally{ btn.disabled=false; btn.textContent='Send me a sign-in link'; }
}
function openLogin(){ buildModal(); lastFocus=document.activeElement; box.classList.add('open'); box.setAttribute('aria-hidden','false'); var m=box.querySelector('#authMsg'); if(m) m.hidden=true; setTimeout(function(){ var i=box.querySelector('#authEmail'); if(i) i.focus(); },30); }
function closeLogin(){ if(!box) return; box.classList.remove('open'); box.setAttribute('aria-hidden','true'); if(lastFocus&&lastFocus.focus){ try{ lastFocus.focus(); }catch(e){} } }

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
