// ========================================
// CENTRAL DE CHAMADOS — só o usuário Administrador (ehAdminSuporte()).
// A mesma regra vale no banco (auth_is_suporte_admin(), ver
// database-chamados-central-admin.sql) — esta guarda de tela é só UX.
// ========================================

const CAD_STATUS_LABEL = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };

let _cadChamados = [];
let _cadNaoLidos = new Map();      // chamado_id -> 'novo' | 'mensagem'  (novidade que o Administrador ainda não viu)
let _cadNovidadesOk = false;       // false = tabela chamados_leituras indisponível (sem destaque)
let _cadFiltro = 'todos';
let _cadAbertoId = null;

const _cadEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// anexo_url é gravável pelo usuário que abriu o chamado — só https vira link (bloqueia javascript:)
const _cadUrlSegura = u => /^https:\/\//i.test(String(u || '')) ? _cadEsc(u) : '#';
const _cadAnexoHtml = u => {
    if (!/^https:\/\//i.test(String(u || ''))) return '';
    const href = _cadEsc(u);
    return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u)
        ? `<button type="button" class="cad-thumb" data-full="${href}" title="Ampliar"><img src="${href}" alt="Anexo"><span><i class="fa-solid fa-magnifying-glass-plus"></i></span></button>`
        : `<a class="cad-anexo" href="${href}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> Abrir anexo</a>`;
};
const _cadNum = c => c?.numero != null ? '#' + String(c.numero).padStart(4, '0') : '—';
const _cadHora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const _cadDia = iso => {
    const d = new Date(iso), hoje = new Date(), ontem = new Date(Date.now() - 86400000);
    if (d.toDateString() === hoje.toDateString()) return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};
const _cadData = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

document.addEventListener('paste', e => {
    if (!_cadAbertoId || e.target.id !== 'cadModalResposta') return;
    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); cadEscolherAnexo(item.getAsFile()); }
});

document.addEventListener('DOMContentLoaded', async () => {
    if (!ehAdminSuporte()) { window.location.replace('inicio.html'); return; }
    await cadCarregar();
});

async function cadCarregar(silencioso = false) {
    const lista = document.getElementById('cadLista');
    let { data, error } = await supabaseClient
        .from('chamados')
        .select('*, empresas:empresa_proprietaria_id(razao_social, nome_fantasia)')
        .order('updated_at', { ascending: false })
        .limit(300);
    if (error) {
        ({ data, error } = await supabaseClient.from('chamados').select('*').order('updated_at', { ascending: false }).limit(300));
    }
    if (error) {
        if (silencioso) return;
        lista.innerHTML = '<div class="cad-vazio">Erro ao carregar chamados. Rode database-chamados-central-admin.sql no Supabase e tente de novo.</div>';
        return;
    }
    _cadChamados = data || [];
    await _cadCalcularNovidades(silencioso);
    cadRenderizar();
}

// Novidade = chamado que o Administrador nunca abriu ("novo") ou que recebeu mensagem do usuário
// depois da última vez que ele abriu ("mensagem"). O "visto" fica em chamados_leituras (servidor).
async function _cadCalcularNovidades(silencioso) {
    const u = obterUsuarioLogado();
    if (!u?.id) return;
    const ids = _cadChamados.map(c => c.id);
    const [lei, msgs] = await Promise.all([
        supabaseClient.from('chamados_leituras').select('chamado_id, visto_em').eq('usuario_id', u.id),
        supabaseClient.from('chamados_mensagens').select('chamado_id, created_at').eq('autor_tipo', 'usuario').order('created_at', { ascending: false }).limit(1000),
    ]);
    if (lei.error || msgs.error) { _cadNovidadesOk = false; _cadNaoLidos = new Map(); return; }
    _cadNovidadesOk = true;

    const vistos = new Map(lei.data.map(x => [x.chamado_id, x.visto_em]));
    if (!lei.data.length && ids.length) {
        // Primeira vez do Administrador na Central: o histórico existente conta como visto (senão tudo apareceria como novo)
        const agora = new Date().toISOString();
        await supabaseClient.from('chamados_leituras').upsert(ids.map(id => ({ chamado_id: id, usuario_id: u.id, visto_em: agora })), { onConflict: 'chamado_id,usuario_id' });
        ids.forEach(id => vistos.set(id, agora));
    }
    const ultimaMsg = new Map();
    for (const m of msgs.data) if (!ultimaMsg.has(m.chamado_id)) ultimaMsg.set(m.chamado_id, m.created_at);

    const anteriores = _cadNaoLidos;
    const novo = new Map();
    for (const id of ids) {
        if (id === _cadAbertoId) continue; // conversa aberta na tela: já está sendo lida
        if (!vistos.has(id)) novo.set(id, 'novo');
        else if (ultimaMsg.has(id) && new Date(ultimaMsg.get(id)) > new Date(vistos.get(id))) novo.set(id, 'mensagem');
    }
    _cadNaoLidos = novo;

    // Avisa em tela o que chegou desde a última atualização automática
    if (silencioso) {
        for (const [id, tipo] of novo) {
            if (anteriores.get(id) === tipo) continue;
            const c = _cadChamados.find(x => x.id === id);
            mostrarNotificacao?.(`${_cadNum(c)} · ${c?.titulo || ''} — ${tipo === 'novo' ? 'novo chamado' : 'nova mensagem do usuário'}`, 'sucesso');
            _cadPiscar.add(id);
        }
    }
    _cadAtualizarContagemNovidades();
}
let _cadPiscar = new Set();

