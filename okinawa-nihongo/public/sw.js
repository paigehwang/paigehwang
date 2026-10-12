// 츄라톡 오프라인 캐시: 컴퓨터 서버가 꺼져 있어도 표현집·따라 말하기·복습은 열리도록
const VERSION = "churatalk-v5";
const ASSETS = ["/", "/index.html", "/style.css", "/app.js", "/curriculum.js", "/kana.js", "/shisa.svg", "/manifest.webmanifest", "/icon-180.png", "/icon-512.png", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) return; // 회화 API는 항상 네트워크

  if (url.origin === location.origin) {
    // 네트워크 우선 (업데이트 반영) → 실패하면 캐시
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            const key = req.mode === "navigate" ? "/index.html" : url.pathname;
            caches.open(VERSION).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req.mode === "navigate" ? "/index.html" : url.pathname)) || (await caches.match(req, { ignoreSearch: true })) || Response.error())
    );
    return;
  }

  // 외부 폰트 등: 캐시 우선
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
