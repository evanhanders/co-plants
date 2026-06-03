/* app.js — the encyclopedia grid: load, render cards, filter/search, the add modal.
   The photo reel + lightbox engine and trait helpers live in reel.js (loaded first);
   the per-plant detail view is its own standalone page (plant.html / plant.js). */
let SEED = []; // populated at load by loadSeed() from plants/<cat>/<slug>/plant.json
const STORAGE_KEY = "plantarium_user_plants_v2";
/* Plants are grouped by MORPHOLOGY (growth form); herbaceous "forbs" are split by their
   primary bloom season. Lifecycle (perennial/annual/biennial/tender) is a TAG, not a group. */
const GROUP_ORDER = ["Trees","Shrubs","Subshrubs","Ornamental grasses","Groundcovers","Vines","Spring forbs","Summer forbs","Fall forbs","Other"];
function groupOf(p){
const t = p && p.type;
const wf = {Tree:"Trees",Shrub:"Shrubs",Subshrub:"Subshrubs",Grass:"Ornamental grasses",Vine:"Vines",Groundcover:"Groundcovers"}[t];
if(wf) return wf;
if(t==="Forb") return (p.bloom_season||"Summer")+" forbs";
return "Other";
}
/* one-line plain-language gloss shown under each section header (what the form means) */
const GROUP_DESC = {
"Trees":"Woody plants with one or a few main trunks, generally taller than ~15 ft.",
"Shrubs":"Woody plants that branch from the base and keep their stems through winter, usually under ~15 ft.",
"Subshrubs":"Woody at the base but with softer top growth that dies back — half-shrub, half-perennial.",
"Ornamental grasses":"Grasses and grass-like plants grown for their foliage and seed heads, not flowers.",
"Groundcovers":"Low, spreading or mat-forming plants that knit together to carpet the ground.",
"Vines":"Climbing or trailing plants that need a support to grow upward.",
"Spring forbs":"Herbaceous (non-woody) flowering plants whose main show is in spring.",
"Summer forbs":"Herbaceous (non-woody) flowering plants whose main show is in summer.",
"Fall forbs":"Herbaceous (non-woody) flowering plants whose main show is in fall.",
"Other":"Plants that don't fall into the forms above."
};
/* ---------- state ---------- */
let userPlants = [];
let view = "type";
const collapsed = new Set(); // group names collapsed (type view)
let natFilter = "all";            // all | native | intro
const typeFilter = new Set();     // empty = all groups shown
const traitFilter = new Set();    // empty = no trait constraint; values: winter|pollin|spreads|toxic
const lifeFilter = new Set();     // empty = all lifecycles; values: Perennial|Annual|Biennial|Tender perennial
/* isNative + the TRAITS predicate map live in reel.js (shared with the detail page) */
function passesFilters(p){
if(natFilter==='native' && !isNative(p)) return false;
if(natFilter==='intro' && isNative(p)) return false;
if(typeFilter.size && !typeFilter.has(groupOf(p))) return false;
if(lifeFilter.size && !lifeFilter.has(p.lifecycle)) return false;
for(const t of traitFilter){ if(!TRAITS[t] || !TRAITS[t].test(p)) return false; }
return true; /* add more filter dimensions here as the guide grows */
}
const content=document.getElementById('content');
const searchEl=document.getElementById('search');
const hasArtifactStore = (typeof window!=="undefined" && window.storage && typeof window.storage.get==="function");
async function loadUser(){
try{
if(hasArtifactStore){ const r = await window.storage.get(STORAGE_KEY, false); if(r && r.value) userPlants = JSON.parse(r.value); }
else { const v = localStorage.getItem(STORAGE_KEY); if(v) userPlants = JSON.parse(v); }
}catch(e){ userPlants = []; }
}
async function saveUser(){
try{
if(hasArtifactStore){ await window.storage.set(STORAGE_KEY, JSON.stringify(userPlants), false); }
else { localStorage.setItem(STORAGE_KEY, JSON.stringify(userPlants)); }
}catch(e){}
}
function isUser(p){ const key=p.botanical.toLowerCase().trim(); return userPlants.some(function(u){return u.botanical.toLowerCase().trim()===key;}) && !SEED.some(function(s){return s.botanical.toLowerCase().trim()===key;}); }
function allPlants(){ const map=new Map(); SEED.concat(userPlants).forEach(function(p){ map.set(p.botanical.toLowerCase().trim(), p); }); return Array.from(map.values()).sort(function(a,b){ return a.botanical.localeCompare(b.botanical,'en',{sensitivity:'base'}); }); }
/* a plant's detail page lives at plant.html?p=<category>/<slug>; only seeded plants
   (which carry a repo dir) have one — user-added localStorage plants don't */
