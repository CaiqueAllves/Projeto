// ========================================
// CENTRAL DE CHAMADOS — só o usuário Administrador (ehAdminSuporte()).
// A mesma regra vale no banco (auth_is_suporte_admin(), ver
// database-chamados-central-admin.sql) — esta guarda de tela é só UX.
// ========================================

const CAD_STATUS_LABEL = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };

let _cadChamados = [];
let _cadFiltro = 'todos';
let _cadAbertoId = null;

const _cadEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// anexo_url é gravável pelo usuário que abriu o chamado — só https vira link (bloqueia javascript:)
const _cadUrlSegura = u => /^https:\/\//i.test(String(u || '')) ? _cadEsc(u) : '#';
const _cadData = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

document.addEventListener('DOMContentLoaded', async () => {
    if (!ehAdminSuporte()) { window.location.replace('inicio.html'); return; }
    await cadCarregar();
});

async function cadCarregar() {
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
        lista.innerHTML = '<div class="cad-vazio">Erro ao carregar chamados. Rode database-chamados-central-admin.sql no Supabase e tente de novo.</div>';
        return;
    }
    _cadChamados = data || [];
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
        if (_cadFiltro !== 'todos' && (c.status || 'aberto') !== _cadFiltro) return false;
        if (!termo) return true;
        return `${c.titulo} ${_cadSolicitante(c)} ${_cadEmpresa(c)} ${c.modulo || ''}`.toLowerCase().includes(termo);
    });

    const lista = document.getElementById('cadLista');
    if (!itens.length) { lista.innerHTML = '<div class="cad-vazio"><i class="fa-regular fa-folder-open"></i> Nenhum chamado encontrado.</div>'; return; }

    lista.innerHTML = `
        <table class="cad-tabela">
            <thead><tr><th>Atualizado</th><th>Título</th><th>Módulo</th><th>Solicitante</th><th>Empresa</th><th>Status</th></tr></thead>
            <tbody>
                ${itens.map(c => {
                    const st = c.status || 'aberto';
                    return `<tr onclick="cadAbrir('${c.id}')">
                        <td>${_cadData(c.updated_at)}</td>
                        <td class="cad-titulo">${_cadEsc(c.titulo)}${c.anexo_url ? ' <i class="fa-solid fa-paperclip"></i>' : ''}</td>
                        <td>${_cadEsc(c.modulo || '—')}</td>
                        <td>${_cadEsc(_cadSolicitante(c))}</td>
                        <td>${_cadEsc(_cadEmpresa(c))}</td>
                        <td><span class="cad-badge cad-badge-${st}">${CAD_STATUS_LABEL[st] || st}</span></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

async function cadAbrir(id) {
    const c = _cadChamados.find(x => x.id === id);
    if (!c) return;
    _cadAbertoId = id;
    document.getElementById('cadModalTitulo').textContent = c.titulo;
    document.getElementById('cadModalSub').textContent = `${_cadSolicitante(c)} • ${_cadEmpresa(c)} • ${_cadData(c.created_at)}${c.modulo ? ' • ' + c.modulo : ''}`;
    document.getElementById('cadModalStatus').value = c.status || 'aberto';
    document.getElementById('cadModalDesc').textContent = c.descricao || '';
    document.getElementById('cadModalAnexo').innerHTML = c.anexo_url
        ? `<a class="cad-anexo" href="${_cadUrlSegura(c.anexo_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> Ver print anexado</a>` : '';
    document.getElementById('cadModalResposta').value = '';
    document.getElementById('cadModal').style.display = 'flex';
    await _cadCarregarThread();
}

function cadFecharModal() {
    document.getElementById('cadModal').style.display = 'none';
    _cadAbertoId = null;
}

async function _cadCarregarThread() {
    const el = document.getElementById('cadModalThread');
    el.innerHTML = '<div class="cad-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
    const { data, error } = await supabaseClient
        .from('chamados_mensagens')
        .select('autor_tipo, usuario_nome, mensagem, created_at')
        .eq('chamado_id', _cadAbertoId)
        .order('created_at', { ascending: true });
    if (error) { el.innerHTML = '<div class="cad-vazio">Erro ao carregar a conversa.</div>'; return; }
    el.innerHTML = (data || []).length
        ? data.map(m => `<div class="cad-msg cad-msg-${m.autor_tipo}">
              <span class="cad-msg-autor">${m.autor_tipo === 'suporte' ? 'Suporte' : _cadEsc(m.usuario_nome || 'Usuário')} • ${_cadData(m.created_at)}</span>
              <p>${_cadEsc(m.mensagem)}</p></div>`).join('')
        : '<div class="cad-vazio">Nenhuma mensagem ainda.</div>';
    el.scrollTop = el.scrollHeight;
}

async function cadMudarStatus(novo) {
    // .select() devolve as linhas realmente alteradas — a RLS pode filtrar um
    // UPDATE pra zero linhas sem dar erro (ex: migração não rodada).
    const { data, error } = await supabaseClient.from('chamados')
        .update({ status: novo, updated_at: new Date().toISOString() }).eq('id', _cadAbertoId).select('id');
    if (error || !data?.length) {
        mostrarNotificacao?.('Não foi possível mudar o status' + (error ? ': ' + error.message : ' (sem permissão — rode database-chamados-central-admin.sql).'), 'erro');
        const c0 = _cadChamados.find(x => x.id === _cadAbertoId);
        document.getElementById('cadModalStatus').value = c0?.status || 'aberto';
        return;
    }
    const c = _cadChamados.find(x => x.id === _cadAbertoId);
    if (c) { c.status = novo; c.updated_at = new Date().toISOString(); }
    cadRenderizar();
}

async function cadEnviarResposta() {
    const campo = document.getElementById('cadModalResposta');
    const texto = campo.value.trim();
    if (!texto || !_cadAbertoId) return;
    const btn = document.getElementById('cadModalEnviar');
    btn.disabled = true;
    const u = obterUsuarioLogado();
    const { error } = await supabaseClient.from('chamados_mensagens').insert({
        chamado_id: _cadAbertoId, autor_tipo: 'suporte', usuario_id: u?.id || null, usuario_nome: u?.nome || 'Suporte', mensagem: texto
    });
    btn.disabled = false;
    if (error) { mostrarNotificacao?.('Erro ao enviar: ' + error.message, 'erro'); return; }
    await supabaseClient.from('chamados').update({ updated_at: new Date().toISOString() }).eq('id', _cadAbertoId);
    campo.value = '';
    await _cadCarregarThread();
}
