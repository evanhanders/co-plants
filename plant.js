/* plant.js — the standalone per-plant detail page (plant.html?p=<category>/<slug>).
   Fetches that one plant.json and renders a full "sheet": hero reel, at-a-glance
   facts, a grow-and-care grid (from the plant's optional `care` object), and photo
   credits. The reel + lightbox + shot helpers come from reel.js (loaded first). */
const detail = document.getElementById('detail');
const SITE_TITLE = 'The Front Range Herbarium';

/* ordered growing-and-care fields read out of a plant's optional `care` object;
   absent keys are skipped, so a plant fills in as many aspects as apply */
const CARE_FIELDS = [
['hardiness','Hardiness'],
['sun','Sunlight'],
['soil','Soil'],
['water','Watering'],
['spacing','Spacing'],
['sow','Sowing'],
['stratify','Seed preparation'],
['depth','Depth & germination'],
['bloom','Bloom time'],
['feeding','Feeding'],
['maintenance','Maintenance'],
['selfsow','Self-sowing'],
['troubles','Pests & problems'],
['harvest','Seed saving'],
['companions','Good companions']
];
function factsDL(p){
return '<dl class="facts big">'+
'<dt>Mature size</dt><dd>'+esc(p.size||'—')+'</dd><dt>Sun</dt><dd>'+esc(p.sun||'—')+'</dd>'+
'<dt>Water</dt><dd>'+esc(p.water||'—')+'</dd><dt>Spread / habit</dt><dd>'+esc(p.spread||'—')+'</dd>'+
'<dt>Seasonal interest</dt><dd>'+esc(p.seasons||'—')+'</dd><dt>Wildlife</dt><dd>'+esc(p.wildlife||'—')+'</dd>'+
'<dt>Deer</dt><dd>'+esc(p.deer||'—')+'</dd>'+
'<dt>Toxicity</dt><dd>'+esc(p.toxic||'None of concern')+'</dd></dl>';
}
function carePanels(care){
return CARE_FIELDS.filter(function(f){ return care[f[0]]; })
.map(function(f){ return '<div class="care-item"><dt>'+f[1]+'</dt><dd>'+esc(care[f[0]])+'</dd></div>'; })
.join('');
}
function careSrcHTML(p){
var s = p.care_src || [];
if(!s.length) return '';
var items = s.map(function(c){
var nm = esc(c.name || c.url || 'source');
return c.url ? '<a href="'+esc(c.url)+'" target="_blank" rel="noopener noreferrer">'+nm+' ↗</a>' : nm;
});
return '<p class="care-src"><span class="care-src-lab">Care notes compiled from</span> '+items.join(' · ')+'</p>';
}
function creditsHTML(p){
var shots = shotsFor(p).filter(function(s){ return s.by||s.lic||s.link||s.url||s.commons; });
if(!shots.length) return '';
var rows = shots.map(function(s){
var src=shotSource(s), lab=srcLabel(src), cp=capPlain(s.cap||'');
var who = s.by ? esc(s.by) : 'Unknown';
var lic = s.lic ? ' · '+esc(s.lic) : '';
var link = (src && src!=='#') ? ' <a href="'+esc(src)+'" target="_blank" rel="noopener noreferrer">'+lab+'</a>' : '';
return '<li>'+(cp?'<span class="cap">'+esc(cp)+'</span> — ':'')+'© '+who+lic+link+'</li>';
});
return '<ul class="creditlist">'+rows.join('')+'</ul>';
}
const BACK = '<a class="backlink" href="index.html">‹ Back to the herbarium</a>';
function renderDetail(p){
const care = p.care || {};
const panels = carePanels(care);
const grow = panels
? '<div class="caregrid">'+panels+'</div>'
: '<p class="care-empty">Detailed growing notes for this specimen are still being written — see the at-a-glance facts above for the essentials.</p>';
const credits = creditsHTML(p);
detail.innerHTML =
BACK+
'<article class="sheet">'+
'<div class="sheet-head">'+
'<div class="plate">'+plateHTML(p)+'</div>'+
'<div class="sheet-intro">'+
'<div class="sheet-badges"><span class="badge-type">'+esc(p.type||'')+'</span>'+natBadge(p,'badge-nat')+'</div>'+
'<h1 class="display sheet-name">'+esc(p.common)+'</h1>'+
'<p class="latin">'+esc(p.botanical)+'</p>'+
'<p class="lead">'+esc(p.blurb||'')+'</p>'+
'<div class="flags">'+flagsHTML(p)+'</div>'+
'<div class="verified">Verified non-weed in CO · '+esc(p.verified||'date n/a')+'</div>'+
'</div>'+
'</div>'+
'<section><h2>At a glance</h2>'+factsDL(p)+'</section>'+
'<section><h2>Growing &amp; care on the Front Range</h2>'+grow+careSrcHTML(p)+'</section>'+
(credits?'<section><h2>Photographs</h2>'+credits+'</section>':'')+
'</article>'+
BACK.replace('backlink','backlink foot');
wireReels(detail);
wireLightbox(detail);
}
/* keep the document head in step so the title + link previews name the plant */
function setMeta(p){
document.title = p.common+' · '+SITE_TITLE;
var desc = (p.blurb||'').trim();
function set(sel, val){ var el=document.querySelector(sel); if(el && val) el.setAttribute('content', val); }
set('meta[name="description"]', desc);
set('meta[property="og:title"]', p.common+' · '+SITE_TITLE);
set('meta[property="og:description"]', desc);
var shots = shotsFor(p), s0 = shots[0];
if(s0){
var img = s0.full ? (p.dir+'/'+s0.full) : (s0.local ? (p.dir+'/'+s0.local) : (s0.url||''));
if(img){ try{ img = new URL(img, location.href).href; }catch(e){} set('meta[property="og:image"]', img); }
}
}
function showError(msg){
document.title = 'Not found · '+SITE_TITLE;
detail.innerHTML = BACK+'<p class="empty">'+esc(msg)+'</p>';
}
async function load(){
const slug = (new URLSearchParams(location.search).get('p') || decodeURIComponent((location.search||'').replace(/^\?/,''))).trim();
if(!slug || !/^[a-z0-9][a-z0-9/-]*$/i.test(slug)){
showError('No plant specified. Head back to the herbarium and pick a specimen.'); return;
}
try{
const res = await fetch('plants/'+slug+'/plant.json', {cache:'no-cache'});
if(!res.ok) throw new Error('not found');
const p = await res.json();
p.dir = 'plants/'+slug; // resolves local images, same as the grid loader
renderDetail(p);
setMeta(p);
window.scrollTo(0,0);
}catch(e){
showError('That specimen isn’t in the guide (yet).');
}
}
load();