function _cadAtualizarContagemNovidades() {
    const n = _cadNaoLidos.size;
    const el = document.getElementById('cadContagemNovidades');
    if (el) { el.textContent = n; el.style.display = n ? '' : 'none'; }
    document.title = document.title.replace(/^\(\d+\)\s*/, '');
    if (n) document.title = `(${n}) ${document.title}`;
}

async function _cadMarcarVisto(id) {
    const u = obterUsuarioLogado();
    if (!u?.id || !_cadNovidadesOk) return;
    _cadNaoLidos.delete(id);
    _cadAtualizarContagemNovidades();
    await supabaseClient.from('chamados_leituras').upsert({ chamado_id: id, usuario_id: u.id, visto_em: new Date().toISOString() }, { onConflict: 'chamado_id,usuario_id' });
}

function cadTrocarCampoBusca() {
    const campo = document.getElementById('buscaCampo').value;
    const rotulos = { todos: 'todos os campos', chamado: 'número do chamado (ex: 12)', usuario: 'nome ou e-mail do usuário', empresa: 'empresa', modulo: 'módulo' };
    document.getElementById('buscaChamado').placeholder = 'Buscar em ' + rotulos[campo] + '...';
    cadRenderizar();
}

function cadFiltrar(status) {
    _cadFiltro = status;
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.status === status));
    cadRenderizar();
}

function _cadSolicitante(c) { return c.usuario_nome || c.usuario_email || '—'; }
function _cadEmpresa(c) { return c.empresas?.nome_fantasia || c.empresas?.razao_social || '—'; }

