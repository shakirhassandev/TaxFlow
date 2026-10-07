
const CACHE='taxflow-uk-v1';
const CORE=['/index.html','/offline.html','/manifest.webmanifest','/assets/css/styles.css','/assets/js/tax-engine.js','/assets/js/site.js','/assets/icons/icon-192.png','/assets/icons/icon-512.png','/tools/index.html','/blog/index.html','/taxes/index.html','/tools/salary/index.html','/tools/vat/index.html','/tools/self-assessment/index.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/offline.html'))));
    return;
  }
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})));
  }
});
