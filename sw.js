/* Exact public shell allowlist: authenticated responses never enter Cache Storage. */
const CACHE = 'autotrader-ui-v4';
const ASSETS = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
const urls = new Set(ASSETS.map(path => new URL(path,self.registration.scope).href));
self.addEventListener('install',event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
// A waiting worker activates when old tabs close, avoiding mixed versions mid-session.
self.addEventListener('activate',event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('autotrader-ui-') && key!==CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch',event => {
  if (event.request.method!=='GET' || !urls.has(event.request.url)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});
