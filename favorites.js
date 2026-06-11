/* favorites.js — the standalone "My favourites" page (favorites.html). Loads the plant data and
   renders the signed-in user's saved plants using the SAME shared cardHTML/reel as the grid
   (both live in reel.js). Signed out → a prompt to sign in. Unfavouriting (tap a ♥) updates live. */
(function(){
'use strict';
var grid=document.getElementById('favGrid'), state=document.getElementById('favState');

if(!(window.Account && window.Account.configured)){
  state.textContent='Accounts aren’t set up on this site yet.';
  return;
}

var SEED=[], loaded=false;
async function loadSeed(){
  try{
    var man=await (await fetch('plants/manifest.json',{cache:'no-cache'})).json();
    var paths=(man && man.plants)||[];
    var loadedPlants=await Promise.all(paths.map(function(rel){
      return fetch('plants/'+rel+'/plant.json')
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(j){ if(j) j.dir='plants/'+rel; return j; })
        .catch(function(){ return null; });
    }));
    SEED=loadedPlants.filter(Boolean);
  }catch(e){ console.error('Could not load plant data', e); SEED=[]; }
  loaded=true;
}

function render(){
  if(!loaded){ state.textContent='Loading…'; grid.innerHTML=''; return; }
  if(!window.Account.isSignedIn()){
    state.innerHTML='Sign in to save plants and see them here. <a class="favlink" href="signin.html">Sign in →</a>';
    grid.innerHTML=''; return;
  }
  var favs=SEED.filter(function(p){ return window.Account.isFavorite(slugOf(p)); })
    .sort(function(a,b){ return a.botanical.localeCompare(b.botanical,'en',{sensitivity:'base'}); });
  if(!favs.length){
    state.innerHTML='No saved plants yet — browse <a class="favlink" href="index.html">the herbarium</a> and tap the ♥ on any plant.';
    grid.innerHTML=''; return;
  }
  state.textContent=favs.length+(favs.length===1?' saved plant':' saved plants');
  grid.innerHTML='<div class="grid">'+favs.map(cardHTML).join('')+'</div>';
  wireReels(grid);
}

/* lightbox is delegated on the stable #favGrid once; wireReels re-runs per render */
wireLightbox(grid);
window.Account.ready()
  .then(loadSeed)
  .then(function(){ render(); window.Account.onChange(render); });
})();
