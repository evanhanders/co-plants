/* app.js — the encyclopedia grid: load, render cards, filter/search.
   The photo reel + lightbox engine and trait helpers live in reel.js (loaded first);
   the per-plant detail view is its own standalone page (plant.html / plant.js). */
let SEED = []; // populated at load by loadSeed() from plants/<cat>/<slug>/plant.json
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
let view = "type";
const collapsed = new Set(); // group names collapsed (type view)
let natFilter = "all";            // all | native | intro
const typeFilter = new Set();     // empty = all groups shown
const traitFilter = new Set();    // empty = no trait constraint; values: winter|pollin|spreads|toxic|edible
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
function allPlants(){ const map=new Map(); SEED.forEach(function(p){ map.set(p.botanical.toLowerCase().trim(), p); }); return Array.from(map.values()).sort(function(a,b){ return a.botanical.localeCompare(b.botanical,'en',{sensitivity:'base'}); }); }
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
'<dt>Deer</dt><dd>'+(p.deer||'—')+'</dd>'+
(p.edible&&p.edible.food&&p.edible.card?'<dt class="ed">Edible</dt><dd>'+p.edible.card+'</dd>':'')+
(p.toxic?'<dt>Caution</dt><dd>'+p.toxic+'</dd>':'')+
'</dl><div class="flags">'+flagsHTML(p)+'</div>'+
'<div class="verified">Verified non-weed in CO · '+(p.verified||'date n/a')+'</div>'+
(href?'<a class="detaillink" href="'+href+'">Grow &amp; care details →</a>':'')+
'</div></article>';
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
if(showingEl) showingEl.textContent = filtering ? ('Showing '+list.length+' of '+total+' plants') : ('Showing all '+total+' plants');
const clearEl=document.getElementById('clearFilters'); if(clearEl) clearEl.hidden = !filtering;
syncHash();
if(!list.length){ const why = q ? 'match “'+searchEl.value+'”' : 'fit the current filters'; content.innerHTML='<div class="grid"><div class="empty">No plants '+why+'.</div></div>'; return; }
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
wireReels(content);
}
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
(async function(){ renderSkeleton(); await loadSeed(); applyHash(); buildTypeChips(); buildTraitChips(); buildLifeChips(); render(); })();
