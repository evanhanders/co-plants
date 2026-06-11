/* signin.js — the standalone sign-in page (signin.html). Sends a magic-link via the shared
   Account API (auth.js); shows the signed-in state if you're already in. No Supabase here. */
(function(){
'use strict';
var form=document.getElementById('signinForm'),
    email=document.getElementById('signinEmail'),
    btn=document.getElementById('signinSend'),
    msg=document.getElementById('signinMsg'),
    intro=document.getElementById('signinIntro'),
    signed=document.getElementById('signedInState');

function showMsg(text, ok){ msg.hidden=false; msg.textContent=text; msg.className='auth-msg '+(ok?'ok':'err'); }

if(!(window.Account && window.Account.configured)){
  form.hidden=true; intro.hidden=true;
  showMsg('Accounts aren’t set up on this site yet.', false);
  return;
}

/* swap between the email form (signed out) and a "you're signed in" panel */
function refresh(){
  if(window.Account.isSignedIn()){
    var u=window.Account.user();
    form.hidden=true; intro.hidden=true; signed.hidden=false;
    signed.innerHTML='<p class="lead">You’re signed in as <b>'+ (window.esc?esc(u.email):u.email) +'</b>.</p>'+
      '<p><a class="detaillink" href="favorites.html">View your favourite plants →</a></p>'+
      '<button type="button" class="btn ghost" id="signinOut">Sign out</button>';
    var so=document.getElementById('signinOut'); if(so) so.onclick=function(){ window.Account.signOut(); };
  } else {
    form.hidden=false; intro.hidden=false; signed.hidden=true; signed.innerHTML='';
  }
}
window.Account.ready().then(refresh);
window.Account.onChange(refresh);

form.addEventListener('submit', function(e){
  e.preventDefault();
  var addr=(email.value||'').trim();
  if(!addr || addr.indexOf('@')<1){ showMsg('Please enter a valid email address.', false); email.focus(); return; }
  btn.disabled=true; btn.textContent='Sending…';
  window.Account.signIn(addr).then(function(r){
    if(r && r.error) throw r.error;
    showMsg('Check your inbox — we sent a sign-in link to '+addr+'. Open it on this device to finish signing in. (It may land in spam.)', true);
  }).catch(function(err){
    showMsg((err && err.message) || 'Something went wrong sending the link. Please try again in a moment.', false);
  }).then(function(){ btn.disabled=false; btn.textContent='Send me a sign-in link'; });
});
})();
