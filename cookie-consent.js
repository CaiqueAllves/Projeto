// ========================================
// AVISO DE COOKIES — index.html
// ========================================
//
// Usa delegação de evento (um único listener em document, olhando o alvo do
// clique) em vez de um addEventListener por botão. Isso evita que um erro
// isolado (ex: um elemento não encontrado) travando a montagem de UM
// listener derrube todos os outros que viriam depois dele no script.

(function () {
    const KEY = 'marpex_cookie_consent';

    function elBar()   { return document.getElementById('cookieBar'); }
    function elModal() { return document.getElementById('cookieModal'); }

    try {
        if (localStorage.getItem(KEY)) {
            elBar()?.classList.add('hidden');
        }
    } catch (e) { console.warn('Não foi possível ler o consentimento de cookies salvo:', e); }

    function salvar(prefs) {
        try {
            localStorage.setItem(KEY, JSON.stringify({ ...prefs, data: new Date().toISOString() }));
        } catch (e) { console.warn('Não foi possível salvar o consentimento de cookies:', e); }
        elBar()?.classList.add('hidden');
        elModal()?.classList.remove('open');
    }

    document.addEventListener('click', function (e) {
        if (e.target.closest('#cookieAcceptBtn')) {
            salvar({ necessarios: true, analiticos: true, marketing: true });
            return;
        }
        if (e.target.closest('#cookieRejectBtn')) {
            salvar({ necessarios: true, analiticos: false, marketing: false });
            return;
        }
        if (e.target.closest('#cookiePrefsBtn')) {
            elModal()?.classList.add('open');
            return;
        }
        if (e.target.closest('#cookieModalCancel')) {
            elModal()?.classList.remove('open');
            return;
        }
        const switchEl = e.target.closest('.cookie-switch[data-pref]');
        if (switchEl) {
            switchEl.classList.toggle('on');
            return;
        }
        if (e.target.closest('#cookieModalSave')) {
            salvar({
                necessarios: true,
                analiticos: !!document.querySelector('.cookie-switch[data-pref="analiticos"]')?.classList.contains('on'),
                marketing: !!document.querySelector('.cookie-switch[data-pref="marketing"]')?.classList.contains('on'),
            });
        }
    });
})();
