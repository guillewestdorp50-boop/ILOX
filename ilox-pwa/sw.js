const CACHE='west-vill-travel-v137';
const CORE=['./','./index.html','./manifest.webmanifest?v=7','./admin.css?v=69','./auth.js?v=83','./admin.js?v=83','./theme.js?v=2','./west-vill-logistica.jpg?v=7'];
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
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{};}catch{}
 const options={body:data.body||'Administración te asignó un viaje.',icon:'./west-vill-logistica.jpg?v=7',badge:'./west-vill-logistica.jpg?v=7',tag:data.tag||('westvill-'+Date.now()),renotify:true,requireInteraction:false,silent:false,vibrate:[120,70,120,70,180],data:{url:data.url||'./?tab=viajes',trip_id:data.trip_id||null}};
 event.waitUntil((async()=>{await self.registration.showNotification(data.title||'¡Nuevo viaje asignado!',options);await new Promise(resolve=>setTimeout(resolve,10000));const active=await self.registration.getNotifications({tag:options.tag});active.forEach(notification=>notification.close());})());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const raw=event.notification.data?.url||'./?tab=viajes';let target=new URL(raw,self.location.origin);if(target.origin!==self.location.origin)target=new URL('./?tab=viajes',self.location.origin);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{for(const client of clients){if('navigate'in client)await client.navigate(target.href);if('focus'in client)return client.focus();}return self.clients.openWindow(target.href);}));
});
