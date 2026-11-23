const CACHE='west-vill-travel-v60';
const CORE=['./','./index.html','./manifest.webmanifest?v=7','./admin.css?v=27','./auth.js?v=36','./admin.js?v=32','./theme.js?v=1','./west-vill-logistica.jpg?v=7'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
    if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  }).catch(()=>caches.match(event.request).then(response=>response||caches.match('./index.html'))));
});