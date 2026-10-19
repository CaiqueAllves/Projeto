// App Marpex (PWA): registra o service worker, oferece "Instalar app" e
// ajusta a navegação quando o sistema roda instalado (tela cheia).
//
// No app instalado não há abas: window.open(..., '_blank') de uma tela do
// sistema abriria fora do app (navegador/aba solta, às vezes sem a sessão).
// Então, só no modo app, telas .html do próprio site abrem na mesma janela,
// e window.close() / "voltar" dos formulários viram history.back().
(function () {
    const modoApp = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    window.pwaModoApp = modoApp;

    // ── Service worker ─────────────────────────────────────────────
    // Fora do ar no Codespaces (porta encaminhada *.app.github.dev): lá cada
    // pedido passa pelo login do GitHub e o service worker só atrapalha.
    const ambienteDev = /\.app\.github\.dev$|\.github\.dev$/.test(location.hostname);
    if ('serviceWorker' in navigator && ambienteDev) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    } else if ('serviceWorker' in navigator && window.top === window
        && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }

    // ── Navegação no modo app ─────────────────────────────────────
    if (modoApp) {
        const telaDoSistema = (url) => {
            try {
                const u = new URL(url, location.href);
                return u.origin === location.origin && /\.html$/i.test(u.pathname) ? u.href : null;
            } catch (e) { return null; }
        };

        const abrirOriginal = window.open.bind(window);
        window.open = function (url, alvo, recursos) {
            const tela = url && telaDoSistema(url);
            if (tela && alvo !== '_self') { location.href = tela; return window; }
            return abrirOriginal(url, alvo, recursos);
        };

        // <a target="_blank"> para tela do sistema também fica no app
        document.addEventListener('click', (ev) => {
            const a = ev.target.closest?.('a[target="_blank"]');
            if (!a || ev.defaultPrevented) return;
            const tela = telaDoSistema(a.getAttribute('href') || '');
            if (!tela) return;
            ev.preventDefault();
            location.href = tela;
        }, true);

        // fechar a "aba" do formulário = voltar (uma vez só, mesmo que
        // close() e history.back() sejam chamados em seguida)
        let voltando = false;
        const voltarOriginal = history.back.bind(history);
        const voltar = () => {
            if (voltando) return;
            voltando = true;
            setTimeout(() => { voltando = false; }, 1500);
            if (history.length > 1) voltarOriginal();
            else location.href = 'login.html';
        };
        const fecharOriginal = window.close.bind(window);
        window.close = function () { if (window.opener) return fecharOriginal(); voltar(); };
        history.back = voltar;

        // voltou pelo histórico com a tela congelada em cache: recarrega
        // para mostrar o que foi salvo no formulário
        window.addEventListener('pageshow', (ev) => { if (ev.persisted) location.reload(); });
    }

    // ── Instalar app ──────────────────────────────────────────────
    let pedidoInstalacao = null;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    function atualizarBotao() {
        const caixa = document.getElementById('pwaInstalar');
        if (!caixa) return;
        const podeInstalar = !modoApp && (pedidoInstalacao || ios);
        caixa.hidden = !podeInstalar;
    }

    window.addEventListener('beforeinstallprompt', (ev) => {
        ev.preventDefault();
        pedidoInstalacao = ev;
        atualizarBotao();
    });
    window.addEventListener('appinstalled', () => { pedidoInstalacao = null; atualizarBotao(); });

    window.pwaInstalar = async function () {
        if (pedidoInstalacao) {
            pedidoInstalacao.prompt();
            await pedidoInstalacao.userChoice.catch(() => {});
            pedidoInstalacao = null;
            atualizarBotao();
            return;
        }
        if (ios) {
            const dica = document.getElementById('pwaDicaIos');
            if (dica) dica.hidden = !dica.hidden;
        }
    };

    document.addEventListener('DOMContentLoaded', atualizarBotao);
})();
