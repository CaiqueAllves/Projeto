// ========================================
// TERMOS E POLÍTICAS — JAVASCRIPT
// ========================================

function mudarTab(tabId) {
    // Desativar todas as tabs e conteúdos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Ativar a tab e conteúdo selecionados
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Atualizar a URL sem recarregar
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url);
}

// Abrir tab pela URL (ex: termos.html?tab=privacidade)
document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && document.getElementById(`tab-${tab}`)) {
        mudarTab(tab);
    }
});

// Versão e data vêm de um lugar só (TERMOS_VERSAO/TERMOS_DATA em supabase-api.js),
// a mesma versão que o sistema pede para aceitar (auth.js).
document.addEventListener('DOMContentLoaded', function () {
    if (typeof TERMOS_VERSAO !== 'undefined') document.querySelectorAll('[data-termos-versao]').forEach(el => { el.textContent = TERMOS_VERSAO; });
    if (typeof TERMOS_DATA !== 'undefined') document.querySelectorAll('[data-termos-data]').forEach(el => { el.textContent = TERMOS_DATA; });
});
