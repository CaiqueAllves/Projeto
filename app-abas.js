// ========================================
// ABAS POR MÓDULO (app.html)
// ========================================
// Cada aba é um MÓDULO (Operacional, Comercial, Financeiro, Configurações) —
// os mesmos do seletor do menu lateral. A aba guarda a tela em que você está
// naquele módulo (um <iframe> que fica vivo: trocar de módulo não recarrega
// nada). Clicar num item do menu navega a tela dentro da aba do módulo dele;
// trocar de módulo (aba ou seletor do menu) mostra a aba correspondente,
// abrindo-a na primeira tela do módulo se ainda não estiver aberta.

const ABAS_CHAVE = 'abas_abertas_v2';
const MODULOS_ABA = {
    operacional:   { nome: 'Operacional',   icone: 'fa-solid fa-cubes' },
    comercial:     { nome: 'Comercial',     icone: 'fa-solid fa-handshake' },
    financeiro:    { nome: 'Financeiro',    icone: 'fa-solid fa-coins' },
    configuracoes: { nome: 'Configurações', icone: 'fa-solid fa-sliders' },
};

let _abas = [];        // { id, modulo, url, titulo, iframe, el }
let _abaAtiva = null;
let _abaSeq = 0;
let _abaTrocando = false;

const _abaArquivo = url => { try { return new URL(url, location.href).pathname.split('/').pop().toLowerCase(); } catch { return String(url).split('?')[0].toLowerCase(); } };
const _abaRelativa = url => { try { const u = new URL(url, location.href); return u.pathname.split('/').pop() + u.search; } catch { return url; } };
const _abaModuloDaPagina = url => (typeof _MODULO_PAGINAS !== 'undefined' && _MODULO_PAGINAS[_abaArquivo(url)]) || 'operacional';

function _abaSalvar() {
    try {
        sessionStorage.setItem(ABAS_CHAVE, JSON.stringify({ abas: _abas.map(a => ({ m: a.modulo, u: a.url })), ativa: _abas.findIndex(a => a.id === _abaAtiva) }));
    } catch {}
}

// Primeira tela do menu do módulo (Início no Operacional, etc.)
function _abaTelaInicialDoModulo(mod) {
    const li = document.querySelector(`#mod-${mod} li[onclick*="location.href"]`);
    const m = li && /location\.href\s*=\s*'([^']+)'/.exec(li.getAttribute('onclick'));
    return m ? m[1] : 'inicio.html';
}

// Abre (ou traz pra frente) a aba do módulo; com `url`, navega a aba pra essa tela.
function abrirModulo(mod, url = null, ativar = true) {
    if (!MODULOS_ABA[mod]) mod = 'operacional';
    let aba = _abas.find(a => a.modulo === mod);
    const alvo = _abaRelativa(url || (aba ? aba.url : _abaTelaInicialDoModulo(mod)));

    if (!aba) {
        const id = 'aba-' + (++_abaSeq);
        const iframe = document.createElement('iframe');
        iframe.className = 'abas-frame';
        iframe.style.display = 'none';

        const el = document.createElement('div');
        el.className = 'aba carregando';
        el.setAttribute('role', 'tab');
        el.dataset.id = id;
        el.innerHTML = '<i class="aba-icone"></i><span class="aba-titulo"></span><button class="aba-fechar" title="Fechar aba"><i class="fa-solid fa-xmark"></i></button>';
        el.querySelector('.aba-icone').className = 'aba-icone ' + MODULOS_ABA[mod].icone;
        el.querySelector('.aba-titulo').textContent = MODULOS_ABA[mod].nome;

        aba = { id, modulo: mod, url: alvo, titulo: MODULOS_ABA[mod].nome, iframe, el };
        _abas.push(aba);
        // mantém a ordem fixa dos módulos na barra
        _abas.sort((a, b) => Object.keys(MODULOS_ABA).indexOf(a.modulo) - Object.keys(MODULOS_ABA).indexOf(b.modulo));
        document.getElementById('abasArea').appendChild(iframe);
        const barra = document.getElementById('abasBarra');
        const posterior = _abas[_abas.indexOf(aba) + 1];
        barra.insertBefore(el, posterior ? posterior.el : null);

        el.addEventListener('click', e => { if (e.target.closest('.aba-fechar')) fecharAba(id); else abrirModulo(mod); });
        el.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); fecharAba(id); } });
        iframe.addEventListener('load', () => _abaAoCarregar(aba));
        iframe.src = alvo;
    } else if (url && _abaRelativa(aba.url) !== alvo) {
        aba.el.classList.add('carregando');
        aba.url = alvo;
        aba.iframe.src = alvo;
    }

    if (ativar) ativarAba(aba.id); else _abaSalvar();
    return aba;
}

// Compatibilidade (suporte.js e telas): abre a tela no módulo a que ela pertence
function abrirAba(url) { return abrirModulo(_abaModuloDaPagina(url), url); }

