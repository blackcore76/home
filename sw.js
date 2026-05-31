const CACHE='home-v3';
const SHELL=['/home/','/home/index.html','/home/icon-192.png','/home/icon-512.png','/home/favicon.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  clients.claim();
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // 외부 API 요청은 SW가 가로채지 않음 (Yahoo Finance, Anthropic 등)
  if(!e.request.url.startsWith(self.location.origin))return;
  e.respondWith(swr(e.request));
});

// Stale-While-Revalidate: 캐시 즉시 반환 + 백그라운드에서 네트워크 페치로 캐시 갱신
async function swr(req){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(req);
  const network=fetch(req).then(res=>{
    if(res&&res.ok)cache.put(req,res.clone()).catch(()=>{});
    return res;
  }).catch(()=>cached);
  return cached||network;
}
