
const CACHE='taxflow-uk-v2';
const CORE=['/index.html','/offline.html','/manifest.webmanifest','/assets/css/styles.css','/assets/js/tax-engine.js','/assets/js/site.js','/assets/icons/icon-192.png','/assets/icons/icon-512.png','/tools/index.html','/blog/index.html','/taxes/index.html','/tools/salary/index.html','/tools/vat/index.html','/tools/self-assessment/index.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Only successful same-origin responses are kept, so 404s and errors are never served from the cache.
const keep=(req,r)=>{if(r.ok&&r.type==='basic'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return r};
// Directory URLs such as /tools/vat/ are precached as /tools/vat/index.html.
const cached=req=>caches.match(req).then(r=>{if(r)return r;const p=new URL(req.url).pathname;return p.endsWith('/')?caches.match(p+'index.html'):undefined});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>keep(e.request,r)).catch(()=>cached(e.request).then(r=>r||caches.match('/offline.html'))));
    return;
  }
  // Network first, so updated rates in tax-engine.js reach returning visitors straight away; the cache is the offline fallback.
  if(url.origin===location.origin){
    e.respondWith(fetch(e.request).then(r=>keep(e.request,r)).catch(()=>cached(e.request).then(r=>r||Response.error())));
  }
});
