import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices['Pixel 5'] })).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
async function card(q){
  await p.goto('http://localhost:8098/index.html?_='+Date.now()+'#q='+encodeURIComponent(q), {waitUntil:'networkidle'});
  await p.reload({waitUntil:'networkidle'});
  await p.waitForSelector('.card',{timeout:20000}); await p.waitForTimeout(600);
  return await p.evaluate(()=>{
    const c=document.querySelector('.card'); if(!c) return null;
    return {title:(c.querySelector('h2,h3,.name,strong')||{}).textContent?.trim(),
      n:document.querySelectorAll('.card').length,
      spreads:[...c.querySelectorAll('.flag')].some(f=>/Spreads/i.test(f.textContent)),
      flags:[...c.querySelectorAll('.flag')].map(f=>f.textContent.trim()).join(' · ')};
  });
}
for (const q of ['butterfly milkweed','fernleaf yarrow','red currant','woolly yarrow','white prairie aster','kinnikinnick']){
  const r=await card(q);
  console.log(`${(r.title||'?').padEnd(24)} SPREADS ${r.spreads?'ON ':'off'}   [${r.flags}]`);
}
await p.goto('http://localhost:8098/index.html?_='+Date.now()+'#trait=spreads',{waitUntil:'networkidle'});
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1200);
console.log('\nTraits>Spreads legend:', (await p.locator('#legend, .legend').first().innerText()).replace(/\n/g,' | '));
console.log('pageerrors:', errs.length?errs.slice(0,3):'none');
await b.close();
