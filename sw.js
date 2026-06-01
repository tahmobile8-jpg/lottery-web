const CACHE_NAME = 'huay-cloud-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js'
];

// ຕິດ​ຕັ້ງ Service Worker ແລະ Cache ໄຟລ໌ຄົງທີ່
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
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
    })
  );
});

// ດຶງຂໍ້ມູນ (Network First ໄປຫາ Cache ຖ້າ Offline)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});