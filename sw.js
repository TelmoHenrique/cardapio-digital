/* Viéstec Gestor — service worker
   Guarda só a "casca" do sistema (a página, ícones e imagens) pra abrir rápido.
   Os números vêm sempre do banco (Supabase), nunca de cópia guardada.
   Ao mudar qualquer arquivo do site, troque a VERSAO pra forçar a atualização. */
const VERSAO = 'vg-2026-09-27-5';
const CASCA = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/login-hero.webp'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const LIBS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  if (url.origin !== location.origin && !LIBS.includes(url.hostname)) return; // Supabase (os dados): sempre direto da internet

  // Página: tenta a internet primeiro (pra pegar sempre a versão nova); sem internet, usa a guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const c = r.clone(); caches.open(VERSAO).then(ca => ca.put('/index.html', c)); return r; })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  // Ícones, imagens, fontes e bibliotecas: usa a guardada na hora e atualiza em segundo plano.
  e.respondWith(
    caches.match(req).then(guardada => {
      const rede = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSAO).then(ca => ca.put(req, c)); } return r; }).catch(() => guardada);
      return guardada || rede;
    })
  );
});
