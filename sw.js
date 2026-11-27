/* Лист матча: работа без сети.
   Страница: сначала сеть (3 секунды), нет сети — из памяти браузера. Так правки приходят сразу.
   Шрифты и значки: из памяти браузера. */
const CACHE_VERSION='0da99ecc834fe1ad265fcff90fe13d2abb42a975c7c4233409b8cf6ff56189ad'; // При публикации сюда подставляется хеш файлов сайта.
const PREFIX='list-matcha:'+self.registration.scope+':';
const C=PREFIX+CACHE_VERSION;
const FILES=['./','otchet.html','league-penalties.js','season-history.js','season.css','season.js','season-export.js','season-xlsx.js','logos/382.png','manifest.webmanifest','icon-192.png','icon-512.png','fonts/Onest-cyrillic.woff2','fonts/Onest-latin.woff2','fonts/JetBrainsMono-cyrillic.woff2','fonts/JetBrainsMono-latin.woff2'];
const freshRequest=file=>new Request(new URL(file,self.registration.scope),{cache:'reload'});
async function installFiles(){
  const manifest=freshRequest('protocols/index.json');
  const response=await fetch(manifest);
  if(!response.ok)throw new Error('Не загружен список протоколов ВХЛ');
  const ids=await response.clone().json();
  if(!Array.isArray(ids)||!ids.length||!ids.every(id=>Number.isSafeInteger(id)&&id>0)||new Set(ids).size!==ids.length)
    throw new Error('Некорректный список протоколов ВХЛ');
  const cache=await caches.open(C);
  await cache.addAll([...FILES,...ids.map(id=>'protocols/'+id+'.html')].map(freshRequest));
  await cache.put(manifest,response);
  await self.skipWaiting();
}
self.addEventListener('install',e=>e.waitUntil(installFiles()));
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&(x.startsWith(PREFIX)||/^list-matcha-v[1-3]$/.test(x))).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method!=='GET'||!u.href.startsWith(self.registration.scope))return;
  const dir=new URL(self.registration.scope).pathname;
  const rep=u.pathname===dir+'otchet.html';
  const page=rep||u.pathname===dir||u.pathname===dir+'index.html';
  const scope=new URL(rep?'otchet.html':'./',self.registration.scope).href;
  e.respondWith(caches.open(C).then(async c=>{
    if(page){
      const cached=()=>c.match(scope);
      try{const r=await Promise.race([fetch(e.request,{cache:'no-store'}),new Promise((_,no)=>setTimeout(no,3000))]);
        if(r&&r.ok){c.put(scope,r.clone());return r} return (await cached())||r}
      catch(_){return (await cached())||fetch(e.request)}
    }
    const hit=await c.match(e.request,{ignoreSearch:true}); if(hit)return hit;
    const r=await fetch(e.request); if(r.ok)c.put(e.request,r.clone()); return r}))});
