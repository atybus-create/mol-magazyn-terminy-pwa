const CACHE='mol-magazyn-shell-v6';
const PREFIX='mol-magazyn-shell-';

const SHELL=[
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches
      .keys()
      .then(keys=>
        Promise.all(
          keys
            .filter(key=>key.startsWith(PREFIX)&&key!==CACHE)
            .map(key=>caches.delete(key))
        )
      )
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);

  // Nie przechwytujemy zapytań do n8n ani innych domen.
  if(url.origin!==self.location.origin)return;

  // Cache tylko dla GET.
  if(event.request.method!=='GET')return;

  // Nawigacja: najpierw sieć, offline fallback do index.html.
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();

          caches
            .open(CACHE)
            .then(cache=>cache.put('./index.html',copy));

          return response;
        })
        .catch(()=>caches.match('./index.html'))
    );

    return;
  }

  // Pozostałe pliki aplikacji: cache first.
  event.respondWith(
    caches
      .match(event.request)
      .then(cached=>{
        if(cached)return cached;

        return fetch(event.request)
          .then(response=>{
            const copy=response.clone();

            caches
              .open(CACHE)
              .then(cache=>cache.put(event.request,copy));

            return response;
          });
      })
  );
});