function _abaAoCarregar(aba) {
    try {
        const w = aba.iframe.contentWindow;
        const arquivo = w.location.pathname.split('/').pop().toLowerCase();
        if (arquivo === 'login.html') { window.location.href = w.location.href; return; } // sessão caiu: sai do app inteiro
        aba.url = arquivo + w.location.search;
        const h2 = w.document.querySelector('.topbar-left h2');
        aba.titulo = (h2 ? h2.textContent : (w.document.title || arquivo)).replace(/\s+/g, ' ').trim() || arquivo;
        w.document.documentElement.dataset.abaInativa = aba.id === _abaAtiva ? '0' : '1';
    } catch { /* outra origem: mantém o que tem */ }
    aba.el.classList.remove('carregando');
    aba.el.title = MODULOS_ABA[aba.modulo].nome + ' — ' + aba.titulo;
    if (aba.id === _abaAtiva) _abaAtualizarTopo(aba);
    _abaSalvar();
}

function _abaAtualizarTopo(aba) {
    const h2 = document.getElementById('abasTitulo');
    const h2Iframe = (() => { try { return aba.iframe.contentWindow.document.querySelector('.topbar-left h2 i')?.className; } catch { return null; } })();
    h2.innerHTML = '';
    const i = document.createElement('i'); i.className = h2Iframe || MODULOS_ABA[aba.modulo].icone;
    h2.appendChild(i); h2.appendChild(document.createTextNode(' ' + aba.titulo));
    document.title = 'Marpex | ' + aba.titulo;

    // Menu lateral: mostra o módulo da aba e destaca a tela atual (navegador.js lê estas variáveis)
    const u = new URL(aba.url, location.href);
    window.__navPagina = u.pathname.split('/').pop();
    window.__navBusca = u.search;
    _abaTrocando = true;
    try { if (typeof _setModuloOriginal === 'function') _setModuloOriginal(aba.modulo); } finally { _abaTrocando = false; }
    if (typeof destacarInicio === 'function') destacarInicio();
}

function ativarAba(id) {
    const aba = _abas.find(a => a.id === id);
    if (!aba) return;
    _abaAtiva = id;
    _abas.forEach(a => {
        const ativa = a.id === id;
        a.el.classList.toggle('ativa', ativa);
        a.el.setAttribute('aria-selected', ativa ? 'true' : 'false');
        a.iframe.style.display = ativa ? '' : 'none';
        try { a.iframe.contentWindow.document.documentElement.dataset.abaInativa = ativa ? '0' : '1'; } catch {}
    });
    aba.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    _abaAtualizarTopo(aba);
    _abaSalvar();
}

function fecharAba(id) {
    const i = _abas.findIndex(a => a.id === id);
    if (i < 0) return;
    const [aba] = _abas.splice(i, 1);
    aba.iframe.remove();
    aba.el.remove();
    if (_abas.length === 0) { abrirModulo('operacional'); return; }
    if (_abaAtiva === id) ativarAba((_abas[i] || _abas[i - 1]).id);
    else _abaSalvar();
}

// ── Seletor de módulo do menu lateral = trocar de aba ──────────────────────
const _setModuloOriginal = window.setModulo;
let _abaIniciado = false; // o navegador.js chama setModulo() na carga — antes de restaurar as abas isso não pode criar aba
window.setModulo = function (mod) {
    _setModuloOriginal(mod);
    if (_abaIniciado && !_abaTrocando) abrirModulo(mod);
};

// ── Cliques do menu lateral navegam a tela dentro da aba do módulo ─────────
document.addEventListener('click', e => {
    const item = e.target.closest('aside li[onclick], aside a[href]');
    if (!item) return;
    let destino = null;
    const oc = item.getAttribute('onclick') || '';
    const m = /location\.href\s*=\s*'([^']+)'/.exec(oc);
    if (m) destino = m[1];
    else if (item.tagName === 'A') { const h = item.getAttribute('href'); if (h && h !== '#') destino = h; }
    if (!destino) return;
    e.preventDefault();
    e.stopPropagation();          // impede o onclick original (que navegaria a página inteira)
    const secao = item.closest('.mod-section');
    const mod = secao ? secao.id.replace('mod-', '') : (_abas.find(a => a.id === _abaAtiva)?.modulo || 'operacional');
    abrirModulo(mod, destino);
    if (typeof _fecharSidebarMobile === 'function') _fecharSidebarMobile();
}, true);

// ── Início ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const pedido = new URLSearchParams(location.search).get('abrir');
    let restaurou = false;
    try {
        const salvo = JSON.parse(sessionStorage.getItem(ABAS_CHAVE) || 'null');
        if (salvo?.abas?.length) {
            salvo.abas.forEach(a => abrirModulo(a.m, a.u, false));
            restaurou = true;
            const alvo = _abas.find(a => a.modulo === salvo.abas[salvo.ativa]?.m) || _abas[0];
            if (alvo) ativarAba(alvo.id);
        }
    } catch {}
    if (pedido) abrirAba(pedido);
    else if (!restaurou) abrirModulo('operacional');
    if (pedido) history.replaceState(null, '', 'app.html'); // tira ?abrir= da barra (evita reabrir ao dar F5)
    _abaIniciado = true;
});
