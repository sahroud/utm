const CACHE='sahroud-rtk-shell-v24';
const FILES=['./','./index.html','./manifest.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==location.origin)return;
  const isPage=event.request.mode==='navigate'||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/gps-rtk/');
  if(isPage){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));}
      return res;
    }).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(res=>{
    if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}
    return res;
  }).catch(()=>caches.match('./index.html'))));
});