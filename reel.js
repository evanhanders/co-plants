/* reel.js — shared photo engine for both the encyclopedia grid (app.js) and the
   standalone plant detail page (plant.js): shot resolution, the seasonal reel, the
   zoom/swipe lightbox, and the trait predicates used by badges everywhere.
   Loaded BEFORE app.js / plant.js; both pages include the same lightbox markup. */

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
/* Full-size image for the zoom lightbox: prefer a repo-hosted `full`, else upgrade
   the remote candidate to a larger render. (The card itself uses the small `local`
   thumbnail via shotCandidates.) */
function shotFull(sh, dir){
if(sh.full) return (dir?dir+'/':'')+sh.full;
if(sh.url) return sh.url;
if(sh.commons) return commonsURL(sh.commons).replace(/width=\d+/, 'width=2000');
if(sh.try && sh.try.length) return commonsURL(sh.try[0]).replace(/width=\d+/, 'width=2000');
return null;
}
function srcLabel(href){
if(!href) return 'Source ↗';
if(href.indexOf('inaturalist')>-1) return 'iNaturalist ↗';
if(href.indexOf('commons.wikimedia')>-1) return 'Commons ↗';
return 'Source ↗';
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
/* the descriptive part of a caption, minus the attribution tail (after · or ©) */
function capPlain(c){ return (c||'').split('·')[0].split('©')[0].trim(); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function plateHTML(p){
const shots = shotsFor(p);
if(!shots.length){ return '<div class="shot empty">'+window.__camera+'<span>Photograph coming soon</span></div>'; }
const caps = shots.map(capOf), srcs = shots.map(shotSource), labs = srcs.map(srcLabel);
const fulls = shots.map(function(sh){ return shotFull(sh, p.dir); });
let reel = '<div class="reel" data-caps=\''+JSON.stringify(caps).replace(/'/g,"&#39;")+'\' data-srcs=\''+JSON.stringify(srcs).replace(/'/g,"&#39;")+'\' data-labs=\''+JSON.stringify(labs).replace(/'/g,"&#39;")+'\'>';
shots.forEach(function(sh,i){ var cand=shotCandidates(sh, p.dir); var rest=JSON.stringify(cand.slice(1)).replace(/'/g,"&#39;"); var cp=capPlain(caps[i]); var alt=esc(p.common+(cp?' — '+cp:'')); reel += '<figure class="shot'+(i===0?' show':'')+'"><img src="'+(cand[0]||"")+'" alt="'+alt+'" loading="lazy" tabindex="0" role="button" aria-label="View larger photo: '+alt+'" data-full="'+esc(fulls[i]||"")+'" data-alts=\''+rest+'\' onerror="window.__imgnext(this)"></figure>'; });
reel += '</div>';
let tabs='';
if(shots.length>1){ shots.forEach(function(sh,i){ var lab=esc(capPlain(caps[i]) || (sh.s||('Photo '+(i+1)))); tabs += '<button class="tab'+(i===0?' on':'')+'" data-i="'+i+'" aria-label="'+lab+'" aria-pressed="'+(i===0?'true':'false')+'" title="'+esc(caps[i]||'')+'">'+seasonIcon(sh.s)+'</button>'; }); }
return reel + '<div class="sbar"><div class="tabs">'+tabs+'</div><span class="lab">'+(caps[0]||'')+'</span>'
+ '<a class="src" href="'+srcs[0]+'" target="_blank" rel="noopener noreferrer">'+(labs[0]||'Source ↗')+'</a></div>';
}
window.__imggone = function(img){ var fig = img.closest ? img.closest('.shot') : null; if(fig){ fig.classList.add('empty'); fig.innerHTML = window.__camera + '<span>Image unavailable</span>'; } };
window.__imgnext = function(img){ var alts=[]; try{ alts=JSON.parse(img.getAttribute('data-alts')||'[]'); }catch(e){} if(alts.length){ var next=alts.shift(); img.setAttribute('data-alts', JSON.stringify(alts)); img.src=next; } else { window.__imggone(img); } };
function wireReels(root){
Array.prototype.forEach.call(root.querySelectorAll('.plate'), function(plate){
var reel = plate.querySelector('.reel'), bar = plate.querySelector('.sbar'); if(!reel||!bar) return;
var tabs = Array.prototype.slice.call(bar.querySelectorAll('.tab'));
var figs = Array.prototype.slice.call(reel.querySelectorAll('.shot'));
var lab = bar.querySelector('.lab'), src = bar.querySelector('.src');
var caps=[], srcs=[], labs=[]; try{ caps=JSON.parse(reel.dataset.caps||'[]'); }catch(e){} try{ srcs=JSON.parse(reel.dataset.srcs||'[]'); }catch(e){} try{ labs=JSON.parse(reel.dataset.labs||'[]'); }catch(e){}
/* the strip is a static stack — only the active season's photo is shown; the dots swap it */
var cur=0;
function setActive(i){ cur=i; figs.forEach(function(f,j){ f.classList.toggle('show', j===i); }); tabs.forEach(function(t,j){ t.classList.toggle('on', j===i); t.setAttribute('aria-pressed', j===i?'true':'false'); }); if(lab) lab.textContent=caps[i]||''; if(src&&srcs[i]){ src.href=srcs[i]; src.textContent=labs[i]||'Source ↗'; } }
tabs.forEach(function(t){ t.onclick=function(){ setActive(+t.dataset.i); }; });
/* finger-swipe the card strip to change season — pointer-based, NOT a scroll container,
   so a vertical drag still scrolls the page (no scroll-chaining). Horizontal-dominant
   swipes past a threshold step the season; taps fall through to the lightbox. */
if(figs.length>1){
var sx=0, sy=0, lx=0, ly=0, sw=false;
function commitSwipe(){
if(!sw) return; sw=false;
var dx=lx-sx, dy=ly-sy;
if(Math.abs(dx)>35 && Math.abs(dx)>Math.abs(dy)*1.3){
var n = dx<0 ? Math.min(figs.length-1, cur+1) : Math.max(0, cur-1);
if(n!==cur) setActive(n);
}
}
reel.addEventListener('pointerdown', function(e){ sx=lx=e.clientX; sy=ly=e.clientY; sw=true; }, {passive:true});
reel.addEventListener('pointermove', function(e){ if(sw){ lx=e.clientX; ly=e.clientY; } }, {passive:true});
/* commit on pointerup AND pointercancel — some mobile browsers (incl. Brave/Android)
   end a horizontal drag with pointercancel rather than pointerup */
reel.addEventListener('pointerup', commitSwipe, {passive:true});
reel.addEventListener('pointercancel', commitSwipe, {passive:true});
}
setActive(0);
});
}

/* ---------- trait predicates + badges (shared by grid cards and the detail sheet) ---------- */
function isNative(p){ return /(^|\s)native\b/i.test(p.native||'') && (p.native||'').toLowerCase().indexOf('non-native')===-1; }
/* derived trait predicates — shared by the badges and the trait filter */
const TRAITS = {
winter:{ label:'Winter', icon:'❄', test:function(p){ return !!p.winter; } },
pollin:{ label:'Pollinator', icon:'✿', test:function(p){ return /bee|pollinat|butterfl|host|hummingbird/i.test(p.wildlife||''); } },
spreads:{ label:'Spreads', icon:'↔', test:function(p){ return /run|rhizom|sucker|thicket|mat-form/i.test(p.spread||''); } },
toxic:{ label:'Toxic', icon:'⚠', test:function(p){ return !!p.toxic; } }
};
function natBadge(p, cls){
return (p.native && p.native.indexOf('native')>-1 && p.native!=='Non-native')
? '<span class="'+cls+'">'+(p.native||'')+'</span>' : '<span class="'+cls+' intro">'+(p.native||'Vetted')+'</span>';
}
/* trait flags — shared by the grid card and the detail sheet */
function flagsHTML(p){
const flags=[];
if(p.lifecycle) flags.push('<span class="flag life">'+p.lifecycle+'</span>');
if(TRAITS.winter.test(p)) flags.push('<span class="flag winter">❄ Winter interest</span>');
if(TRAITS.pollin.test(p)) flags.push('<span class="flag pollin">✿ Pollinator</span>');
if(TRAITS.spreads.test(p)) flags.push('<span class="flag run">↔ Spreads</span>');
if(TRAITS.toxic.test(p)) flags.push('<span class="flag toxic">⚠ Toxic parts</span>');
return flags.join('');
}

/* ---------- image lightbox with pinch / scroll / double-tap zoom ---------- */
(function(){
var lbox=document.getElementById('lbox'), stage=document.getElementById('lbStage'), img=document.getElementById('lbImg');
if(!lbox || !stage || !img) return; /* page without lightbox markup — nothing to wire */
var capText=document.getElementById('lbCapText'), srcA=document.getElementById('lbSrc');
var lbPrev=document.getElementById('lbPrev'), lbNext=document.getElementById('lbNext'), lbCount=document.getElementById('lbCount'), lbHint=document.getElementById('lbHint');
var gallery=[], gIdx=0;
var scale=1, tx=0, ty=0, lastDist=0, lastMid=null;
var pointers=new Map();
var lastTap=0, lastTapX=0, lastTapY=0, moved=false, swiping=false, downX=0, downY=0;
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
var lbTrigger=null;
function updateNav(){
var multi=gallery.length>1;
if(lbPrev) lbPrev.hidden = !multi || gIdx<=0;
if(lbNext) lbNext.hidden = !multi || gIdx>=gallery.length-1;
if(lbCount) lbCount.textContent = multi ? ((gIdx+1)+' / '+gallery.length) : '';
}
function show(i){
gIdx = clamp(i, 0, gallery.length-1);
var it = gallery[gIdx] || {};
img.src = it.full || '';
img.alt = it.cap ? capPlain(it.cap) : '';
capText.textContent = it.cap || '';
if(it.src && it.src!=='#'){ srcA.href=it.src; srcA.textContent=srcLabel(it.src); srcA.style.display=''; } else { srcA.style.display='none'; }
reset(); updateNav();
}
function go(d){ if(gallery.length<2) return; var n=clamp(gIdx+d,0,gallery.length-1); if(n===gIdx){ anim(true); reset(); return; } anim(true); show(n); }
function open(items, index, trigger){
lbTrigger = trigger || document.activeElement;
gallery = items || []; img.classList.remove('anim');
lbox.classList.add('open'); lbox.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
if(lbHint) lbHint.textContent = gallery.length>1 ? 'Swipe or use ‹ › to change photo · pinch or double-tap to zoom' : 'Pinch, scroll, or double-tap to zoom · drag to pan';
show(index||0);
setTimeout(function(){ var c=document.getElementById('lbClose'); if(c) c.focus(); },0);
}
function close(){ lbox.classList.remove('open'); lbox.setAttribute('aria-hidden','true'); document.body.style.overflow=''; img.src=''; gallery=[]; pointers.clear(); lastDist=0; lastMid=null; swiping=false; if(lbTrigger && lbTrigger.focus){ try{ lbTrigger.focus(); }catch(e){} } }
window.__openLightbox=open;
document.getElementById('lbClose').onclick=close;
if(lbPrev) lbPrev.onclick=function(){ go(-1); };
if(lbNext) lbNext.onclick=function(){ go(1); };
document.getElementById('lbIn').onclick=function(){ var c=center(); anim(true); zoomAt(scale*1.5,c.x,c.y); };
document.getElementById('lbOut').onclick=function(){ var c=center(); anim(true); zoomAt(scale/1.5,c.x,c.y); };
document.getElementById('lbReset').onclick=function(){ anim(true); reset(); };
document.addEventListener('keydown', function(e){
if(!lbox.classList.contains('open')) return;
var c=center();
if(e.key==='Escape') close();
else if(e.key==='+'||e.key==='='){ anim(true); zoomAt(scale*1.5,c.x,c.y); }
else if(e.key==='-'||e.key==='_'){ anim(true); zoomAt(scale/1.5,c.x,c.y); }
else if(e.key==='ArrowLeft' && scale<=1.01){ e.preventDefault(); go(-1); }
else if(e.key==='ArrowRight' && scale<=1.01){ e.preventDefault(); go(1); }
else if(e.key==='Tab'){ var f=Array.prototype.slice.call(lbox.querySelectorAll('button, a[href]')).filter(function(el){ return el.offsetParent!==null; }); if(!f.length) return; var first=f[0], last=f[f.length-1]; if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); } else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); } else if(f.indexOf(document.activeElement)<0){ e.preventDefault(); first.focus(); } }
});
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function mid(a,b){ return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; }
function pts(){ return Array.from(pointers.values()); }
stage.addEventListener('pointerdown', function(e){
anim(false);
pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
try{ stage.setPointerCapture(e.pointerId); }catch(_){}
moved=false; swiping=false; downX=e.clientX; downY=e.clientY;
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
} else if(pointers.size===1 && gallery.length>1){
/* not zoomed: drag horizontally to preview a swipe between photos */
var ddx=e.clientX-downX, ddy=e.clientY-downY;
if(swiping || Math.abs(ddx)>Math.abs(ddy)+4){
swiping=true;
/* resistance at the ends so it feels bounded */
if((gIdx===0 && ddx>0) || (gIdx===gallery.length-1 && ddx<0)) ddx*=0.35;
img.style.transform='translateX('+ddx+'px)';
}
}
});
function up(e){
var wasMoved=moved, ddx=e.clientX-downX, ddy=e.clientY-downY;
if(pointers.has(e.pointerId)) pointers.delete(e.pointerId);
if(pointers.size<2){ lastDist=0; lastMid=null; }
if(pointers.size>0) return;
/* commit / cancel a horizontal swipe between gallery photos (only when not zoomed) */
if(swiping && scale<=1.01){
swiping=false;
var thresh=Math.min(80, stage.getBoundingClientRect().width*0.18);
if(Math.abs(ddx)>thresh && Math.abs(ddx)>Math.abs(ddy) && ddx<0 && gIdx<gallery.length-1){ anim(true); show(gIdx+1); return; }
if(Math.abs(ddx)>thresh && Math.abs(ddx)>Math.abs(ddy) && ddx>0 && gIdx>0){ anim(true); show(gIdx-1); return; }
anim(true); reset(); return; /* snap back */
}
if(wasMoved) return;
var onCanvas=(e.target===stage||e.target===img);
if(e.pointerType==='mouse'){ if(onCanvas && scale<=1.01) close(); return; }
var now=Date.now();
var isDbl=(now-lastTap<300) && Math.abs(e.clientX-lastTapX)<32 && Math.abs(e.clientY-lastTapY)<32;
if(isDbl){ anim(true); if(scale>1.01) reset(); else zoomAt(2.5, e.clientX, e.clientY); lastTap=0; return; }
lastTap=now; lastTapX=e.clientX; lastTapY=e.clientY;
if(onCanvas && scale<=1.01){ setTimeout(function(){ if(lastTap===now && scale<=1.01) close(); }, 300); }
}
stage.addEventListener('pointerup', up);
stage.addEventListener('pointercancel', function(e){ if(pointers.has(e.pointerId)) pointers.delete(e.pointerId); if(pointers.size<2){ lastDist=0; lastMid=null; } });
stage.addEventListener('dblclick', function(e){ e.preventDefault(); anim(true); if(scale>1.01) reset(); else zoomAt(2.5,e.clientX,e.clientY); });
stage.addEventListener('wheel', function(e){ e.preventDefault(); anim(false); zoomAt(scale*(e.deltaY<0?1.12:1/1.12), e.clientX, e.clientY); }, {passive:false});
})();
/* the full-size URL for a card thumbnail (repo `full` image, or upgrade the remote) */
function bigOf(im){ if(!im) return ''; var full=im.getAttribute('data-full'); return full ? full : (im.currentSrc||im.src||'').replace(/([?&]width=)\d+/, '$12000'); }
/* open the lightbox for a card photo, exposing the whole reel as a swipeable gallery */
function openFromImg(im){
if(!im || im.closest('.shot.empty')) return;
var fig=im.closest('.shot'), reel=im.closest('.reel'), idx=0, caps=[], srcs=[], items=[];
if(reel){
var figs=Array.prototype.slice.call(reel.querySelectorAll('.shot'));
idx=Math.max(0,figs.indexOf(fig));
try{ caps=JSON.parse(reel.dataset.caps||'[]'); }catch(_){}
try{ srcs=JSON.parse(reel.dataset.srcs||'[]'); }catch(_){}
figs.forEach(function(f,i){ items.push({ full: bigOf(f.querySelector('img')), cap: caps[i]||'', src: srcs[i]||'#' }); });
} else {
items.push({ full: bigOf(im), cap:'', src:'#' });
}
window.__openLightbox(items, idx, im);
}
/* delegate tap-to-open-lightbox on a container, distinguishing a tap (open) from a
   horizontal swipe (change season) so a reel swipe never launches the lightbox on touch */
function wireLightbox(root){
if(!root) return;
var tapDownX=0, tapDownY=0, tapMoved=false;
root.addEventListener('pointerdown', function(e){ tapDownX=e.clientX; tapDownY=e.clientY; tapMoved=false; }, {passive:true});
root.addEventListener('pointermove', function(e){ if(Math.abs(e.clientX-tapDownX)+Math.abs(e.clientY-tapDownY)>10) tapMoved=true; }, {passive:true});
root.addEventListener('click', function(e){
if(tapMoved) return; /* it was a swipe, not a tap */
var im = e.target && e.target.closest ? e.target.closest('.shot img') : null;
openFromImg(im);
});
root.addEventListener('keydown', function(e){
if(e.key!=='Enter' && e.key!==' ' && e.key!=='Spacebar') return;
var im = e.target && e.target.closest ? e.target.closest('.shot img') : null;
if(!im) return;
e.preventDefault(); openFromImg(im);
});
}
