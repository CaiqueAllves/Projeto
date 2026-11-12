// ========================================
// EMPRESAS E PLANOS — painel do dono da Marpex (Central de Chamados)
// ========================================
// Lista todas as empresas com plano, vagas extras e usuários ativos, e permite
// trocar o plano e as vagas extras sem SQL. Quem pode: só a conta da Central
// (auth_is_suporte_admin no banco — admin_listar_empresas / admin_definir_plano,
// database-usuarios-pelo-servidor.sql). Visual reaproveita a janela .cl-* (style-base.css).

const EP_PLANOS = [
    ['free', 'Gratuito — 2 usuários'],
    ['basico', 'Básico — 1 usuário'],
    ['regular', 'Regular — 3 usuários'],
    ['profissional', 'Profissional — 5 usuários'],
    ['empresa', 'Empresa — sem limite'],
];
let _epEmpresas = [];

async function abrirEmpresasPlanos() {
    document.getElementById('epOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'epOverlay';
    ov.className = 'cl-overlay';
    ov.innerHTML = `
        <div class="cl-janela" role="dialog" aria-modal="true" aria-labelledby="epTitulo">
            <div class="cl-cab">
                <h3 id="epTitulo"><i class="fa-solid fa-building-user"></i> Empresas e planos</h3>
                <button type="button" class="cl-fechar" title="Fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="cl-filtros">
                <label class="cl-filtro"><span class="rotulo">Buscar</span>
                    <input type="search" id="epBusca" placeholder="Empresa, CNPJ ou administrador" style="padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;min-width:240px">
                </label>
                <span class="cl-resumo" id="epResumo"></span>
            </div>
            <p class="cl-ajuda"><i class="fa-solid fa-circle-info"></i> Só usuários ativos contam no limite. Vagas extras somam ao plano (combinadas à parte, sem trocar de plano).</p>
            <div class="cl-lista" id="epLista"><div class="cl-vazio"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div></div>
        </div>`;
    document.body.appendChild(ov);
    const fechar = () => { document.removeEventListener('keydown', esc, true); ov.remove(); };
    const esc = e => { if (e.key === 'Escape' && !document.querySelector('.confirmar-overlay')) fechar(); };
    document.addEventListener('keydown', esc, true);
    ov.querySelector('.cl-fechar').addEventListener('click', fechar);
    ov.addEventListener('mousedown', e => { if (e.target === ov) fechar(); });
    ov.querySelector('#epBusca').addEventListener('input', _epRenderizar);
    ov.querySelector('#epLista').addEventListener('click', _epSalvar);
    await _epCarregar();
}

async function _epCarregar() {
    const { data, error } = await supabaseClient.rpc('admin_listar_empresas');
    const box = document.getElementById('epLista');
    if (error) {
        box.innerHTML = `<div class="cl-vazio">${/admin_listar_empresas|PGRST202/i.test(error.message)
            ? 'Rode no Supabase o database/database-usuarios-pelo-servidor.sql para ativar este painel.'
            : 'Não foi possível carregar: ' + escHtml(error.message)}</div>`;
        return;
    }
    _epEmpresas = data || [];
    _epRenderizar();
}

function _epRenderizar() {
    const box = document.getElementById('epLista');
    if (!box) return;
    const sem = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = sem(document.getElementById('epBusca')?.value);
    const lista = _epEmpresas.filter(e => !q || sem(`${e.razao_social} ${e.cnpj} ${e.administrador}`).includes(q));
    document.getElementById('epResumo').textContent = `${lista.length} de ${_epEmpresas.length} empresa(s)`;
    if (!lista.length) { box.innerHTML = '<div class="cl-vazio"><i class="fa-regular fa-folder-open"></i> Nenhuma empresa encontrada.</div>'; return; }
    box.innerHTML = lista.map(e => {
        const cheio = e.usuarios_ativos >= e.limite;
        const limiteTxt = e.limite >= 100000 ? 'sem limite' : `${e.limite}`;
        const criada = e.criado_em ? new Date(e.criado_em).toLocaleDateString('pt-BR') : '—';
        // Gratuito: 15 dias e depois modo só leitura (database-gratuito-15-dias.sql)
        const gratis = e.plano === 'free' && e.status !== 'sandbox';
        const vence = gratis && e.expira_em ? new Date(e.expira_em) : null;
        const dias = vence ? Math.ceil((vence - new Date()) / 864e5) : null;
        const prazo = !gratis ? '' : !vence ? '<span class="cl-sit cl-sit-prevista">Gratuito sem prazo</span>'
            : dias <= 0 ? `<span class="cl-sit cl-sit-vencida">Só leitura desde ${vence.toLocaleDateString('pt-BR')}</span>`
            : `<span class="cl-sit ${dias <= 3 ? 'cl-sit-vencida' : 'cl-sit-prevista'}">Gratuito até ${vence.toLocaleDateString('pt-BR')} (${dias} dia${dias > 1 ? 's' : ''})</span>`;
        return `
        <div class="cl-item" data-id="${escHtml(e.id)}">
            <div class="cl-item-topo">
                <span class="cl-desc">${escHtml(e.razao_social || '—')}</span>
                <span class="cl-sit ${cheio ? 'cl-sit-vencida' : 'cl-sit-baixada'}">${e.usuarios_ativos} de ${limiteTxt} ativo(s)</span>
            </div>
            ${prazo ? `<div>${prazo}</div>` : ''}
            <div class="cl-ref">${escHtml([e.cnpj && `CNPJ ${e.cnpj}`, e.administrador && `Admin: ${e.administrador}`, `criada em ${criada}`, e.usuarios_total > e.usuarios_ativos && `${e.usuarios_total - e.usuarios_ativos} desativado(s)`].filter(Boolean).join(' · '))}</div>
            <div class="cl-linha" style="align-items:flex-end">
                <label class="cl-filtro"><span class="rotulo">Plano</span>
                    <select data-campo="plano">${EP_PLANOS.map(([v, t]) => `<option value="${v}" ${v === e.plano ? 'selected' : ''}>${t}</option>`).join('')}</select>
                </label>
                <label class="cl-filtro"><span class="rotulo">Vagas extras</span>
                    <input type="number" data-campo="extras" min="0" max="1000" step="1" value="${Number(e.usuarios_extras_pagos) || 0}" style="width:90px;padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px">
                </label>
                <button type="button" class="cl-btn" data-acao="salvar"><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
                ${gratis ? '<button type="button" class="cl-btn" data-acao="prorrogar" title="Mais dias de Gratuito (tira do modo só leitura)"><i class="fa-solid fa-clock-rotate-left"></i> Prorrogar</button>' : ''}
            </div>
        </div>`;
    }).join('');
}

async function _epSalvar(ev) {
    const btnProrrogar = ev.target.closest('button[data-acao="prorrogar"]');
    if (btnProrrogar) return _epProrrogar(btnProrrogar);
    const btn = ev.target.closest('button[data-acao="salvar"]');
    if (!btn) return;
    const card = btn.closest('.cl-item');
    const emp = _epEmpresas.find(x => x.id === card.dataset.id);
    const plano = card.querySelector('[data-campo="plano"]').value;
    const extras = Math.max(0, parseInt(card.querySelector('[data-campo="extras"]').value, 10) || 0);
    if (emp && plano === emp.plano && extras === Number(emp.usuarios_extras_pagos || 0)) { mostrarNotificacao('Nada mudou.', 'info'); return; }
    const nomePlano = (EP_PLANOS.find(p => p[0] === plano) || [])[1] || plano;
    const ok = await confirmarAcao(`${emp?.razao_social || 'Empresa'}: plano ${nomePlano}${extras ? ` + ${extras} vaga(s) extra(s)` : ''}?`,
        { titulo: 'Alterar plano', confirmar: 'Salvar' });
    if (!ok) return;
    btn.disabled = true;
    const { data, error } = await supabaseClient.rpc('admin_definir_plano', { p_empresa: card.dataset.id, p_plano: plano, p_extras: extras });
    btn.disabled = false;
    if (error || !data?.sucesso) { mostrarNotificacao('Não foi possível salvar: ' + (error?.message || data?.mensagem || ''), 'erro'); return; }
    mostrarNotificacao('Plano atualizado.', 'sucesso');
    await _epCarregar();
}

// Prorrogar o Gratuito: +N dias a partir do vencimento (ou de hoje, se já venceu)
async function _epProrrogar(btn) {
    const card = btn.closest('.cl-item');
    const emp = _epEmpresas.find(x => x.id === card.dataset.id);
    const escolha = await escolherAcao(`Prorrogar o período gratuito de ${emp?.razao_social || 'empresa'}?`, {
        titulo: 'Prorrogar Gratuito',
        opcoes: [
            { valor: 7,  texto: '+ 7 dias' },
            { valor: 15, texto: '+ 15 dias', descricao: 'um novo período completo' },
            { valor: 30, texto: '+ 30 dias' },
        ],
    });
    if (!escolha) return;
    btn.disabled = true;
    const { data, error } = await supabaseClient.rpc('admin_prorrogar_avaliacao', { p_empresa: card.dataset.id, p_dias: escolha });
    btn.disabled = false;
    if (error || !data?.sucesso) { mostrarNotificacao('Não foi possível prorrogar: ' + (error?.message || data?.mensagem || ''), 'erro'); return; }
    mostrarNotificacao(`Gratuito prorrogado até ${new Date(data.expira_em).toLocaleDateString('pt-BR')}.`, 'sucesso');
    await _epCarregar();
}
