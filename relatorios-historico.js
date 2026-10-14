// ========================================
// HISTÓRICO DE RELATÓRIOS GERADOS (comum a relatorios.js e relatorios-produtos.js)
// ========================================
// Fica no banco (relatorios_historico — database-melhorias-2026-10.sql), visível
// para a equipe toda. Sem a tabela, continua no navegador como antes.

const _relHist = { noBanco: null };

function _relHistLocal(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch { return []; }
}

async function relHistSalvar(modulo, chaveLocal, tipoNome, periodo) {
    const u = obterUsuarioLogado();
    const registro = { tipo: tipoNome, usuario: u?.nome || '—', dataGer: new Date().toISOString(), periodo: periodo || '—', formato: 'PDF' };
    if (_relHist.noBanco !== false && u?.empresa_id) {
        const { error } = await supabaseClient.from('relatorios_historico').insert({
            empresa_id: u.empresa_id, usuario_id: u.id, usuario_nome: u.nome || u.email || null,
            modulo, tipo: tipoNome, periodo: periodo || null, formato: 'PDF',
        });
        if (!error) { _relHist.noBanco = true; return relHistRender(modulo, chaveLocal); }
        _relHist.noBanco = false;
    }
    const lista = _relHistLocal(chaveLocal);
    lista.unshift({ id: Date.now(), ...registro });
    localStorage.setItem(chaveLocal, JSON.stringify(lista));
    relHistRender(modulo, chaveLocal);
}

async function relHistRender(modulo, chaveLocal) {
    const tbody = document.getElementById('historicoBody');
    if (!tbody) return;
    let lista = null;
    if (_relHist.noBanco !== false) {
        const { data, error } = await supabaseClient.from('relatorios_historico')
            .select('*').eq('modulo', modulo).order('criado_em', { ascending: false }).limit(100);
        if (!error) {
            _relHist.noBanco = true;
            // leva pro banco o que estava só no navegador
            const locais = _relHistLocal(chaveLocal);
            const u = obterUsuarioLogado();
            if (locais.length && u?.empresa_id) {
                const ins = await supabaseClient.from('relatorios_historico').insert(locais.map(r => ({
                    empresa_id: u.empresa_id, usuario_id: u.id, usuario_nome: r.usuario, modulo,
                    tipo: r.tipo, periodo: r.periodo, formato: r.formato || 'PDF', criado_em: r.dataGer,
                }))).select('*');
                if (!ins.error) { localStorage.removeItem(chaveLocal); data.unshift(...(ins.data || [])); }
            }
            lista = data.map(r => ({ id: r.id, tipo: r.tipo, usuario: r.usuario_nome || '—', dataGer: r.criado_em, periodo: r.periodo || '—' }));
        } else _relHist.noBanco = false;
    }
    if (!lista) lista = _relHistLocal(chaveLocal);

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:#94a3b8;font-size:13px;">
            <i class="fa-solid fa-clock-rotate-left" style="margin-right:8px;"></i> Nenhum relatório gerado ainda.</td></tr>`;
        return;
    }
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    tbody.innerHTML = lista.map(r => `
        <tr>
            <td>${esc(r.tipo)}</td>
            <td><span class="hist-usuario"><i class="fa-solid fa-user"></i> ${esc(r.usuario)}</span></td>
            <td>${new Date(r.dataGer).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
            <td><span class="hist-format pdf">PDF</span></td>
            <td>
                <div class="hist-actions">
                    <button class="hist-btn" title="Período: ${esc(r.periodo)}"><i class="fa-solid fa-calendar-days"></i></button>
                    <button class="hist-btn hist-btn-del" title="Remover do histórico" onclick="relHistRemover(${r.id}, '${modulo}', '${chaveLocal}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

async function relHistRemover(id, modulo, chaveLocal) {
    if (_relHist.noBanco) {
        const { error } = await supabaseClient.from('relatorios_historico').delete().eq('id', id);
        if (error) { mostrarNotificacao('Não foi possível remover: ' + error.message, 'error'); return; }
    } else {
        localStorage.setItem(chaveLocal, JSON.stringify(_relHistLocal(chaveLocal).filter(r => r.id !== id)));
    }
    relHistRender(modulo, chaveLocal);
}
