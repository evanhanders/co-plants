/* nav.js — the shared hamburger side-drawer navigation, loaded on every page after auth.js.

   It's gated on accounts being configured: with placeholder config there's no drawer at all, so
   the guide is unchanged until accounts are switched on. A floating button (bottom-right) opens an
   off-canvas drawer (from the right) holding the site nav (Home · Favourites · Privacy) plus an
   account block — a `#account` container that auth.js renders into (Sign in link, or the signed-in
   email + Sign out). Sign-in and Favourites are full pages (signin.html / favorites.html). */
(function(){
'use strict';
if(!(window.Account && window.Account.configured)) return; // accounts off → no drawer

var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
function active(file){ return here===file ? ' aria-current="page"' : ''; }
var LINKS = [['index.html','Home'], ['favorites.html','Favourites'], ['privacy.html','Privacy']];

var burger=document.createElement('button');
burger.type='button'; burger.className='navburger'; burger.id='navburger';
burger.setAttribute('aria-label','Open menu'); burger.setAttribute('aria-expanded','false'); burger.setAttribute('aria-controls','navdrawer');
burger.innerHTML='<span></span><span></span><span></span>';

var back=document.createElement('div'); back.className='navback'; back.id='navback';

var drawer=document.createElement('nav'); drawer.className='navdrawer'; drawer.id='navdrawer';
drawer.setAttribute('aria-label','Site menu'); drawer.setAttribute('aria-hidden','true');
drawer.innerHTML=
  '<div class="navhead"><span class="navtitle">The Front Range Herbarium</span>'+
  '<button type="button" class="navclose" id="navclose" aria-label="Close menu">×</button></div>'+
  '<div class="navlinks">'+LINKS.map(function(l){ return '<a class="navlink" href="'+l[0]+'"'+active(l[0])+'>'+l[1]+'</a>'; }).join('')+'</div>'+
  '<div class="navacct"><div id="account"></div></div>';

document.body.appendChild(burger);
document.body.appendChild(back);
document.body.appendChild(drawer);

var lastFocus=null;
function open(){ lastFocus=document.activeElement; document.body.classList.add('nav-open'); drawer.setAttribute('aria-hidden','false'); burger.setAttribute('aria-expanded','true'); setTimeout(function(){ var f=drawer.querySelector('a,button'); if(f) f.focus(); },30); }
function close(){ document.body.classList.remove('nav-open'); drawer.setAttribute('aria-hidden','true'); burger.setAttribute('aria-expanded','false'); if(lastFocus&&lastFocus.focus){ try{ lastFocus.focus(); }catch(e){} } }
burger.onclick=function(){ document.body.classList.contains('nav-open') ? close() : open(); };
document.getElementById('navclose').onclick=close;
back.onclick=close;
document.addEventListener('keydown', function(e){ if(e.key==='Escape' && document.body.classList.contains('nav-open')) close(); });
drawer.addEventListener('click', function(e){ if(e.target.closest('.navlink')) close(); }); // tidy up on navigate
/* basic Tab focus-trap while open (same idea as the lightbox) */
drawer.addEventListener('keydown', function(e){
  if(e.key!=='Tab') return;
  var f=Array.prototype.slice.call(drawer.querySelectorAll('a[href],button')).filter(function(el){ return el.offsetParent!==null; });
  if(!f.length) return; var first=f[0], last=f[f.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});
})();
