/* Лист матча: работа без сети.
   Страница: сначала сеть (3 секунды), нет сети — из памяти браузера. Так правки приходят сразу.
   Шрифты и значки: из памяти браузера. */
const C='list-matcha-v3';
const FILES=['./','otchet.html','manifest.webmanifest','icon-192.png','icon-512.png','fonts/Onest-cyrillic.woff2','fonts/Onest-latin.woff2','fonts/JetBrainsMono-cyrillic.woff2','fonts/JetBrainsMono-latin.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  const rep=u.pathname.endsWith('otchet.html');   // отчёт открывается во вкладке программы: тоже «сначала сеть», но под своим ключом
  const page=rep||e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('index.html');
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
