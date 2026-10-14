// ========================================
// FORMULÁRIOS NO CELULAR (≤ 768px)
// ========================================
// Formulários longos (Processo, Proforma, Produto, Empresa) ficavam uma
// rolagem sem fim no celular. Aqui, só no mobile:
//   - as seções começam recolhidas (menos a 1ª) e abrir uma fecha as outras;
//   - barra de atalhos fixa no topo com todas as seções da aba;
//   - os botões (Salvar etc.) ficam fixos no rodapé (CSS em style-mobile.css);
//   - se alguma validação rolar até um campo de seção fechada, ela abre.
// No computador nada muda.

(function () {
    const mq = window.matchMedia('(max-width: 768px)');
    const ehMobile = () => mq.matches;

    const abaAtiva = () => document.querySelector('.tab-content.active');
    // seções com título clicável que não estão escondidas (algumas aparecem só em certos casos)
    const secoes = aba => [...(aba?.querySelectorAll('.form-section') || [])]
        .filter(s => s.querySelector(':scope > .section-title') && getComputedStyle(s).display !== 'none');

    function abrir(sec, sozinha = true) {
        if (!sec) return;
        const aba = sec.closest('.tab-content');
        if (sozinha && ehMobile()) secoes(aba).forEach(s => { if (s !== sec) fechar(s); });
        sec.classList.add('active');
        const c = sec.querySelector(':scope > .section-content');
        if (c) c.style.display = 'block';
    }
    function fechar(sec) {
        sec.classList.remove('active');
        const c = sec.querySelector(':scope > .section-content');
        if (c) c.style.display = 'none';
    }

    function tituloCurto(sec) {
        const t = sec.querySelector(':scope > .section-title');
        return (t?.textContent || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    }

    // ── Barra de atalhos das seções ─────────────
    function montarNav() {
        document.querySelectorAll('.fm-nav').forEach(n => n.remove());
        if (!ehMobile()) return;
        const aba = abaAtiva();
        const lista = secoes(aba);
        if (lista.length < 3) return;
        const nav = document.createElement('div');
        nav.className = 'fm-nav';
        nav.innerHTML = lista.map((s, i) =>
            `<button type="button" class="fm-chip" data-i="${i}">${i + 1}. ${tituloCurto(s)}</button>`).join('');
        aba.prepend(nav);
        nav.addEventListener('click', e => {
            const b = e.target.closest('.fm-chip');
            if (!b) return;
            const sec = lista[Number(b.dataset.i)];
            abrir(sec);
            atualizarNav();
            const topo = sec.getBoundingClientRect().top + window.scrollY - (nav.offsetHeight + 80);
            window.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
        });
        atualizarNav();
    }

    function atualizarNav() {
        const nav = document.querySelector('.tab-content.active .fm-nav');
        if (!nav) return;
        const lista = secoes(abaAtiva());
        nav.querySelectorAll('.fm-chip').forEach(b => {
            const ativo = lista[Number(b.dataset.i)]?.classList.contains('active');
            b.classList.toggle('ativo', !!ativo);
            if (ativo) b.scrollIntoView({ block: 'nearest', inline: 'center' });
        });
    }

    // ── Estado inicial: só a 1ª seção aberta ────
    function recolherAba(aba) {
        if (!ehMobile() || !aba || aba.dataset.fmIniciada) return;
        aba.dataset.fmIniciada = '1';
        const lista = secoes(aba);
        lista.forEach((s, i) => (i === 0 ? abrir(s, false) : fechar(s)));
    }

    function iniciar() {
        document.body.classList.toggle('fm-ativo', ehMobile());
        if (!ehMobile()) return;
        recolherAba(abaAtiva());
        montarNav();
    }

    // Clique no título da seção: no mobile vira acordeão (abrir fecha as outras)
    document.addEventListener('click', e => {
        const t = e.target.closest('.form-section > .section-title');
        if (!t || !ehMobile()) return;
        const sec = t.closest('.form-section');
        // toggleSection() (formularios.js) já alternou esta seção no onclick
        setTimeout(() => {
            if (sec.classList.contains('active')) {
                secoes(sec.closest('.tab-content')).forEach(s => { if (s !== sec) fechar(s); });
                const topo = sec.getBoundingClientRect().top + window.scrollY - 130;
                if (sec.getBoundingClientRect().top < 0) window.scrollTo({ top: topo, behavior: 'smooth' });
            }
            atualizarNav();
        }, 0);
    });

    // Troca de aba (Empresa / Processo / Proforma / Produto)
    const mudarTabOriginal = window.mudarTab;
    if (typeof mudarTabOriginal === 'function') {
        window.mudarTab = function (tabId) {
            mudarTabOriginal(tabId);
            if (ehMobile()) { recolherAba(abaAtiva()); montarNav(); }
        };
    }

    // Validação rolando até um campo dentro de seção fechada: abre a seção
    const scrollOriginal = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
        if (ehMobile()) {
            const sec = this.closest?.('.form-section');
            if (sec && !sec.classList.contains('active') && !this.classList?.contains('section-title')) {
                abrir(sec);
                atualizarNav();
            }
        }
        return scrollOriginal.apply(this, args);
    };

    mq.addEventListener?.('change', () => { document.querySelectorAll('.fm-nav').forEach(n => n.remove()); iniciar(); });

    // espera o carregamento inicial do formulário (edição/duplicação abrem seções)
    if (document.readyState === 'complete') setTimeout(iniciar, 800);
    else window.addEventListener('load', () => setTimeout(iniciar, 800));
})();
