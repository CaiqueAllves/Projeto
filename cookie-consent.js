// ========================================
// AVISO DE COOKIES — index.html
// ========================================

(function () {
    const KEY = 'marpex_cookie_consent';
    const bar = document.getElementById('cookieBar');
    const modal = document.getElementById('cookieModal');
    if (!bar || !modal) return;

    if (localStorage.getItem(KEY)) {
        bar.classList.add('hidden');
    }

    function salvar(prefs) {
        localStorage.setItem(KEY, JSON.stringify({ ...prefs, data: new Date().toISOString() }));
        bar.classList.add('hidden');
        modal.classList.remove('open');
    }

    document.getElementById('cookieAcceptBtn').addEventListener('click', () => {
        salvar({ necessarios: true, analiticos: true, marketing: true });
    });

    document.getElementById('cookieRejectBtn').addEventListener('click', () => {
        salvar({ necessarios: true, analiticos: false, marketing: false });
    });

    document.getElementById('cookiePrefsBtn').addEventListener('click', () => {
        modal.classList.add('open');
    });

    document.getElementById('cookieModalCancel').addEventListener('click', () => {
        modal.classList.remove('open');
    });

    document.querySelectorAll('.cookie-switch[data-pref]').forEach(sw => {
        sw.addEventListener('click', () => sw.classList.toggle('on'));
    });

    document.getElementById('cookieModalSave').addEventListener('click', () => {
        salvar({
            necessarios: true,
            analiticos: document.querySelector('.cookie-switch[data-pref="analiticos"]').classList.contains('on'),
            marketing: document.querySelector('.cookie-switch[data-pref="marketing"]').classList.contains('on')
        });
    });
})();
