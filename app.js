/* app.js — the encyclopedia grid: load, render cards, filter/search.
   The photo reel + lightbox engine and trait helpers live in reel.js (loaded first);
   the per-plant detail view is its own standalone page (plant.html / plant.js). */
let SEED = []; // populated at load by loadSeed() from plants/<cat>/<slug>/plant.json
/* COLLECTIONS: cultivar/genus clusters (apples, penstemons, …). Membership lives on each
   plant.json as `collection:"<id>"`; this map (plants/collections.json) only names the group,
   places its single family card in a home `group` (section), picks the `lead` photo, and gives
   a blurb. In the type view, a collection with ≥2 visible members collapses into ONE expandable
   family card; a lone visible member renders as a normal card in its own section. */
let COLLECTIONS = {};
const famOpen = new Set(); // collection ids the user has expanded (type view; default collapsed)
const FAM = {}; // collection id -> its visible members[], stashed each render for lazy carousel build
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

/* ---------- filter dimensions ----------
   Filters are a data-driven set of GROUPS. Each group has options with a predicate; the
   selected chips render first within their group, and every chip shows a FACETED count
   (how many plants remain given the OTHER groups' active filters + the search). Origin,
   form, lifecycle and traits live here alongside the data-backed colour/bloom/sun/water.
   `mode:'or'` = a plant matches any selected chip; `mode:'and'` = it must match all
   (traits compose as AND, e.g. Winter AND Edible). Add a dimension by adding a group. */
