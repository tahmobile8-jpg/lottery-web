const CACHE_NAME = 'huay-cloud-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  // Firebase SDK — cache ສຳລັບ offline fallback
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;700&display=swap'
];

// ຕິດຕັ້ງ Service Worker ແລະ Cache ໄຟລ໌ຄົງທີ່
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // ໃຊ້ addAll ຕໍ່ local assets, fetch ດ້ວຍ no-cors ຕໍ່ CDN
      return cache.addAll(['./', './index.html', './style.css', './app.js', './manifest.json'])
        .then(() => {
          // Cache Firebase CDN (best-effort, no-cors)
          const cdnUrls = [
            'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js',
            'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js',
            'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js',
          ];
          return Promise.allSettled(
            cdnUrls.map(url =>
              fetch(url, { mode: 'no-cors' })
                .then(res => cache.put(url, res))
                .catch(() => {})
            )
          );
        });
    })
  );
  self.skipWaiting();
});

// ລຶບ Cache ເກົ່າອອກເມື່ອມີການອັບເດດເວີຊັນ
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network First → Cache fallback (offline-safe)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache response ໃໝ່ສຳລັບ local files
        if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
