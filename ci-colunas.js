// ========================================
// COMMERCIAL INVOICE — escolha de colunas antes de gerar
// ========================================
// Cada Commercial Invoice tem particularidades (roupa: cor, tamanho,
// composição; bebida: teor alcoólico...). Antes de gerar, esta janela deixa
// escolher os campos, onde cada um aparece (coluna própria ou embaixo do
// produto) e corrigir o valor de cada item. Valores vêm do cadastro do
// Produto (campos fixos + características). A escolha fica no Processo
// (processos.documentos.ci_config) e pode virar modelo nomeado
// (documento_modelos — database-ci-colunas-modelos.sql).
// Usado por pdf-documentos.js (gerarEAnexarDocumentoProcesso).

const CI_MAX_COLUNAS = 4;   // colunas extras que cabem na folha em pé

// Campos do cadastro. t = chave do rótulo traduzido (pdf-kit.js → PDF_IDIOMAS)
const CI_CAMPOS_PADRAO = [
    { chave: 'ncm',        rotulo: 'NCM',               t: 'col_ncm',           posicao: 'abaixo' },
    { chave: 'hscode',     rotulo: 'HS Code',           t: 'col_hs',            posicao: 'abaixo' },
    { chave: 'fabricante', rotulo: 'Fabricante',        t: 'col_fabricante',    posicao: 'coluna' },
    { chave: 'composicao', rotulo: 'Composição',        t: 'col_composicao',    posicao: 'abaixo' },
    { chave: 'marca',      rotulo: 'Marca',             t: 'col_marca',         posicao: 'coluna' },
    { chave: 'gtin',       rotulo: 'GTIN / EAN',        t: 'col_gtin',          posicao: 'coluna' },
    { chave: 'lote',       rotulo: 'Lote',              t: 'col_lote',          posicao: 'coluna' },
    { chave: 'fabricacao', rotulo: 'Data de fabricação', t: 'col_fabricacao',   posicao: 'coluna' },
    { chave: 'validade',   rotulo: 'Validade',          t: 'col_validade',      posicao: 'coluna' },
    { chave: 'peso_unit',  rotulo: 'Peso líq. unitário', t: 'col_peso_liq_unit', posicao: 'coluna' },
];

// Escolha padrão: NCM e HS embaixo do produto; Fabricante e Composição como
// colunas (pedido do usuário, 2026-10-21 — também fixas no Packing List)
function ciConfigPadrao() {
    return { modelo_id: null, campos: [
        { chave: 'ncm', rotulo: 'NCM', origem: 'padrao', posicao: 'abaixo' },
        { chave: 'hscode', rotulo: 'HS Code', origem: 'padrao', posicao: 'abaixo' },
        { chave: 'fabricante', rotulo: 'Fabricante', origem: 'padrao', posicao: 'coluna' },
        { chave: 'composicao', rotulo: 'Composição', origem: 'padrao', posicao: 'coluna' },
    ], valores: {} };
}

const _ciNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Valor do campo para o item i (cadastro, ou o que foi corrigido na janela)
function ciValorCampo(d, it, i, campo, cfg, I) {
    const ajuste = cfg?.valores?.[i]?.[campo.chave];
    if (ajuste !== undefined && ajuste !== null) return String(ajuste);
    const p = d.produtos[it.produto_id] || {};
    const data = v => v ? (I ? I.data(v) : new Date(v + 'T00:00:00').toLocaleDateString('pt-BR')) : '';
    if (campo.origem === 'caracteristica') {
        const c = (Array.isArray(p.caracteristicas) ? p.caracteristicas : []).find(x => _ciNorm(x?.nome) === _ciNorm(campo.rotulo));
        return c?.valor || '';
    }
    if (campo.origem === 'personalizada') return '';
    switch (campo.chave) {
        case 'ncm': return p.ncm || '';
        case 'hscode': return p.hscode || '';
        case 'marca': return p.marca || '';
        case 'gtin': return p.gtin || '';
        case 'lote': return p.lote || '';
        case 'fabricacao': return data(p.data_fabricacao);
        case 'validade': return data(p.data_validade);
        case 'peso_unit': {
            const pl = Number(d.unitarias?.[it.produto_id]?.peso_liquido);
            return pl ? `${I ? I.num(pl, 3) : pl.toLocaleString('pt-BR')} kg` : '';
        }
        case 'fabricante': {
            const f = d.fabricantes?.[p.empresa_parceira_id];
            return f ? [f.razao_social || f.nome_fantasia, f.pais].filter(Boolean).join(' · ') : '';
        }
        case 'composicao':
            return (d.composicao?.[it.produto_id] || [])
                .map(c => [c.ingrediente || c.nome_tecnico, c.concentracao_pct != null ? `${Number(c.concentracao_pct).toLocaleString('pt-BR')}%` : ''].filter(Boolean).join(' '))
                .filter(Boolean).join(', ');
        default: return '';
    }
}