function cadRenderizar() {
    const termo = (document.getElementById('buscaChamado')?.value || '').toLowerCase().trim();
    const itens = _cadChamados.filter(c => {
        if (_cadFiltro === 'novidades') { if (!_cadNaoLidos.has(c.id)) return false; }
        else if (_cadFiltro !== 'todos' && (c.status || 'aberto') !== _cadFiltro) return false;
        if (!termo) return true;
        const campo = document.getElementById('buscaCampo')?.value || 'todos';
        const numero = c.numero != null ? `${_cadNum(c)} ${c.numero}` : '';
        const alvos = {
            chamado: numero,
            usuario: `${c.usuario_nome || ''} ${c.usuario_email || ''}`,
            empresa: _cadEmpresa(c),
            modulo:  c.modulo || '',
            todos:   `${numero} ${c.titulo} ${_cadSolicitante(c)} ${c.usuario_email || ''} ${_cadEmpresa(c)} ${c.modulo || ''}`,
        };
        const alvo = (alvos[campo] ?? alvos.todos).toLowerCase();
        return alvo.includes(termo.replace(/^#/, ''));
    });

    const lista = document.getElementById('cadLista');
    if (!itens.length) { lista.innerHTML = '<div class="cad-vazio"><i class="fa-regular fa-folder-open"></i> Nenhum chamado encontrado.</div>'; return; }

    lista.innerHTML = `
        <table class="cad-tabela">
            <thead><tr><th>Chamado</th><th>Atualizado</th><th>Título</th><th>Módulo</th><th>Solicitante</th><th>Empresa</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
                ${itens.map(c => {
                    const st = c.status || 'aberto';
                    const nl = _cadNaoLidos.get(c.id);
                    const piscar = _cadPiscar.delete(c.id);
                    return `<tr onclick="cadAbrir('${c.id}')" class="${nl ? 'cad-nao-lido' : ''}${piscar ? ' cad-piscar' : ''}">
                        <td class="cad-numero">${nl ? '<span class="cad-ponto" title="Novidade"></span>' : ''}${_cadNum(c)}</td>
                        <td>${_cadData(c.updated_at)}</td>
                        <td class="cad-titulo">${_cadEsc(c.titulo)}${c.anexo_url ? ' <i class="fa-solid fa-paperclip"></i>' : ''}${nl ? ` <span class="cad-pill-novo">${nl === 'novo' ? 'Novo chamado' : 'Nova mensagem'}</span>` : ''}</td>
                        <td>${_cadEsc(c.modulo || '—')}</td>
                        <td>${_cadEsc(_cadSolicitante(c))}</td>
                        <td>${_cadEsc(_cadEmpresa(c))}</td>
                        <td onclick="event.stopPropagation()">
                            <select class="cad-status-select cad-badge-${st}" onchange="cadMudarStatus(this.value, '${c.id}')" title="Alterar status">
                                ${Object.entries(CAD_STATUS_LABEL).map(([v, l]) => `<option value="${v}"${v === st ? ' selected' : ''}>${l}</option>`).join('')}
                            </select>
                        </td>
                        <td class="cad-acoes"><button class="cad-btn-excluir" title="Excluir chamado" onclick="event.stopPropagation(); cadExcluir('${c.id}')"><i class="fa-solid fa-trash"></i></button></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

async function cadAbrir(id) {
    const c = _cadChamados.find(x => x.id === id);
    if (!c) return;
    _cadAbertoId = id;
    _cadMarcarVisto(id);
    const st = c.status || 'aberto';
    document.getElementById('cadModalNum').textContent = _cadNum(c);
    document.getElementById('cadModalNum').style.display = c.numero != null ? '' : 'none';
    document.getElementById('cadModalTitulo').textContent = c.titulo;
    document.getElementById('cadModalChips').innerHTML = [
        ['fa-user', _cadSolicitante(c)],
        ['fa-building', _cadEmpresa(c)],
        c.modulo ? ['fa-layer-group', c.modulo] : null,
        ['fa-regular fa-clock', _cadData(c.created_at)],
    ].filter(Boolean).map(([ic, t]) => `<span class="cad-chip"><i class="${ic.includes(' ') ? ic : 'fa-solid ' + ic}"></i> ${_cadEsc(t)}</span>`).join('');
    _cadPintarStatus(st);
    document.getElementById('cadModalQuando').textContent = '';
    document.getElementById('cadModalDesc').textContent = c.descricao || '';
    document.getElementById('cadModalAnexo').innerHTML = _cadAnexoHtml(c.anexo_url);
    document.getElementById('cadModalResposta').value = '';
    cadAjustarAltura(document.getElementById('cadModalResposta'));
    cadRemoverAnexo();
    document.getElementById('cadModal').style.display = 'flex';
    await _cadCarregarThread();
    document.getElementById('cadModalResposta').focus();
}

function _cadPintarStatus(st) {
    const sel = document.getElementById('cadModalStatus');
    sel.value = st;
    sel.className = 'cad-status-select cad-badge-' + st;
}

function cadAjustarAltura(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function cadAbrirLightbox(url) {
    if (!/^https:\/\//i.test(url)) return;
    document.getElementById('cadLightboxImg').src = url;
    document.getElementById('cadLightbox').style.display = 'flex';
}
function cadFecharLightbox() {
    document.getElementById('cadLightbox').style.display = 'none';
    document.getElementById('cadLightboxImg').src = '';
}

function cadFecharModal() {
    document.getElementById('cadModal').style.display = 'none';
    _cadAbertoId = null;
}

let _cadThreadAssinatura = '';
async function _cadCarregarThread(silencioso = false) {
    const el = document.getElementById('cadModalThread');
    if (!silencioso) { _cadThreadAssinatura = ''; el.innerHTML = '<div class="cad-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i></div>'; }
    const idAlvo = _cadAbertoId;
    const { data, error } = await supabaseClient
        .from('chamados_mensagens')
        .select('autor_tipo, usuario_nome, mensagem, anexo_url, created_at')
        .eq('chamado_id', _cadAbertoId)
        .order('created_at', { ascending: true });
    if (idAlvo !== _cadAbertoId) return;
    if (error) { if (!silencioso) el.innerHTML = '<div class="cad-vazio">Erro ao carregar a conversa.</div>'; return; }
    const assinatura = `${(data || []).length}|${data?.[data.length - 1]?.created_at || ''}`;
    if (silencioso && assinatura === _cadThreadAssinatura) return;
    if (silencioso && _cadThreadAssinatura) _cadMarcarVisto(idAlvo);
    _cadThreadAssinatura = assinatura;
    document.getElementById('cadModalContagem').textContent = (data || []).length ? `(${data.length})` : '';

    const naBase = !silencioso || (() => { const b = document.getElementById('cadModalBody'); return b.scrollHeight - b.scrollTop - b.clientHeight < 80; })();
    let html = '', diaAnterior = '';
    for (const m of (data || [])) {
        const dia = new Date(m.created_at).toDateString();
        if (dia !== diaAnterior) { html += `<div class="cad-dia"><span>${_cadDia(m.created_at)}</span></div>`; diaAnterior = dia; }
        const suporte = m.autor_tipo === 'suporte';
        const nome = suporte ? 'Suporte' : (m.usuario_nome || 'Usuário');
        const soAnexo = m.anexo_url && m.mensagem === '(anexo)';
        html += `<div class="cad-linha cad-linha-${m.autor_tipo}">
            <div class="cad-avatar cad-avatar-${m.autor_tipo}">${suporte ? '<i class="fa-solid fa-headset"></i>' : _cadEsc(nome.trim().charAt(0).toUpperCase() || '?')}</div>
            <div class="cad-msg cad-msg-${m.autor_tipo}">
                <span class="cad-msg-autor">${_cadEsc(nome)} <em>${_cadHora(m.created_at)}</em></span>
                ${soAnexo ? '' : `<p>${_cadEsc(m.mensagem)}</p>`}${_cadAnexoHtml(m.anexo_url)}
            </div></div>`;
    }
    el.innerHTML = html || '<div class="cad-vazio cad-vazio-thread"><i class="fa-regular fa-comment-dots"></i><br>Nenhuma mensagem ainda. Responda abaixo para iniciar a conversa.</div>';
    if (naBase) { const b = document.getElementById('cadModalBody'); b.scrollTop = b.scrollHeight; }
}

async function cadMudarStatus(novo, id = _cadAbertoId) {
    // .select() devolve as linhas realmente alteradas — a RLS pode filtrar um
    // UPDATE pra zero linhas sem dar erro (ex: migração não rodada).
    const { data, error } = await supabaseClient.from('chamados')
        .update({ status: novo, updated_at: new Date().toISOString() }).eq('id', id).select('id');
    if (error || !data?.length) {
        mostrarNotificacao?.('Não foi possível mudar o status' + (error ? ': ' + error.message : ' (sem permissão — rode database-chamados-central-admin.sql).'), 'erro');
        cadRenderizar(); // volta o seletor da linha pro valor real
        if (id === _cadAbertoId) _cadPintarStatus(_cadChamados.find(x => x.id === id)?.status || 'aberto');
        return;
    }
    const c = _cadChamados.find(x => x.id === id);
    if (c) { c.status = novo; c.updated_at = new Date().toISOString(); }
    if (id === _cadAbertoId) _cadPintarStatus(novo);
    cadRenderizar();
}

async function cadEnviarResposta() {
    const campo = document.getElementById('cadModalResposta');
    const texto = campo.value.trim();
    const arquivo = _cadAnexo;
    if ((!texto && !arquivo) || !_cadAbertoId) return;
    const btn = document.getElementById('cadModalEnviar');
    btn.disabled = true;
    const u = obterUsuarioLogado();
    let anexoUrl = null;
    if (arquivo) {
        const ext = (arquivo.name && arquivo.name.includes('.')) ? arquivo.name.split('.').pop() : ((arquivo.type || '').split('/')[1] || 'png');
        const caminho = `${_cadAbertoId}/${Date.now()}.${ext}`;
        const { error: errUp } = await supabaseClient.storage.from('chamados-anexos').upload(caminho, arquivo, { contentType: arquivo.type || 'image/png' });
        if (errUp) { btn.disabled = false; mostrarNotificacao?.('Erro ao enviar o anexo: ' + errUp.message, 'erro'); return; }
        anexoUrl = supabaseClient.storage.from('chamados-anexos').getPublicUrl(caminho).data?.publicUrl || null;
    }
    const { error } = await supabaseClient.from('chamados_mensagens').insert({
        chamado_id: _cadAbertoId, autor_tipo: 'suporte', usuario_id: u?.id || null, usuario_nome: u?.nome || 'Suporte', mensagem: texto || '(anexo)', anexo_url: anexoUrl
    });
    btn.disabled = false;
    if (error) { mostrarNotificacao?.('Erro ao enviar: ' + error.message, 'erro'); return; }
    await supabaseClient.from('chamados').update({ updated_at: new Date().toISOString() }).eq('id', _cadAbertoId);
    campo.value = '';
    cadAjustarAltura(campo);
    cadRemoverAnexo();
    await _cadCarregarThread();
}

// Atualização automática: conversa aberta a cada 8s, lista a cada 15s (só com a aba visível)
setInterval(() => {
    if (document.hidden) return;
    if (_cadAbertoId) _cadCarregarThread(true);
}, 8000);
setInterval(() => {
    if (document.hidden || _cadAbertoId) return;
    if (typeof ehAdminSuporte === 'function' && ehAdminSuporte()) cadCarregar(true);
}, 15000);

async function cadExcluir(id) {
    const c = _cadChamados.find(x => x.id === id);
    if (!c) return;
    if (!(await confirmarAcao(`Excluir o chamado "${c.titulo}"? A conversa e os anexos também serão apagados. Esta ação não pode ser desfeita.`, { titulo: 'Excluir chamado', confirmar: 'Excluir', perigo: true }))) return;

    // Anexos no Storage (melhor esforço — se falhar, o chamado ainda é excluído)
    try {
        const { data: arquivos } = await supabaseClient.storage.from('chamados-anexos').list(id);
        if (arquivos?.length) await supabaseClient.storage.from('chamados-anexos').remove(arquivos.map(a => `${id}/${a.name}`));
    } catch (e) { console.warn('[Central] anexos não removidos:', e); }

    // .select() devolve as linhas realmente apagadas — a RLS pode barrar sem dar erro
    const { data, error } = await supabaseClient.from('chamados').delete().eq('id', id).select('id');
    if (error || !data?.length) {
        mostrarNotificacao?.('Não foi possível excluir' + (error ? ': ' + error.message : ' (sem permissão — rode database-chamados-central-acoes.sql).'), 'erro');
        return;
    }
    _cadChamados = _cadChamados.filter(x => x.id !== id);
    if (_cadAbertoId === id) cadFecharModal();
    cadRenderizar();
    mostrarNotificacao?.('Chamado excluído.', 'sucesso');
}

// ── Anexo na resposta do suporte (clipe ou Ctrl+V) ──
let _cadAnexo = null;
function cadEscolherAnexo(arquivo) {
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) { alert('O arquivo é grande demais (máx. 10 MB).'); return; }
    _cadAnexo = arquivo;
    document.getElementById('cadAnexoNome').textContent = arquivo.name || 'imagem colada';
    const thumb = document.getElementById('cadAnexoThumb');
    if (arquivo.type.startsWith('image/')) { thumb.src = URL.createObjectURL(arquivo); thumb.style.display = ''; } else { thumb.style.display = 'none'; }
    document.getElementById('cadAnexoChip').style.display = 'flex';
}
function cadRemoverAnexo() {
    _cadAnexo = null;
    document.getElementById('cadAnexoChip').style.display = 'none';
    document.getElementById('cadModalArquivo').value = '';
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (document.getElementById('cadLightbox')?.style.display !== 'none' && document.getElementById('cadLightbox')?.style.display) { cadFecharLightbox(); return; }
        if (_cadAbertoId) cadFecharModal();
        return;
    }
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'cadModalResposta') { e.preventDefault(); cadEnviarResposta(); }
});
document.addEventListener('click', e => {
    const t = e.target.closest('.cad-thumb');
    if (t) cadAbrirLightbox(t.dataset.full);
});