function colorsOf(p){ return p.flower_color || []; }
function bloomsOf(p){ return p.bloom || []; }
function sunOf(p){ const s=(p.sun||'').toLowerCase(); const o=[];
  if(/full sun/.test(s) || /^sun\b/.test(s)) o.push('Full sun');
  if(/part shade|part sun|light shade|afternoon shade|part to full/.test(s)) o.push('Part shade');
  if(/full shade/.test(s)) o.push('Shade');
  if(!o.length) o.push('Full sun');
  return o;
}
function waterOf(p){ const lead=(p.water||'').toLowerCase().split(/[;,(—]| - /)[0]; const o=[];
  if(/low|xeric/.test(lead)) o.push('Low');
  if(/moder|medium|average/.test(lead)) o.push('Moderate');
  if(/high/.test(lead)) o.push('High');
  if(!o.length) o.push('Moderate');
  return o;
}
const COLOR_HEX={white:'#fbfbf7',yellow:'#f1c40f',orange:'#e8852b',red:'#cf3a2e',pink:'#e87fae',purple:'#8a5cc4',blue:'#4a78c4',green:'#6a9a3b'};
const cap1=function(s){ return s.charAt(0).toUpperCase()+s.slice(1); };
const GROUPS=[
{key:'type', label:'Form',  mode:'or', opts:GROUP_ORDER.map(function(g){ return {v:g,label:g,test:function(p){return groupOf(p)===g;}}; })},
{key:'color',label:'Flower colour', mode:'or', swatch:true, opts:['white','yellow','orange','red','pink','purple','blue','green'].map(function(c){ return {v:c,label:cap1(c),test:function(p){return colorsOf(p).indexOf(c)>-1;}}; })},
{key:'bloom',label:'Bloom', mode:'or', opts:['spring','summer','fall','winter'].map(function(s){ return {v:s,label:cap1(s),test:function(p){return bloomsOf(p).indexOf(s)>-1;}}; })},
{key:'life', label:'Lifecycle', mode:'or', opts:['Perennial','Tender perennial','Biennial','Annual'].map(function(k){ return {v:k,label:k,test:function(p){return p.lifecycle===k;}}; })},
{key:'sun',  label:'Sun',   mode:'or', opts:['Full sun','Part shade','Shade'].map(function(k){ return {v:k,label:k,test:function(p){return sunOf(p).indexOf(k)>-1;}}; })},
{key:'water',label:'Water', mode:'or', opts:['Low','Moderate','High'].map(function(k){ return {v:k,label:k,test:function(p){return waterOf(p).indexOf(k)>-1;}}; })},
{key:'nat',  label:'Origin',mode:'or', opts:[{v:'native',label:'Native',test:function(p){return isNative(p);}},{v:'intro',label:'Introduced',test:function(p){return !isNative(p);}}]},
{key:'trait',label:'Traits',mode:'and', cls:'trait', opts:['winter','pollin','spreads'].map(function(k){ return {v:k,label:TRAITS[k].label,icon:TRAITS[k].icon,test:TRAITS[k].test}; })},
{key:'edible',label:'Edibility',mode:'or', cls:'ed', opts:['fruit','eflower','eleaf','estem','eseed','eroot','toxparts','fulltox'].map(function(k){ return {v:k,label:TRAITS[k].label,icon:TRAITS[k].icon,test:TRAITS[k].test}; })}
];
const GMAP={}; GROUPS.forEach(function(g){ g.sel=new Set(); g.byv={}; g.opts.forEach(function(o){ g.byv[o.v]=o; }); GMAP[g.key]=g; });
function anyFilter(){ return GROUPS.some(function(g){ return g.sel.size>0; }); }
/* isNative + the TRAITS predicate map live in reel.js (shared with the detail page).
   passesFilters: a plant clears every group with a selection (skip `exceptKey` for facet counts). */
function passesFilters(p, exceptKey){
for(const g of GROUPS){
if(g.key===exceptKey || !g.sel.size) continue;
const sel=Array.from(g.sel).map(function(v){return g.byv[v];}).filter(Boolean);
const ok = g.mode==='and' ? sel.every(function(o){return o.test(p);}) : sel.some(function(o){return o.test(p);});
if(!ok) return false;
}
return true;
}
const content=document.getElementById('content');
const searchEl=document.getElementById('search');
function matchesQuery(p,q){ if(!q) return true;
return [p.common,p.botanical,p.type,p.lifecycle,p.bloom_season,p.native,p.blurb,p.seasons,p.wildlife,p.spread,p.origin,p.habitat,(p.flower_color||[]).join(' '),(p.bloom||[]).join(' ')].join(' ').toLowerCase().indexOf(q)>-1;
}
function allPlants(){ const map=new Map(); SEED.forEach(function(p){ map.set(p.botanical.toLowerCase().trim(), p); }); return Array.from(map.values()).sort(function(a,b){ return a.botanical.localeCompare(b.botanical,'en',{sensitivity:'base'}); }); }
/* a plant's detail page lives at plant.html?p=<category>/<slug>; only seeded plants
   (which carry a repo dir) have one — user-added localStorage plants don't */
function slugOf(p){ return p.dir ? p.dir.replace(/^plants\//,'') : null; }
function slugTail(p){ return p.dir ? p.dir.split('/').pop() : null; } /* "honeycrisp-apple" */
function detailHref(p){ var s=slugOf(p); return s ? 'plant.html?p='+encodeURIComponent(s).replace(/%2F/g,'/') : null; }
/* the plant's collection id, but only if that collection is defined in COLLECTIONS */
function colOf(p){ var c=p&&p.collection; return (c && COLLECTIONS[c]) ? c : null; }
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
/* provenance — non-native plants only: where it's from + its wild growing conditions */
(isNative(p)?'':
 (p.origin?'<dt class="prov">Native to</dt><dd>'+p.origin+'</dd>':'')+
 (p.habitat?'<dt class="prov">Wild habitat</dt><dd>'+p.habitat+'</dd>':''))+
'</dl><div class="flags">'+flagsHTML(p)+'</div>'+
'<div class="verified">Verified non-weed in CO · '+(p.verified||'date n/a')+'</div>'+
(href?'<a class="detaillink" href="'+href+'">Grow &amp; care details →</a>':'')+
'</div></article>';
}
function gridOf(list){ return '<div class="grid">'+list.map(cardHTML).join('')+'</div>'; }
/* One collapsed/expandable family card standing in for a whole collection. Collapsed it shows
   the lead member's photo reel as a cover; expanded it reveals a swipeable, looping CAROUSEL of
   the member cards (verbatim cardHTML, each keeping its own detail-page link), built lazily on
   first open. The carousel stays within the card's grid cell. */
function familyCardHTML(id, members, open){
const col = COLLECTIONS[id];
const lead = members.filter(function(m){ return slugTail(m)===col.lead; })[0] || members[0];
const n = members.length;
const names = members.map(function(m){ return m.common; }).join(' · ');
/* a single native badge only when every member agrees; mixed collections show none */
const nat = members.every(isNative) ? natBadge(lead,'nat') : '';
FAM[id] = members; // stash for the lazy carousel build on expand
return '<article class="card family'+(open?' open':'')+'" data-col="'+id+'" data-n="'+n+'">'+
'<div class="plate">'+plateHTML(lead)+'<span class="famcount">'+n+' varieties</span>'+nat+'</div>'+
'<div class="body"><h3 class="name">'+col.name+'</h3>'+
'<p class="latin">'+(col.blurb||'')+'</p>'+
'<p class="fammembers">'+names+'</p>'+
'<button type="button" class="fam-toggle" data-col="'+id+'" aria-expanded="false">Show '+n+' varieties <span class="fchev">▾</span></button>'+
'</div>'+
'<div class="fam-open"><div class="fam-head"><h3 class="name">'+col.name+'</h3>'+
'<span class="fc-count" aria-live="polite"></span>'+
'<button type="button" class="fam-toggle fam-hide" data-col="'+id+'" aria-expanded="true">Hide <span class="fchev">▾</span></button>'+
'</div><div class="fam-carousel"></div></div></article>';
}
/* the carousel markup: a track of [clone(last), …members…, clone(first)] for seamless looping,
   one card per view, with ‹ › arrows and a dot per member. */
function carouselHTML(members){
const cards = members.map(cardHTML);
const slide = function(h){ return '<div class="fc-slide">'+h+'</div>'; };
let track = slide(cards[cards.length-1]); // lead-in clone of the last
cards.forEach(function(h){ track += slide(h); });
track += slide(cards[0]);                 // lead-out clone of the first
let dots=''; for(var i=0;i<members.length;i++){ dots += '<button type="button" class="fc-dot'+(i===0?' on':'')+'" data-i="'+i+'" aria-label="Variety '+(i+1)+'"></button>'; }
return '<div class="fc-viewport"><div class="fc-track">'+track+'</div>'+
'<button type="button" class="fc-arr fc-prev" aria-label="Previous variety">‹</button>'+
'<button type="button" class="fc-arr fc-next" aria-label="Next variety">›</button></div>'+
'<div class="fc-dots">'+dots+'</div>';
}
/* build + wire a family's carousel on first expand (lazy: nothing renders until you ask) */
function buildCarousel(fam){
if(fam.dataset.built) return;
const id=fam.dataset.col, members=FAM[id]||[];
if(members.length<2) return;
const host=fam.querySelector('.fam-carousel');
host.innerHTML=carouselHTML(members);
wireReels(host);    // season dots + per-photo swipe (lightbox is delegated on #content)
wireCarousel(fam);
fam.dataset.built='1';
}
/* the looping carousel engine. Horizontal swipe drives it ONLY when the gesture starts off the
   photo — a swipe that begins on a .reel is left to the reel's own season-swipe, so both work
   depending on where you grab (image → change season; rest of the card → change variety). */
function wireCarousel(fam){
const vp=fam.querySelector('.fc-viewport'), track=fam.querySelector('.fc-track');
const N=+fam.dataset.n, counter=fam.querySelector('.fc-count');
const dots=Array.prototype.slice.call(fam.querySelectorAll('.fc-dot'));
/* start on the lead member (the one whose photo is the cover) for continuity */
const col=COLLECTIONS[fam.dataset.col]||{}, mem=FAM[fam.dataset.col]||[];
let lead=mem.map(slugTail).indexOf(col.lead); if(lead<0) lead=0;
let idx=lead+1, W=vp.clientWidth; // idx is into the cloned track; real member r is slide r+1
function real(){ return (idx-1+N)%N; }
function ui(){ const r=real(); if(counter) counter.textContent=(r+1)+' / '+N; dots.forEach(function(d,j){ d.classList.toggle('on', j===r); }); }
function place(anim){ track.style.transition=anim?'transform .3s ease':'none'; track.style.transform='translateX('+(-idx*W)+'px)'; ui(); }
function go(d){ idx+=d; place(true); }
track.addEventListener('transitionend', function(){ if(idx===0){ idx=N; place(false); } else if(idx===N+1){ idx=1; place(false); } });
const nb=fam.querySelector('.fc-next'), pb=fam.querySelector('.fc-prev');
if(nb) nb.onclick=function(){ go(1); }; if(pb) pb.onclick=function(){ go(-1); };
dots.forEach(function(d){ d.onclick=function(){ idx=(+d.dataset.i)+1; place(true); }; });
let sx=0, sy=0, drag=false, decided=false, horiz=false, base=0, moved=false, suppress=false;
vp.addEventListener('pointerdown', function(e){
suppress=false;
if(e.target.closest('.reel')||e.target.closest('button')||e.target.closest('a')) return; /* leave photos/controls/links alone */
sx=e.clientX; sy=e.clientY; drag=true; decided=false; horiz=false; moved=false; base=-idx*W; track.style.transition='none';
}, {passive:true});
vp.addEventListener('pointermove', function(e){
if(!drag) return; const dx=e.clientX-sx, dy=e.clientY-sy;
if(!decided && (Math.abs(dx)>8||Math.abs(dy)>8)){ decided=true; horiz=Math.abs(dx)>Math.abs(dy); }
if(decided && horiz){ moved=true; track.style.transform='translateX('+(base+dx)+'px)'; }
}, {passive:true});
function end(e){ if(!drag) return; drag=false; if(!horiz) return;
const dx=e.clientX-sx, th=Math.min(80, W*0.2);
if(dx<=-th) go(1); else if(dx>=th) go(-1); else place(true);
if(moved) suppress=true; /* swallow the click that follows a real drag */ }
vp.addEventListener('pointerup', end, {passive:true});
vp.addEventListener('pointercancel', end, {passive:true});
vp.addEventListener('click', function(e){ if(suppress){ e.preventDefault(); e.stopPropagation(); suppress=false; } }, true);
/* reposition on resize; a re-render discards this carousel, so bail if it's detached */
window.addEventListener('resize', function(){ if(!document.body.contains(vp)) return; W=vp.clientWidth; place(false); });
place(false);
}
/* ---------- the filter bar: faceted counts + selected-first ordering ---------- */
function renderFilters(all, q){
const root=document.getElementById('filters'); if(!root) return;
let html='';
GROUPS.forEach(function(g){
/* base = plants passing the search + every OTHER group's filters; counts are within it */
const base=all.filter(function(p){ return matchesQuery(p,q) && passesFilters(p,g.key); });
const selOpts=Array.from(g.sel).map(function(v){return g.byv[v];}).filter(Boolean);
const chips=g.opts.map(function(o){
let cnt;
if(g.mode==='and') cnt=base.filter(function(p){ return selOpts.every(function(s){return s.test(p);}) && o.test(p); }).length;
else cnt=base.filter(function(p){ return o.test(p); }).length;
return {o:o, cnt:cnt, active:g.sel.has(o.v)};
});
/* selected chips jump to the front of their group; the rest keep their natural order */
chips.sort(function(a,b){ return (a.active===b.active)?0:(a.active?-1:1); });
const inner=chips.map(function(c){
const off = !c.active && c.cnt===0;
const sw = g.swatch ? '<span class="sw" style="background:'+COLOR_HEX[c.o.v]+'"></span>' : '';
const ic = c.o.icon ? '<span class="ic">'+c.o.icon+'</span>' : '';
return '<button type="button" class="chip'+(g.cls?(' '+g.cls):'')+(c.active?' active':'')+(off?' off':'')+'"'
+' data-g="'+g.key+'" data-v="'+c.o.v+'" aria-pressed="'+(c.active?'true':'false')+'"'+(off?' disabled':'')+'>'
+sw+ic+c.o.label+' <span class="gc">'+c.cnt+'</span></button>';
}).join('');
html+='<div class="fgroup"><span class="fl-label">'+g.label+'</span><div class="chips">'+inner+'</div></div>';
});
root.innerHTML=html;
}
function render(){
const q=(searchEl.value||'').toLowerCase().trim();
const all=allPlants();
const total=all.length;
const list=all.filter(function(p){ return passesFilters(p) && matchesQuery(p,q); });
document.getElementById('count').textContent = total;
renderFilters(all, q);
updateFilterToggle();
const filtering = q || anyFilter();
const showingEl=document.getElementById('showing');
if(showingEl) showingEl.textContent = filtering ? ('Showing '+list.length+' of '+total+' plants') : ('Showing all '+total+' plants');
const clearEl=document.getElementById('clearFilters'); if(clearEl) clearEl.hidden = !filtering;
syncHash();
if(!list.length){ const why = q ? 'match “'+searchEl.value+'”' : 'fit the current filters'; content.innerHTML='<div class="grid"><div class="empty">No plants '+why+'.</div></div>'; return; }
if(view==="alpha"){
content.innerHTML = gridOf(list);
} else {
/* Fold the filtered list into renderable ITEMS bucketed by section. An item is either a
   single plant or a collection family. A collection with ≥2 visible members becomes ONE
   family item placed in its home group; a lone visible member falls back to a normal card
   in its own morphology section, so it never hides behind a pointless wrapper. */
const colSets={};
list.forEach(function(p){ const c=colOf(p); if(c){ (colSets[c]=colSets[c]||[]).push(p); } });
const buckets={}, counts={}; // group -> items[]; group -> plant count (for the header tally)
function add(g,item,nPlants){ (buckets[g]=buckets[g]||[]).push(item); counts[g]=(counts[g]||0)+nPlants; }
list.forEach(function(p){ if(colOf(p)) return; const g=groupOf(p); add(g,{key:p.botanical,html:cardHTML(p)},1); });
const famForceOpen = !!filtering; // a search/filter is on → show what matched, expanded
Object.keys(colSets).forEach(function(id){
const members=colSets[id].slice().sort(function(a,b){ return a.botanical.localeCompare(b.botanical,'en',{sensitivity:'base'}); });
if(members.length===1){ const p=members[0]; add(groupOf(p),{key:p.botanical,html:cardHTML(p)},1); return; }
const col=COLLECTIONS[id], g=col.group||groupOf(members[0]);
const lead=members.filter(function(m){ return slugTail(m)===col.lead; })[0]||members[0];
add(g,{key:lead.botanical,html:familyCardHTML(id,members,famForceOpen||famOpen.has(id))},members.length);
});
Object.keys(buckets).forEach(function(g){ buckets[g].sort(function(a,b){ return a.key.localeCompare(b.key,'en',{sensitivity:'base'}); }); });
let html="";
GROUP_ORDER.forEach(function(g){
if(!buckets[g]) return;
const isC = !q && collapsed.has(g);
html += '<section class="grp'+(isC?' collapsed':'')+'" data-group="'+g+'">'
+ '<div class="group-head" data-g="'+g+'"><button class="chev" data-g="'+g+'" aria-expanded="'+(isC?'false':'true')+'" aria-label="'+(isC?'Expand ':'Collapse ')+g+'">▾</button><h2>'+g+'</h2><span class="gc">'+counts[g]+'</span><span class="rule"></span></div>'
+ (GROUP_DESC[g]?'<p class="group-desc">'+GROUP_DESC[g]+'</p>':'')
+ '<div class="grid">'+buckets[g].map(function(it){ return it.html; }).join('')+'</div>' + '</section>';
});
content.innerHTML = html;
Array.prototype.forEach.call(content.querySelectorAll('.group-head'), function(h){
h.onclick=function(){ if(q) return; /* during search everything is force-expanded */ const g=h.dataset.g; const nowC = !collapsed.has(g); if(nowC) collapsed.add(g); else collapsed.delete(g); h.parentElement.classList.toggle('collapsed', nowC); const chev=h.querySelector('.chev'); if(chev){ chev.setAttribute('aria-expanded', nowC?'false':'true'); chev.setAttribute('aria-label', (nowC?'Expand ':'Collapse ')+g); } };
});
/* family expand/collapse: toggle in place (no full re-render → keeps scroll & sibling state);
   build the carousel lazily the first time a family is opened */
Array.prototype.forEach.call(content.querySelectorAll('.fam-toggle'), function(btn){
btn.onclick=function(e){ e.preventDefault();
const id=btn.dataset.col, fam=content.querySelector('.family[data-col="'+id+'"]'); if(!fam) return;
const willOpen=!fam.classList.contains('open');
fam.classList.toggle('open', willOpen);
if(willOpen){ buildCarousel(fam); famOpen.add(id); } else famOpen.delete(id); };
});
/* force-open families (active search/filter) render with .open — build their carousels now */
Array.prototype.forEach.call(content.querySelectorAll('.family.open'), buildCarousel);
}
wireReels(content);
}
/* ---------- view toggle ---------- */
Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function(btn){
btn.onclick=function(){ view=btn.dataset.view; Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function(b){ b.classList.toggle('active', b===btn); }); render(); };
});
/* ---------- filters: one delegated handler toggles a chip's group selection ---------- */
{ const fr=document.getElementById('filters'); if(fr) fr.addEventListener('click', function(e){
const btn=e.target.closest('.chip'); if(!btn || btn.disabled) return;
const g=GMAP[btn.dataset.g]; if(!g) return;
const v=btn.dataset.v; if(g.sel.has(v)) g.sel.delete(v); else g.sel.add(v);
render();
}); }
/* clear everything: search + every filter group */
function clearAllFilters(){ searchEl.value=''; GROUPS.forEach(function(g){ g.sel.clear(); }); render(); }
{ const cf=document.getElementById('clearFilters'); if(cf) cf.onclick=clearAllFilters; }
/* mobile: a "Filters" toggle collapses/expands the whole filter bar */
{ const ft=document.getElementById('filterToggle'), fb=document.getElementById('filters');
if(ft && fb) ft.addEventListener('click', function(){ const open=!fb.classList.contains('open'); fb.classList.toggle('open', open); ft.setAttribute('aria-expanded', open?'true':'false'); }); }
function updateFilterToggle(){ const n=GROUPS.reduce(function(a,g){ return a+g.sel.size; },0); const c=document.getElementById('ftCount'); if(c){ c.textContent=n; c.hidden=(n===0); } }
/* ---------- shareable URL state (hash) ---------- */
function syncHash(){
const parts=[];
if(view!=='type') parts.push('view='+view);
GROUPS.forEach(function(g){ if(g.sel.size) parts.push(g.key+'='+encodeURIComponent(Array.from(g.sel).join(','))); });
const q=(searchEl.value||'').trim(); if(q) parts.push('q='+encodeURIComponent(q));
const h=parts.length?('#'+parts.join('&')):'';
if(h!==location.hash){ try{ history.replaceState(null,'',location.pathname+location.search+h); }catch(e){} }
}
function applyHash(){
const h=(location.hash||'').replace(/^#/,''); if(!h) return;
h.split('&').forEach(function(kv){
const i=kv.indexOf('='); if(i<0) return; const k=kv.slice(0,i), v=decodeURIComponent(kv.slice(i+1));
if(k==='view' && (v==='alpha'||v==='type')) view=v;
else if(k==='q'){ searchEl.value=v; }
else if(GMAP[k]){ GMAP[k].sel.clear(); v.split(',').forEach(function(x){ if(x && GMAP[k].byv[x]) GMAP[k].sel.add(x); }); }
});
Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function(b){ b.classList.toggle('active', b.dataset.view===view); });
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
try{ const cr=await fetch('plants/collections.json',{cache:'no-cache'}); if(cr.ok){ const cj=await cr.json(); COLLECTIONS=(cj&&cj.collections)||cj||{}; } }
catch(e){ COLLECTIONS={}; }
}catch(e){ console.error('Could not load plant data', e); SEED = []; }
}
function renderSkeleton(){
var card='<div class="skel"><div class="plate"></div><div class="body"><div class="ln t"></div><div class="ln s"></div><div class="ln w"></div><div class="ln w"></div><div class="ln s"></div></div></div>';
content.innerHTML='<div class="grid">'+new Array(8).join(card)+card+'</div>';
var c=document.getElementById('count'); if(c) c.textContent='…';
}
(async function(){ renderSkeleton(); await loadSeed(); applyHash(); render(); })();
