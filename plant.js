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
['planting','When to plant out (ground & pots)'],
['sun','Sunlight'],
['soil','Soil'],
['water','Watering'],
['spacing','Spacing'],
['propagation','Propagation'],
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
/* the standalone "Edible parts" section reads this fixed allow-list out of the
   plant's optional `edible` object (its `level`+`summary` drive the banner) */
const EDIBLE_FIELDS = [
['parts','Edible parts'],
['preparation','How it’s used'],
['caution','Cautions']
];
const EDIBLE_LEVELS = {
edible:   {lab:'Edible',                cls:'ed-yes'},
caution:  {lab:'Edible with caution',   cls:'ed-caution'},
toxic:    {lab:'Toxic — do not eat',    cls:'ed-toxic'},
inedible: {lab:'Not considered edible', cls:'ed-no'}
};
/* Citations. Prose strings (care + edible) may carry inline [n] / [n,m] markers and
   the facts table cites via the per-field `fact_src` map; both resolve to superscript
   links into the page bibliography (`references`). refsup() takes an array of numbers. */
function refsup(nums){
if(!nums || !nums.length) return '';
var links = nums.map(function(n){ return '<a href="#ref-'+n+'">'+n+'</a>'; }).join(',');
return '<sup class="cite">['+links+']</sup>';
}
function cite(text){
return esc(text).replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, function(_, g){
return refsup(g.split(',').map(function(n){ return n.trim(); }));
});
}
function factMark(p, key){
var fs = (p.fact_src||{})[key];
return refsup(fs && fs.map(String));
}
function factsDL(p){
function row(label, key, val){ return '<dt>'+label+'</dt><dd>'+esc(val)+factMark(p,key)+'</dd>'; }
/* provenance rows — non-native plants only: native range + wild habitat */
var prov = isNative(p) ? '' :
(p.origin?row('Native to','origin',p.origin):'')+
(p.habitat?row('Wild habitat','habitat',p.habitat):'');
/* soil-pH bar is HTML (not escaped text), so it gets its own row rather than row() */
var ph = p.ph ? '<dt class="ph-lbl">Soil pH'+factMark(p,'ph')+'</dt><dd class="ph-cell">'+phBarHTML(p,true)+'</dd>' : '';
return '<dl class="facts big">'+
row('Mature size','size',p.size||'—')+row('Sun','sun',p.sun||'—')+
row('Water','water',p.water||'—')+row('Spread / habit','spread',p.spread||'—')+ph+
row('Seasonal interest','seasons',p.seasons||'—')+row('Wildlife','wildlife',p.wildlife||'—')+
row('Deer','deer',p.deer||'—')+row('Toxicity','toxic',p.toxic||'None of concern')+
prov+
'</dl>';
}
function carePanels(care){
return CARE_FIELDS.filter(function(f){ return care[f[0]]; })
.map(function(f){ return '<div class="care-item"><dt>'+f[1]+'</dt><dd>'+cite(care[f[0]])+'</dd></div>'; })
.join('');
}
function edibleHTML(p){
var e = p.edible;
if(!e) return '';
var lv = EDIBLE_LEVELS[e.level] || EDIBLE_LEVELS.inedible;
/* a wholly toxic/inedible plant needs no "parts"/"how it's used" cells — the banner
   already says don't eat it; show just the cautions (the part that actually matters) */
var fields = (e.level==='toxic'||e.level==='inedible')
? EDIBLE_FIELDS.filter(function(f){ return f[0]==='caution'; })
: EDIBLE_FIELDS;
var rows = fields.filter(function(f){ return e[f[0]]; })
.map(function(f){ var k=f[0];
return '<div class="ed-item'+(k==='caution'?' ed-warn':'')+'"><dt>'+f[1]+'</dt><dd>'+cite(e[k])+'</dd></div>'; })
.join('');
return '<section class="edible '+lv.cls+'"><h2>Edible parts</h2>'+
'<div class="ed-banner"><span class="ed-flag">'+esc(lv.lab)+'</span>'+
(e.summary?'<span class="ed-summary">'+cite(e.summary)+'</span>':'')+'</div>'+
(rows?'<dl class="ed-grid">'+rows+'</dl>':'')+
'</section>';
}
/* page-wide numbered bibliography (the `references` array). Falls back to the legacy
   "compiled from …" line for plants not yet migrated off `care_src`. */
function bibHTML(p){
if(!p.references || !p.references.length){
var legacy = careSrcHTML(p);
return legacy ? '<section><h2>Sources</h2>'+legacy+'</section>' : '';
}
var items = p.references.map(function(c, i){
var n = i+1, nm = esc(c.name||c.url||'source');
var body = c.url ? '<a href="'+esc(c.url)+'" target="_blank" rel="noopener noreferrer">'+nm+' ↗</a>' : nm;
return '<li id="ref-'+n+'" value="'+n+'">'+body+'</li>';
});
return '<section class="refs"><h2>References</h2><ol class="biblio">'+items.join('')+'</ol></section>';
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
const slug = p.dir ? p.dir.replace(/^plants\//,'') : null;
const favBtn = (window.Account && window.Account.favButtonHTML) ? window.Account.favButtonHTML(slug, true) : '';
const panels = carePanels(care);
const grow = panels
? '<dl class="caregrid">'+panels+'</dl>'
: '<p class="care-empty">Detailed growing notes for this plant are still being written — see the at-a-glance facts above for the essentials.</p>';
const credits = creditsHTML(p);
detail.innerHTML =
BACK+
'<article class="sheet">'+
'<div class="sheet-head">'+
'<div class="plate">'+plateHTML(p)+'</div>'+
'<div class="sheet-intro">'+
'<div class="sheet-badges"><span class="badge-type">'+esc((p.type||'')+(p.type==='Forb'&&p.bloom_season?(' · '+p.bloom_season.toLowerCase()+'-blooming'):''))+'</span>'+natBadge(p,'badge-nat')+'</div>'+
'<h1 class="display sheet-name">'+esc(p.common)+'</h1>'+
'<p class="latin">'+esc(p.botanical)+'</p>'+
'<p class="lead">'+esc(p.blurb||'')+'</p>'+
(favBtn?'<div class="sheet-fav">'+favBtn+'</div>':'')+
'<div class="flags">'+flagsHTML(p)+'</div>'+
'<div class="verified">Verified non-weed in CO · '+esc(p.verified||'date n/a')+'</div>'+
'</div>'+
'</div>'+
'<section><h2>At a glance</h2>'+factsDL(p)+'</section>'+
'<section><h2>Growing &amp; care on the Front Range</h2>'+grow+'</section>'+
edibleHTML(p)+
(credits?'<section><h2>Photographs</h2>'+credits+'</section>':'')+
bibHTML(p)+
'</article>'+
BACK.replace('backlink','backlink foot');
wireReels(detail);
wireLightbox(detail);
/* the heart renders before the account session resolves; reflect saved state once it's ready
   (auth.js also re-syncs every heart on any later sign-in / favourite change) */
if(window.Account && window.Account.ready){ window.Account.ready().then(function(){ if(window.Account.syncButtons) window.Account.syncButtons(); }); }
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
showError('No plant specified. Head back to the herbarium and pick a plant.'); return;
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
showError('That plant isn’t in the guide (yet).');
}
}
load();
