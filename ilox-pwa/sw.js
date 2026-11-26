const CACHE='west-vill-travel-v144';
const CORE=['./','./index.html','./manifest.webmanifest?v=7','./admin.css?v=73','./auth.js?v=86','./admin.js?v=83','./theme.js?v=2','./west-vill-logistica.jpg?v=7'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('west-vill-travel-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data==='WEST_VILL_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(request,{cache:'no-store'});
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    }catch(error){
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate')return caches.match('./index.html');
      throw error;
    }
  })());
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
