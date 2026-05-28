const CACHE='home-v1';
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
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