function slugOf(p){ return p.dir ? p.dir.replace(/^plants\//,'') : null; }
function detailHref(p){ var s=slugOf(p); return s ? 'plant.html?p='+encodeURIComponent(s).replace(/%2F/g,'/') : null; }
function cardHTML(p){
const plate = plateHTML(p);
const nat = natBadge(p, 'nat');
const href = detailHref(p);
const name = href ? '<a class="namelink" href="'+href+'">'+p.common+'</a>' : p.common;
return '<article class="card"><div class="plate">'+plate+'<span class="corner">'+(p.type||'')+'</span>'+nat+'</div>'+
'<div class="body"><h3 class="name">'+name+'</h3><p class="latin">'+p.botanical+'</p>'+
'<p class="blurb">'+(p.blurb||'')+'</p><dl class="facts">'+
'<dt>Size</dt><dd>'+(p.size||'—')+'</dd><dt>Sun</dt><dd>'+(p.sun||'—')+'</dd>'+
'<dt>Water</dt><dd>'+(p.water||'—')+'</dd><dt>Habit</dt><dd>'+(p.spread||'—')+'</dd>'+
'<dt>Seasons</dt><dd>'+(p.seasons||'—')+'</dd><dt>Wildlife</dt><dd>'+(p.wildlife||'—')+'</dd>'+
'<dt>Deer</dt><dd>'+(p.deer||'—')+'</dd>'+(p.toxic?'<dt>Caution</dt><dd>'+p.toxic+'</dd>':'')+
'</dl><div class="flags">'+flagsHTML(p)+'</div>'+
'<div class="verified">Verified non-weed in CO · '+(p.verified||'date n/a')+'</div>'+
(href?'<a class="detaillink" href="'+href+'">Grow &amp; care details →</a>':'')+
(isUser(p)?'<button class="del" data-bot="'+p.botanical+'">remove</button>':'')+'</div></article>';
}
function gridOf(list){ return '<div class="grid">'+list.map(cardHTML).join('')+'</div>'; }
function render(){
const q=(searchEl.value||'').toLowerCase().trim();
const total=allPlants().length;
const list=allPlants().filter(function(p){
if(!passesFilters(p)) return false;
if(!q) return true;
return [p.common,p.botanical,p.type,p.lifecycle,p.bloom_season,p.native,p.blurb,p.seasons,p.wildlife,p.spread].join(' ').toLowerCase().indexOf(q)>-1;
});
document.getElementById('count').textContent = total;
const filtering = q || natFilter!=='all' || typeFilter.size>0 || traitFilter.size>0 || lifeFilter.size>0;
const showingEl=document.getElementById('showing');
if(showingEl) showingEl.textContent = filtering ? ('Showing '+list.length+' of '+total+' specimens') : ('Showing all '+total+' specimens');
const clearEl=document.getElementById('clearFilters'); if(clearEl) clearEl.hidden = !filtering;
syncHash();
if(!list.length){ const why = q ? 'matches “'+searchEl.value+'”' : 'fits the current filters'; content.innerHTML='<div class="grid"><div class="empty">No specimen '+why+'.</div></div>'; return; }
if(view==="alpha"){
content.innerHTML = gridOf(list);
} else {
const buckets={};
list.forEach(function(p){ const g=groupOf(p); (buckets[g]=buckets[g]||[]).push(p); });
let html="";
GROUP_ORDER.forEach(function(g){
if(!buckets[g]) return;
const isC = !q && collapsed.has(g);
html += '<section class="grp'+(isC?' collapsed':'')+'" data-group="'+g+'">'
+ '<div class="group-head" data-g="'+g+'"><button class="chev" data-g="'+g+'" aria-expanded="'+(isC?'false':'true')+'" aria-label="'+(isC?'Expand ':'Collapse ')+g+'">▾</button><h2>'+g+'</h2><span class="gc">'+buckets[g].length+'</span><span class="rule"></span></div>'
+ (GROUP_DESC[g]?'<p class="group-desc">'+GROUP_DESC[g]+'</p>':'')
+ gridOf(buckets[g]) + '</section>';
});
content.innerHTML = html;
Array.prototype.forEach.call(content.querySelectorAll('.group-head'), function(h){
h.onclick=function(){ if(q) return; /* during search everything is force-expanded */ const g=h.dataset.g; const nowC = !collapsed.has(g); if(nowC) collapsed.add(g); else collapsed.delete(g); h.parentElement.classList.toggle('collapsed', nowC); const chev=h.querySelector('.chev'); if(chev){ chev.setAttribute('aria-expanded', nowC?'false':'true'); chev.setAttribute('aria-label', (nowC?'Expand ':'Collapse ')+g); } };
});
}
Array.prototype.forEach.call(content.querySelectorAll('.del'), function(b){ b.onclick=function(){ removePlant(b.dataset.bot); }; });
wireReels(content);
}
async function removePlant(bot){ userPlants = userPlants.filter(function(u){return u.botanical!==bot;}); await saveUser(); buildTypeChips(); buildTraitChips(); buildLifeChips(); render(); }
/* ---------- view toggle ---------- */
Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function(btn){
btn.onclick=function(){ view=btn.dataset.view; Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function(b){ b.classList.toggle('active', b===btn); }); render(); };
});
/* ---------- filters: origin (native) + type chips ---------- */
Array.prototype.forEach.call(document.querySelectorAll('#natSeg button'), function(btn){
btn.onclick=function(){ natFilter=btn.dataset.nat; Array.prototype.forEach.call(document.querySelectorAll('#natSeg button'), function(b){ b.classList.toggle('active', b===btn); }); render(); };
});
function syncTypeChips(){
const wrap=document.getElementById('typeChips'); if(!wrap) return;
Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function(c){
if(c.dataset.all!=null) c.classList.toggle('active', typeFilter.size===0);
else c.classList.toggle('active', typeFilter.has(c.dataset.group));
});
}
function buildTypeChips(){
const wrap=document.getElementById('typeChips'); if(!wrap) return;
const all=allPlants(), counts={};
all.forEach(function(p){ var g=groupOf(p); counts[g]=(counts[g]||0)+1; });
let html='<button class="chip" data-all="1">All</button>';
GROUP_ORDER.forEach(function(g){ if(counts[g]) html+='<button class="chip" data-group="'+g+'">'+g+' <span class="gc">'+counts[g]+'</span></button>'; });
wrap.innerHTML=html;
Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function(c){
c.onclick=function(){
if(c.dataset.all!=null){ typeFilter.clear(); }
else { var g=c.dataset.group; if(typeFilter.has(g)) typeFilter.delete(g); else typeFilter.add(g); }
syncTypeChips(); render();
};
});
syncTypeChips();
}
function syncTraitChips(){
const wrap=document.getElementById('traitChips'); if(!wrap) return;
Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function(c){ c.classList.toggle('active', traitFilter.has(c.dataset.trait)); });
}
function buildTraitChips(){
const wrap=document.getElementById('traitChips'); if(!wrap) return;
const all=allPlants();
let html='';
Object.keys(TRAITS).forEach(function(k){
var n=all.filter(TRAITS[k].test).length; if(!n) return;
html+='<button class="chip trait" data-trait="'+k+'"><span class="ic">'+TRAITS[k].icon+'</span>'+TRAITS[k].label+' <span class="gc">'+n+'</span></button>';
});
wrap.innerHTML=html;
Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function(c){
c.onclick=function(){ var t=c.dataset.trait; if(traitFilter.has(t)) traitFilter.delete(t); else traitFilter.add(t); syncTraitChips(); render(); };
});
syncTraitChips();
}
function syncLifeChips(){
const wrap=document.getElementById('lifeChips'); if(!wrap) return;
Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function(c){ c.classList.toggle('active', lifeFilter.has(c.dataset.life)); });
}
function buildLifeChips(){
const wrap=document.getElementById('lifeChips'); if(!wrap) return;
const all=allPlants(), counts={};
all.forEach(function(p){ if(p.lifecycle) counts[p.lifecycle]=(counts[p.lifecycle]||0)+1; });
let html='';
["Perennial","Tender perennial","Biennial","Annual"].forEach(function(k){ if(counts[k]) html+='<button class="chip" data-life="'+k+'">'+k+' <span class="gc">'+counts[k]+'</span></button>'; });
wrap.innerHTML=html;
Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function(c){
c.onclick=function(){ var k=c.dataset.life; if(lifeFilter.has(k)) lifeFilter.delete(k); else lifeFilter.add(k); syncLifeChips(); render(); };
});
syncLifeChips();
}
/* clear everything: search + origin + type + traits + lifecycle */
function clearAllFilters(){
searchEl.value=''; natFilter='all'; typeFilter.clear(); traitFilter.clear(); lifeFilter.clear();
Array.prototype.forEach.call(document.querySelectorAll('#natSeg button'), function(b){ b.classList.toggle('active', b.dataset.nat==='all'); });
syncTypeChips(); syncTraitChips(); syncLifeChips(); render();
}
{ const cf=document.getElementById('clearFilters'); if(cf) cf.onclick=clearAllFilters; }
/* ---------- shareable URL state (hash) ---------- */
function syncHash(){
const parts=[];
if(view!=='type') parts.push('view='+view);
if(natFilter!=='all') parts.push('nat='+natFilter);
if(typeFilter.size) parts.push('type='+encodeURIComponent(Array.from(typeFilter).join(',')));
if(traitFilter.size) parts.push('trait='+Array.from(traitFilter).join(','));
if(lifeFilter.size) parts.push('life='+encodeURIComponent(Array.from(lifeFilter).join(',')));
const q=(searchEl.value||'').trim(); if(q) parts.push('q='+encodeURIComponent(q));
const h=parts.length?('#'+parts.join('&')):'';
if(h!==location.hash){ try{ history.replaceState(null,'',location.pathname+location.search+h); }catch(e){} }
}
function applyHash(){
const h=(location.hash||'').replace(/^#/,''); if(!h) return;
h.split('&').forEach(function(kv){
const i=kv.indexOf('='); if(i<0) return; const k=kv.slice(0,i), v=decodeURIComponent(kv.slice(i+1));
if(k==='view' && (v==='alpha'||v==='type')) view=v;
else if(k==='nat' && /^(all|native|intro)$/.test(v)) natFilter=v;
else if(k==='type'){ typeFilter.clear(); v.split(',').forEach(function(g){ if(g) typeFilter.add(g); }); }
else if(k==='trait'){ traitFilter.clear(); v.split(',').forEach(function(t){ if(TRAITS[t]) traitFilter.add(t); }); }
else if(k==='life'){ lifeFilter.clear(); v.split(',').forEach(function(x){ if(x) lifeFilter.add(x); }); }
else if(k==='q'){ searchEl.value=v; }
});
Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function(b){ b.classList.toggle('active', b.dataset.view===view); });
Array.prototype.forEach.call(document.querySelectorAll('#natSeg button'), function(b){ b.classList.toggle('active', b.dataset.nat===natFilter); });
}
/* ---------- add modal ---------- */
const scrim=document.getElementById('scrim');
const G=function(id){return document.getElementById(id);};
let modalLastTrigger=null;
function openModal(){ G('err').textContent=''; modalLastTrigger=document.activeElement; scrim.classList.add('open'); document.body.style.overflow='hidden'; setTimeout(function(){ G('f_common').focus(); },0); }
function closeModal(){ scrim.classList.remove('open'); document.body.style.overflow=''; if(modalLastTrigger && modalLastTrigger.focus){ modalLastTrigger.focus(); } }
G('addBtn').onclick=openModal;
G('cancelBtn').onclick=closeModal;
scrim.onclick=function(e){ if(e.target===scrim) closeModal(); };
document.addEventListener('keydown', function(e){ if(e.key==='Escape' && scrim.classList.contains('open')) closeModal(); });
G('saveBtn').onclick=async function(){
const common=G('f_common').value.trim(), botanical=G('f_botanical').value.trim();
if(!common||!botanical){ G('err').textContent='Please give both a common and botanical name.'; return; }
if(!G('f_weed').checked){ G('err').textContent='Please confirm the weed check — no weeds get in without it.'; return; }
const key=botanical.toLowerCase().trim();
if(SEED.some(function(s){return s.botanical.toLowerCase().trim()===key;})){ G('err').textContent='That botanical name is already in the guide.'; return; }
const ltype=G('f_type').value;
const p={ common:common, botanical:botanical, type:ltype,
lifecycle:(G('f_lifecycle')&&G('f_lifecycle').value)||'Perennial',
bloom_season: ltype==='Forb' ? ((G('f_bloom')&&G('f_bloom').value)||'Summer') : undefined,
native:G('f_native').value,
blurb:G('f_blurb').value.trim(), size:G('f_size').value.trim(), sun:G('f_sun').value.trim(),
water:G('f_water').value.trim(), spread:G('f_spread').value.trim(), seasons:G('f_seasons').value.trim(),
wildlife:G('f_wildlife').value.trim(), deer:G('f_deer').value.trim(), toxic:G('f_toxic').value.trim(),
photo:G('f_photo').value.trim(), commons:"",
winter:/winter|evergreen|persist/i.test(G('f_seasons').value+' '+G('f_blurb').value),
verified:new Date().toISOString().slice(0,10) };
userPlants = userPlants.filter(function(u){return u.botanical.toLowerCase().trim()!==key;});
userPlants.push(p);
await saveUser();
['f_common','f_botanical','f_blurb','f_size','f_sun','f_water','f_spread','f_seasons','f_wildlife','f_deer','f_toxic','f_photo'].forEach(function(id){G(id).value='';});
G('f_weed').checked=false; closeModal(); buildTypeChips(); buildTraitChips(); buildLifeChips(); render();
};
searchEl.addEventListener('input', render);
/* submitting the search (Enter / on-screen "Search" key) drops the mobile keyboard */
searchEl.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); searchEl.blur(); } });
searchEl.addEventListener('search', function(){ searchEl.blur(); });
/* tap a card photo to open the swipeable zoom lightbox (engine in reel.js) */
wireLightbox(content);

async function loadSeed(){
try{
const res = await fetch('plants/manifest.json', {cache:'no-cache'});
const man = await res.json();
const paths = (man && man.plants) || [];
const loaded = await Promise.all(paths.map(function(rel){
return fetch('plants/'+rel+'/plant.json')
.then(function(r){ return r.ok ? r.json() : null; })
.then(function(j){ if(j) j.dir='plants/'+rel; return j; })   // dir resolves local images
.catch(function(){ return null; });
}));
SEED = loaded.filter(Boolean);
}catch(e){ console.error('Could not load plant data', e); SEED = []; }
}
function renderSkeleton(){
var card='<div class="skel"><div class="plate"></div><div class="body"><div class="ln t"></div><div class="ln s"></div><div class="ln w"></div><div class="ln w"></div><div class="ln s"></div></div></div>';
content.innerHTML='<div class="grid">'+new Array(8).join(card)+card+'</div>';
var c=document.getElementById('count'); if(c) c.textContent='…';
}
(async function(){ renderSkeleton(); await Promise.all([loadSeed(), loadUser()]); applyHash(); buildTypeChips(); buildTraitChips(); buildLifeChips(); render(); })();