// Rótulo no idioma do documento (campos do cadastro); características e
// colunas criadas na hora saem como foram escritas
function ciRotulo(campo, t) {
    if (campo.origem === 'padrao') {
        const def = CI_CAMPOS_PADRAO.find(c => c.chave === campo.chave);
        return (def && t?.[def.t]) || campo.rotulo;
    }
    return campo.rotulo;
}

// ── Modelos (documento_modelos) ──
async function _ciModelos() {
    const u = obterUsuarioLogado();
    const { data, error } = await supabaseClient.from('documento_modelos')
        .select('id, nome, campos').eq('empresa_id', u.empresa_id).eq('tipo', 'commercial').order('nome');
    return error ? null : (data || []);   // null = tabela ainda não existe (SQL pendente)
}

// ── Janela ──
// Resolve com a configuração escolhida, ou null se cancelar.
async function ciAbrirJanelaColunas(processoId) {
    const d = await _docPdfCarregarDados('commercial', processoId);
    const salvo = d.proc.documentos?.ci_config;
    let cfg = salvo && Array.isArray(salvo.campos) ? JSON.parse(JSON.stringify(salvo)) : ciConfigPadrao();
    cfg.valores ||= {};
    let modelos = await _ciModelos();

    // características existentes nos produtos deste Processo
    const caracs = [];
    d.itens.forEach(it => (d.produtos[it.produto_id]?.caracteristicas || []).forEach(c => {
        if (c?.nome && !caracs.some(x => _ciNorm(x) === _ciNorm(c.nome))) caracs.push(c.nome.trim());
    }));

    return new Promise(resolve => {
        document.getElementById('ciJanela')?.remove();
        const ov = document.createElement('div');
        ov.id = 'ciJanela';
        ov.className = 'ci-overlay';
        ov.innerHTML = `
            <div class="ci-janela" role="dialog" aria-modal="true" aria-labelledby="ciTitulo">
                <div class="ci-cab">
                    <h3 id="ciTitulo"><i class="fa-solid fa-table-columns"></i> Colunas da Commercial Invoice</h3>
                    <button type="button" class="ci-fechar" data-acao="cancelar" title="Fechar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="ci-corpo">
                    <div class="ci-modelos" id="ciModelos"></div>
                    <div class="ci-secao-tit">Campos do documento <small>Coluna própria ou embaixo do nome do produto · até ${CI_MAX_COLUNAS} colunas extras</small></div>
                    <div class="ci-campos" id="ciCampos"></div>
                    <div class="ci-nova">
                        <input type="text" id="ciNovaColuna" placeholder="Nova coluna (ex.: Safra)" aria-label="Nome da nova coluna">
                        <button type="button" data-acao="nova-coluna"><i class="fa-solid fa-plus"></i> Adicionar coluna</button>
                    </div>
                    <div class="ci-secao-tit">Valores por item <small>Vêm do cadastro do Produto; corrija o que precisar para este documento</small></div>
                    <div class="ci-grade" id="ciGrade"></div>
                </div>
                <div class="ci-rodape">
                    <span class="ci-aviso" id="ciAviso"></span>
                    <button type="button" class="ci-btn-sec" data-acao="cancelar">Cancelar</button>
                    <button type="button" class="ci-btn" data-acao="gerar"><i class="fa-solid fa-file-pdf"></i> Gerar PDF</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        const $ = id => ov.querySelector('#' + id);
        const fechar = (r) => { ov.remove(); resolve(r); };

        const todosCampos = () => {
            const lista = CI_CAMPOS_PADRAO.map(c => ({ chave: c.chave, rotulo: c.rotulo, origem: 'padrao', posicao: c.posicao }));
            caracs.forEach(n => lista.push({ chave: 'car:' + _ciNorm(n), rotulo: n, origem: 'caracteristica', posicao: 'coluna' }));
            cfg.campos.filter(c => c.origem !== 'padrao' && !lista.some(x => x.chave === c.chave)).forEach(c => lista.push({ ...c }));
            return lista;
        };
        const escolhido = chave => cfg.campos.find(c => c.chave === chave);

        const renderModelos = () => {
            const box = $('ciModelos');
            if (modelos === null) { box.innerHTML = '<span class="ci-dica">Modelos disponíveis depois de rodar o SQL database-ci-colunas-modelos.sql.</span>'; return; }
            box.innerHTML = `
                <label for="ciModeloSel">Modelo</label>
                <select id="ciModeloSel">
                    <option value="">— Seleção atual —</option>
                    ${modelos.map(m => `<option value="${escHtml(m.id)}" ${m.id === cfg.modelo_id ? 'selected' : ''}>${escHtml(m.nome)}</option>`).join('')}
                </select>
                <button type="button" class="ci-btn-sec" data-acao="salvar-modelo"><i class="fa-solid fa-floppy-disk"></i> Salvar como modelo</button>
                ${cfg.modelo_id ? '<button type="button" class="ci-btn-sec ci-perigo" data-acao="excluir-modelo" title="Excluir este modelo"><i class="fa-solid fa-trash"></i></button>' : ''}`;
            $('ciModeloSel').addEventListener('change', e => {
                const m = modelos.find(x => x.id === e.target.value);
                if (m) { cfg.campos = JSON.parse(JSON.stringify(m.campos || [])); cfg.modelo_id = m.id; }
                else cfg.modelo_id = null;
                renderTudo();
            });
        };

        const renderCampos = () => {
            $('ciCampos').innerHTML = todosCampos().map(c => {
                const sel = escolhido(c.chave);
                const pos = sel?.posicao || c.posicao;
                const tag = c.origem === 'caracteristica' ? '<span class="ci-tag">característica</span>' : c.origem === 'personalizada' ? '<span class="ci-tag ci-tag-pers">criada</span>' : '';
                return `<div class="ci-campo ${sel ? 'ativo' : ''}">
                    <label><input type="checkbox" data-chave="${escHtml(c.chave)}" ${sel ? 'checked' : ''}> ${escHtml(c.rotulo)} ${tag}</label>
                    <select data-pos="${escHtml(c.chave)}" aria-label="Posição de ${escHtml(c.rotulo)}" ${sel ? '' : 'disabled'}>
                        <option value="coluna" ${pos === 'coluna' ? 'selected' : ''}>Coluna</option>
                        <option value="abaixo" ${pos === 'abaixo' ? 'selected' : ''}>Embaixo do produto</option>
                    </select>
                </div>`;
            }).join('');
            const nCol = cfg.campos.filter(c => c.posicao === 'coluna').length;
            $('ciAviso').textContent = nCol > CI_MAX_COLUNAS ? `Mais de ${CI_MAX_COLUNAS} colunas não cabem na folha: as excedentes vão embaixo do produto.` : '';
        };

        const renderGrade = () => {
            const campos = cfg.campos;
            if (!campos.length) { $('ciGrade').innerHTML = '<span class="ci-dica">Nenhum campo extra escolhido — o documento sai só com código, produto, quantidade e valores.</span>'; return; }
            if (!d.itens.length) { $('ciGrade').innerHTML = '<span class="ci-dica">O Processo não tem itens.</span>'; return; }
            $('ciGrade').innerHTML = `<table><thead><tr><th>Produto</th>${campos.map(c => `<th>${escHtml(c.rotulo)}</th>`).join('')}</tr></thead>
                <tbody>${d.itens.map((it, i) => `<tr><td>${escHtml(it.produto || '—')}</td>${campos.map(c => {
                    const v = ciValorCampo(d, it, i, c, cfg);
                    const ajustado = cfg.valores?.[i]?.[c.chave] !== undefined;
                    return `<td><input type="text" data-i="${i}" data-campo="${escHtml(c.chave)}" value="${escHtml(v)}" class="${ajustado ? 'ajustado' : ''}" aria-label="${escHtml(c.rotulo)} de ${escHtml(it.produto || '')}"></td>`;
                }).join('')}</tr>`).join('')}</tbody></table>`;
        };

        const renderTudo = () => { renderModelos(); renderCampos(); renderGrade(); };

        ov.addEventListener('change', e => {
            const chave = e.target.dataset.chave, posChave = e.target.dataset.pos;
            if (chave) {
                const c = todosCampos().find(x => x.chave === chave);
                if (e.target.checked && c && !escolhido(chave)) cfg.campos.push({ chave: c.chave, rotulo: c.rotulo, origem: c.origem, posicao: c.posicao });
                if (!e.target.checked) cfg.campos = cfg.campos.filter(x => x.chave !== chave);
                cfg.modelo_id = null; renderTudo();
            } else if (posChave) {
                const c = escolhido(posChave); if (c) c.posicao = e.target.value;
                cfg.modelo_id = null; renderModelos(); renderCampos();
            }
        });
        ov.addEventListener('input', e => {
            if (e.target.dataset.campo === undefined) return;
            const i = e.target.dataset.i, ch = e.target.dataset.campo;
            ((cfg.valores[i] ||= {}))[ch] = e.target.value;
            e.target.classList.add('ajustado');
        });
        ov.addEventListener('click', async e => {
            const acao = e.target.closest('[data-acao]')?.dataset.acao;
            if (!acao) { if (e.target === ov) fechar(null); return; }
            if (acao === 'cancelar') return fechar(null);
            if (acao === 'nova-coluna') {
                const nome = $('ciNovaColuna').value.trim();
                if (!nome) return;
                const chave = 'pers:' + _ciNorm(nome);
                if (!escolhido(chave)) cfg.campos.push({ chave, rotulo: nome, origem: 'personalizada', posicao: 'coluna' });
                $('ciNovaColuna').value = ''; cfg.modelo_id = null; renderTudo();
            }
            if (acao === 'salvar-modelo') {
                const nome = await _ciPedirNome();
                if (!nome) return;
                const u = obterUsuarioLogado();
                const campos = cfg.campos.map(({ chave, rotulo, origem, posicao }) => ({ chave, rotulo, origem, posicao }));
                const { data, error } = await supabaseClient.from('documento_modelos')
                    .upsert({ empresa_id: u.empresa_id, tipo: 'commercial', nome, campos, criado_por: u.id, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id,tipo,nome' })
                    .select('id, nome, campos').single();
                if (error) return mostrarNotificacao('Não foi possível salvar o modelo: ' + error.message, 'error');
                modelos = (await _ciModelos()) || []; cfg.modelo_id = data.id; renderModelos();
                mostrarNotificacao(`Modelo "${nome}" salvo.`, 'success');
            }
            if (acao === 'excluir-modelo' && cfg.modelo_id) {
                const m = modelos.find(x => x.id === cfg.modelo_id);
                const ok = await confirmarAcao(`Excluir o modelo "${m?.nome || ''}"? A seleção atual continua na janela.`, { titulo: 'Excluir modelo', confirmar: 'Excluir', perigo: true });
                if (!ok) return;
                const { error } = await supabaseClient.from('documento_modelos').delete().eq('id', cfg.modelo_id);
                if (error) return mostrarNotificacao('Não foi possível excluir o modelo: ' + error.message, 'error');
                modelos = (await _ciModelos()) || []; cfg.modelo_id = null; renderModelos();
            }
            if (acao === 'gerar') {
                // excedentes de coluna vão embaixo do produto
                let n = 0;
                cfg.campos.forEach(c => { if (c.posicao === 'coluna' && ++n > CI_MAX_COLUNAS) c.posicao = 'abaixo'; });
                // guarda só ajustes que diferem do cadastro
                const limpos = {};
                Object.entries(cfg.valores).forEach(([i, obj]) => Object.entries(obj).forEach(([ch, v]) => {
                    const campo = cfg.campos.find(c => c.chave === ch), it = d.itens[i];
                    if (!campo || !it) return;
                    if (v !== ciValorCampo(d, it, i, campo, { valores: {} })) (limpos[i] ||= {})[ch] = v;
                }));
                cfg.valores = limpos;
                const documentos = { ...(d.proc.documentos || {}), ci_config: cfg };
                await supabaseClient.from('processos').update({ documentos }).eq('id', processoId);
                fechar(cfg);
            }
        });
        renderTudo();
    });
}

// Pede o nome do modelo (sem prompt() nativo)
function _ciPedirNome() {
    return new Promise(resolve => {
        const box = document.createElement('div');
        box.className = 'ci-overlay ci-overlay-topo';
        box.innerHTML = `<div class="ci-janela ci-janela-mini" role="dialog" aria-modal="true" aria-labelledby="ciNomeTit">
            <div class="ci-cab"><h3 id="ciNomeTit">Salvar como modelo</h3></div>
            <div class="ci-corpo">
                <label for="ciNomeModelo">Nome do modelo</label>
                <input type="text" id="ciNomeModelo" placeholder="Ex.: Vestuário, Bebidas" maxlength="60">
                <small class="ci-dica">Um modelo com o mesmo nome é substituído.</small>
            </div>
            <div class="ci-rodape">
                <button type="button" class="ci-btn-sec" data-r="0">Cancelar</button>
                <button type="button" class="ci-btn" data-r="1">Salvar</button>
            </div></div>`;
        document.body.appendChild(box);
        const input = box.querySelector('#ciNomeModelo');
        const fim = ok => { const v = input.value.trim(); box.remove(); resolve(ok && v ? v : null); };
        box.addEventListener('click', e => { const r = e.target.closest('[data-r]')?.dataset.r; if (r !== undefined) fim(r === '1'); });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); });
        input.focus();
    });
}
