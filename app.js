let SEED = []; // populated at load by loadSeed() from plants/<cat>/<slug>/plant.json
const STORAGE_KEY = "plantarium_user_plants_v2";
const GROUP_ORDER = ["Trees","Shrubs","Subshrubs","Ornamental grasses","Perennials","Annuals","Vines","Groundcovers","Other"];
function groupOf(type){
return ({Tree:"Trees",Shrub:"Shrubs",Subshrub:"Subshrubs",Grass:"Ornamental grasses",
Perennial:"Perennials",Annual:"Annuals",Vine:"Vines",Groundcover:"Groundcovers"})[type] || "Other";
}

/* ---------- real-photo seasonal reel ---------- */
/* Each plant's photos live in its own plant.json `shots` array.
   A shot is { commons | url | local | try:[...], s?, cap? } and is tried
   local-first; shotsFor falls back to p.commons then p.photo. */
function shotsFor(p){
if(p.shots && p.shots.length) return p.shots;
if(p.commons) return [{commons:p.commons}];
if(p.photo) return [{url:p.photo}];
return [];
}
function commonsURL(name){ return "https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(name)+"?width=800"; }
function shotCandidates(sh, dir){
var out=[];
if(sh.local) out.push((dir?dir+'/':'')+sh.local);   // repo-hosted image, tried first
if(sh.try && sh.try.length) out=out.concat(sh.try.map(commonsURL));
if(sh.url) out.push(sh.url);
if(sh.commons) out.push(commonsURL(sh.commons));
return out;
}
function shotSource(sh){
if(sh.link) return sh.link;
if(sh.url) return sh.url;
var n = sh.commons || (sh.try && sh.try[0]);
return n ? "https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(n) : "#";
}
const SEASON_ICON = {
spring:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V11"/><path d="M12 13c-1-3-4-5-8-5 0 4 4 6 8 5z"/><path d="M12 11c1-3 4-6 8-6 0 4-4 6-8 6z"/></svg>',
summer:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
fall:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3C6 4 4 8 5 13c4 .5 7-2 8-6"/><path d="M5 13c-1 4 1 7 5 8 4-5 4-12 1-18"/></svg>',
winter:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M2 12h20M5.5 5.5l13 13M18.5 5.5l-13 13"/></svg>'
};
function seasonIcon(s){ return SEASON_ICON[s] || '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>'; }
window.__camera = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></svg>';
function capOf(sh){ return sh.cap || (sh.s ? sh.s.charAt(0).toUpperCase()+sh.s.slice(1) : ""); }
function plateHTML(p){
const shots = shotsFor(p);
if(!shots.length){ return '<div class="shot empty">'+window.__camera+'<span>Photograph coming soon</span></div>'; }
const caps = shots.map(capOf), srcs = shots.map(shotSource);
let reel = '<div class="reel" data-caps=\''+JSON.stringify(caps).replace(/'/g,"&#39;")+'\' data-srcs=\''+JSON.stringify(srcs).replace(/'/g,"&#39;")+'\'>';
shots.forEach(function(sh){ var cand=shotCandidates(sh, p.dir); var rest=JSON.stringify(cand.slice(1)).replace(/'/g,"&#39;"); reel += '<figure class="shot"><img src="'+(cand[0]||"")+'" alt="'+p.common+'" loading="lazy" data-alts=\''+rest+'\' onerror="window.__imgnext(this)"></figure>'; });
reel += '</div>';
let tabs='';
if(shots.length>1){ shots.forEach(function(sh,i){ tabs += '<button class="tab'+(i===0?' on':'')+'" data-i="'+i+'" title="'+(caps[i]||'')+'">'+seasonIcon(sh.s)+'</button>'; }); }
return reel + '<div class="sbar"><div class="tabs">'+tabs+'</div><span class="lab">'+(caps[0]||'')+'</span>'
+ '<a class="src" href="'+srcs[0]+'" target="_blank" rel="noopener noreferrer">Commons ↗</a></div>';
}
window.__imggone = function(img){ var fig = img.closest ? img.closest('.shot') : null; if(fig){ fig.classList.add('empty'); fig.innerHTML = window.__camera + '<span>Image unavailable</span>'; } };
window.__imgnext = function(img){ var alts=[]; try{ alts=JSON.parse(img.getAttribute('data-alts')||'[]'); }catch(e){} if(alts.length){ var next=alts.shift(); img.setAttribute('data-alts', JSON.stringify(alts)); img.src=next; } else { window.__imggone(img); } };
function wireReels(root){
Array.prototype.forEach.call(root.querySelectorAll('.plate'), function(plate){
var reel = plate.querySelector('.reel'), bar = plate.querySelector('.sbar'); if(!reel||!bar) return;
var tabs = Array.prototype.slice.call(bar.querySelectorAll('.tab'));
var lab = bar.querySelector('.lab'), src = bar.querySelector('.src');
var caps=[], srcs=[]; try{ caps=JSON.parse(reel.dataset.caps||'[]'); }catch(e){} try{ srcs=JSON.parse(reel.dataset.srcs||'[]'); }catch(e){}
function setActive(i){ tabs.forEach(function(t,j){ t.classList.toggle('on', j===i); }); if(lab) lab.textContent=caps[i]||''; if(src&&srcs[i]) src.href=srcs[i]; }
function curIdx(){ var n=tabs.length?tabs.length-1:0; return Math.min(n, Math.max(0, Math.round(reel.scrollLeft/Math.max(1,reel.clientWidth)))); }
var settle;
reel.addEventListener('scroll', function(){ setActive(curIdx()); clearTimeout(settle); settle=setTimeout(function(){ setActive(curIdx()); }, 150); }, {passive:true});
reel.addEventListener('scrollend', function(){ setActive(curIdx()); }, {passive:true});
tabs.forEach(function(t){ t.onclick=function(){ var j=+t.dataset.i; reel.scrollTo({left:j*reel.clientWidth, behavior:'smooth'}); setActive(j); }; });
setActive(0);
});
}
/* ---------- state ---------- */
let userPlants = [];
let view = "type";
const collapsed = new Set(); // group names collapsed (type view)
let natFilter = "all";            // all | native | intro
const typeFilter = new Set();     // empty = all groups shown
function isNative(p){ return (p.native||'').indexOf('native')>-1 && p.native!=='Non-native'; }
function passesFilters(p){
if(natFilter==='native' && !isNative(p)) return false;
if(natFilter==='intro' && isNative(p)) return false;
if(typeFilter.size && !typeFilter.has(groupOf(p.type))) return false;
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
function allPlants(){ const map=new Map(); SEED.concat(userPlants).forEach(function(p){ map.set(p.botanical.toLowerCase().trim(), p); }); return Array.from(map.values()).sort(function(a,b){ return a.common.localeCompare(b.common,'en',{sensitivity:'base'}); }); }
function cardHTML(p){
const plate = plateHTML(p);
const nat = (p.native && p.native.indexOf('native')>-1 && p.native!=='Non-native')
? '<span class="nat">'+p.native+'</span>' : '<span class="nat intro">'+(p.native||'Vetted')+'</span>';
const flags=[];
if(p.winter) flags.push('<span class="flag winter">❄ Winter interest</span>');
if((p.wildlife||'').match(/bee|pollinat|butterfl|host|hummingbird/i)) flags.push('<span class="flag pollin">✿ Pollinator</span>');
if((p.spread||'').match(/run|rhizom|sucker|thicket|mat-form/i)) flags.push('<span class="flag run">↔ Spreads</span>');
if(p.toxic) flags.push('<span class="flag toxic">⚠ Toxic parts</span>');
return '<article class="card"><div class="plate">'+plate+'<span class="corner">'+(p.type||'')+'</span>'+nat+'</div>'+
'<div class="body"><h3 class="name">'+p.common+'</h3><p class="latin">'+p.botanical+'</p>'+
'<p class="blurb">'+(p.blurb||'')+'</p><dl class="facts">'+
'<dt>Size</dt><dd>'+(p.size||'—')+'</dd><dt>Sun</dt><dd>'+(p.sun||'—')+'</dd>'+
'<dt>Water</dt><dd>'+(p.water||'—')+'</dd><dt>Habit</dt><dd>'+(p.spread||'—')+'</dd>'+
'<dt>Seasons</dt><dd>'+(p.seasons||'—')+'</dd><dt>Wildlife</dt><dd>'+(p.wildlife||'—')+'</dd>'+
'<dt>Deer</dt><dd>'+(p.deer||'—')+'</dd>'+(p.toxic?'<dt>Caution</dt><dd>'+p.toxic+'</dd>':'')+
'</dl><div class="flags">'+flags.join('')+'</div>'+
'<div class="verified">Verified non-weed in CO · '+(p.verified||'date n/a')+'</div>'+
(isUser(p)?'<button class="del" data-bot="'+p.botanical+'">remove</button>':'')+'</div></article>';
}
function gridOf(list){ return '<div class="grid">'+list.map(cardHTML).join('')+'</div>'; }
function render(){
const q=(searchEl.value||'').toLowerCase().trim();
const total=allPlants().length;
const list=allPlants().filter(function(p){
if(!passesFilters(p)) return false;
if(!q) return true;
return [p.common,p.botanical,p.type,p.native,p.blurb,p.seasons,p.wildlife,p.spread].join(' ').toLowerCase().indexOf(q)>-1;
});
document.getElementById('count').textContent = total;
const filtering = q || natFilter!=='all' || typeFilter.size>0;
const showingEl=document.getElementById('showing');
if(showingEl) showingEl.textContent = filtering ? ('Showing '+list.length+' of '+total) : '';
if(!list.length){ const why = q ? 'matches “'+searchEl.value+'”' : 'fits the current filters'; content.innerHTML='<div class="grid"><div class="empty">No specimen '+why+'.</div></div>'; return; }
if(view==="alpha"){
content.innerHTML = gridOf(list);
} else {
const buckets={};
list.forEach(function(p){ const g=groupOf(p.type); (buckets[g]=buckets[g]||[]).push(p); });
let html="";
GROUP_ORDER.forEach(function(g){
if(!buckets[g]) return;
const isC = !q && collapsed.has(g);
html += '<section class="grp'+(isC?' collapsed':'')+'" data-group="'+g+'">'
+ '<div class="group-head" data-g="'+g+'"><span class="chev">▾</span><h2>'+g+'</h2><span class="gc">'+buckets[g].length+'</span><span class="rule"></span></div>'
+ gridOf(buckets[g]) + '</section>';
});
content.innerHTML = html;
Array.prototype.forEach.call(content.querySelectorAll('.group-head'), function(h){
h.onclick=function(){ const g=h.dataset.g; if(collapsed.has(g)) collapsed.delete(g); else collapsed.add(g); h.parentElement.classList.toggle('collapsed'); };
});
}
Array.prototype.forEach.call(content.querySelectorAll('.del'), function(b){ b.onclick=function(){ removePlant(b.dataset.bot); }; });
wireReels(content);
}
async function removePlant(bot){ userPlants = userPlants.filter(function(u){return u.botanical!==bot;}); await saveUser(); render(); }
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
const present=new Set(allPlants().map(function(p){return groupOf(p.type);}));
let html='<button class="chip" data-all="1">All</button>';
GROUP_ORDER.forEach(function(g){ if(present.has(g)) html+='<button class="chip" data-group="'+g+'">'+g+'</button>'; });
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
/* ---------- add modal ---------- */
const scrim=document.getElementById('scrim');
const G=function(id){return document.getElementById(id);};
G('addBtn').onclick=function(){ G('err').textContent=''; scrim.classList.add('open'); };
G('cancelBtn').onclick=function(){ scrim.classList.remove('open'); };
scrim.onclick=function(e){ if(e.target===scrim) scrim.classList.remove('open'); };
G('saveBtn').onclick=async function(){
const common=G('f_common').value.trim(), botanical=G('f_botanical').value.trim();
if(!common||!botanical){ G('err').textContent='Please give both a common and botanical name.'; return; }
if(!G('f_weed').checked){ G('err').textContent='Please confirm the weed check — no weeds get in without it.'; return; }
const p={ common:common, botanical:botanical, type:G('f_type').value, native:G('f_native').value,
blurb:G('f_blurb').value.trim(), size:G('f_size').value.trim(), sun:G('f_sun').value.trim(),
water:G('f_water').value.trim(), spread:G('f_spread').value.trim(), seasons:G('f_seasons').value.trim(),
wildlife:G('f_wildlife').value.trim(), deer:G('f_deer').value.trim(), toxic:G('f_toxic').value.trim(),
photo:G('f_photo').value.trim(), commons:"",
winter:/winter|evergreen|persist/i.test(G('f_seasons').value),
verified:new Date().toISOString().slice(0,10) };
userPlants = userPlants.filter(function(u){return u.botanical.toLowerCase().trim()!==botanical.toLowerCase().trim();});
userPlants.push(p);
await saveUser();
['f_common','f_botanical','f_blurb','f_size','f_sun','f_water','f_spread','f_seasons','f_wildlife','f_deer','f_toxic','f_photo'].forEach(function(id){G(id).value='';});
G('f_weed').checked=false; scrim.classList.remove('open'); render();
};
searchEl.addEventListener('input', render);
/* submitting the search (Enter / on-screen "Search" key) drops the mobile keyboard */
searchEl.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); searchEl.blur(); } });
searchEl.addEventListener('search', function(){ searchEl.blur(); });

/* ---------- image lightbox with pinch / scroll / double-tap zoom ---------- */
(function(){
var lbox=document.getElementById('lbox'), stage=document.getElementById('lbStage'), img=document.getElementById('lbImg');
var capText=document.getElementById('lbCapText'), srcA=document.getElementById('lbSrc');
var scale=1, tx=0, ty=0, lastDist=0, lastMid=null;
var pointers=new Map();
var lastTap=0, lastTapX=0, lastTapY=0, moved=false, downX=0, downY=0;
function clamp(v,a,b){ return Math.min(b,Math.max(a,v)); }
function center(){ var r=stage.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }
function clampPan(){
var fw=img.clientWidth*scale, fh=img.clientHeight*scale, r=stage.getBoundingClientRect();
var ox=Math.max(0,(fw-r.width)/2), oy=Math.max(0,(fh-r.height)/2);
tx=clamp(tx,-ox,ox); ty=clamp(ty,-oy,oy);
}
function apply(){ img.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')'; img.classList.toggle('zoomed', scale>1.01); }
function reset(){ scale=1; tx=0; ty=0; apply(); }
function zoomAt(ns, px, py){
ns=clamp(ns,1,5); var f=ns/scale, c=center();
tx=(px-c.x)*(1-f)+tx*f; ty=(py-c.y)*(1-f)+ty*f; scale=ns;
if(scale<=1.001){ scale=1; tx=0; ty=0; } else clampPan();
apply();
}
function anim(on){ img.classList.toggle('anim', !!on); }
function open(src, cap, source){
img.classList.remove('anim');
img.src=src; capText.textContent=cap||'';
if(source && source!=='#'){ srcA.href=source; srcA.style.display=''; } else { srcA.style.display='none'; }
reset(); lbox.classList.add('open'); lbox.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
}
function close(){ lbox.classList.remove('open'); lbox.setAttribute('aria-hidden','true'); document.body.style.overflow=''; img.src=''; pointers.clear(); lastDist=0; lastMid=null; }
window.__openLightbox=open;
document.getElementById('lbClose').onclick=close;
document.getElementById('lbIn').onclick=function(){ var c=center(); anim(true); zoomAt(scale*1.5,c.x,c.y); };
document.getElementById('lbOut').onclick=function(){ var c=center(); anim(true); zoomAt(scale/1.5,c.x,c.y); };
document.getElementById('lbReset').onclick=function(){ anim(true); reset(); };
document.addEventListener('keydown', function(e){
if(!lbox.classList.contains('open')) return;
var c=center();
if(e.key==='Escape') close();
else if(e.key==='+'||e.key==='='){ anim(true); zoomAt(scale*1.5,c.x,c.y); }
else if(e.key==='-'||e.key==='_'){ anim(true); zoomAt(scale/1.5,c.x,c.y); }
});
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function mid(a,b){ return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; }
function pts(){ return Array.from(pointers.values()); }
stage.addEventListener('pointerdown', function(e){
anim(false);
pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
try{ stage.setPointerCapture(e.pointerId); }catch(_){}
moved=false; downX=e.clientX; downY=e.clientY;
if(pointers.size===2){ var p=pts(); lastDist=dist(p[0],p[1]); lastMid=mid(p[0],p[1]); }
});
stage.addEventListener('pointermove', function(e){
if(!pointers.has(e.pointerId)) return;
var prev=pointers.get(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
if(Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY)>6) moved=true;
if(pointers.size>=2){
var p=pts(), d=dist(p[0],p[1]), m=mid(p[0],p[1]);
if(lastDist>0){
var f=d/lastDist, ns=clamp(scale*f,1,5), af=ns/scale, c=center();
tx=(m.x-c.x)*(1-af)+tx*af + (lastMid?(m.x-lastMid.x):0);
ty=(m.y-c.y)*(1-af)+ty*af + (lastMid?(m.y-lastMid.y):0);
scale=ns; if(scale<=1.001){scale=1;tx=0;ty=0;} else clampPan(); apply();
}
lastDist=d; lastMid=m;
} else if(pointers.size===1 && scale>1.01){
tx += e.clientX-prev.x; ty += e.clientY-prev.y; clampPan(); apply();
}
});
function up(e){
var wasMoved=moved;
if(pointers.has(e.pointerId)) pointers.delete(e.pointerId);
if(pointers.size<2){ lastDist=0; lastMid=null; }
if(pointers.size>0) return;
if(wasMoved) return;
if(e.pointerType==='mouse'){ if(e.target===stage && scale<=1.01) close(); return; }
var now=Date.now();
var isDbl=(now-lastTap<300) && Math.abs(e.clientX-lastTapX)<32 && Math.abs(e.clientY-lastTapY)<32;
if(isDbl){ anim(true); if(scale>1.01) reset(); else zoomAt(2.5, e.clientX, e.clientY); lastTap=0; return; }
lastTap=now; lastTapX=e.clientX; lastTapY=e.clientY;
if(e.target===stage && scale<=1.01){ setTimeout(function(){ if(lastTap===now && scale<=1.01) close(); }, 300); }
}
stage.addEventListener('pointerup', up);
stage.addEventListener('pointercancel', function(e){ if(pointers.has(e.pointerId)) pointers.delete(e.pointerId); if(pointers.size<2){ lastDist=0; lastMid=null; } });
stage.addEventListener('dblclick', function(e){ e.preventDefault(); anim(true); if(scale>1.01) reset(); else zoomAt(2.5,e.clientX,e.clientY); });
stage.addEventListener('wheel', function(e){ e.preventDefault(); anim(false); zoomAt(scale*(e.deltaY<0?1.12:1/1.12), e.clientX, e.clientY); }, {passive:false});
})();
/* open the lightbox when a card photo is tapped */
content.addEventListener('click', function(e){
var im = e.target && e.target.closest ? e.target.closest('.shot img') : null;
if(!im || im.closest('.shot.empty')) return;
var fig=im.closest('.shot'), reel=im.closest('.reel'), idx=0, caps=[], srcs=[];
if(reel){ var figs=Array.prototype.slice.call(reel.querySelectorAll('.shot')); idx=Math.max(0,figs.indexOf(fig));
try{ caps=JSON.parse(reel.dataset.caps||'[]'); }catch(_){}
try{ srcs=JSON.parse(reel.dataset.srcs||'[]'); }catch(_){} }
var big=(im.currentSrc||im.src||'').replace(/([?&]width=)\d+/, '$12000');
window.__openLightbox(big, caps[idx]||'', srcs[idx]||'#');
});

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
(async function(){ await Promise.all([loadSeed(), loadUser()]); buildTypeChips(); render(); })();
