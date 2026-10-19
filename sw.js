// Service worker do app Marpex (PWA)
//
// Estratégia "rede primeiro": com internet, tudo vem do servidor como sempre
// (nenhuma tela fica velha — o versionar.js continua valendo). A cópia em
// cache só é usada quando a rede falha; sem cópia, telas mostram offline.html.
// Só arquivos do próprio site entram no cache — Supabase e CDNs não.
//
// Ao mudar este arquivo, suba VERSAO para descartar o cache antigo.
const VERSAO = 'marpex-v2';
const MAX_ITENS = 200;
const ESSENCIAIS = [
    'offline.html',
    'icons/icon-192.png',
    'icons/marpex.svg',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        for (const nome of await caches.keys()) if (nome !== VERSAO) await caches.delete(nome);
        await self.clients.claim();
    })());
});

// Poda o cache uma vez, alguns segundos depois da última gravação (podar a
// cada arquivo deixava o carregamento das telas lento)
let _podaTimer = null;
function agendarPoda() {
    clearTimeout(_podaTimer);
    _podaTimer = setTimeout(async () => {
        const cache = await caches.open(VERSAO);
        const chaves = await cache.keys();
        for (let i = 0; i < chaves.length - MAX_ITENS; i++) await cache.delete(chaves[i]);
    }, 5000);
}

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    e.respondWith((async () => {
        try {
            const resp = await fetch(req);
            if (resp.ok && resp.type === 'basic') {
                const copia = resp.clone();
                e.waitUntil(caches.open(VERSAO).then(c => c.put(req, copia)).then(agendarPoda).catch(() => {}));
            }
            return resp;
        } catch (err) {
            const salvo = await caches.match(req);
            if (salvo) return salvo;
            if (req.mode === 'navigate') return (await caches.match('offline.html')) || Response.error();
            return Response.error();
        }
    })());
});
