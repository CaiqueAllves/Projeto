// ========================================
// PERFIL DO USUÁRIO
// ========================================

// ── EmailJS ─────────────────────────────
// 1. Acesse https://www.emailjs.com e crie uma conta gratuita
// 2. Adicione um serviço de e-mail (Gmail, Outlook, etc.)
// 3. Crie um template com as variáveis: {{to_name}}, {{to_email}}, {{codigo}}
// 4. Substitua os valores abaixo pelos seus IDs
const EMAILJS_PUBLIC_KEY  = 'SEU_PUBLIC_KEY';    // Account → API Keys
const EMAILJS_SERVICE_ID  = 'SEU_SERVICE_ID';    // Email Services → Service ID
const EMAILJS_TEMPLATE_ID = 'SEU_TEMPLATE_ID';   // Email Templates → Template ID
// ────────────────────────────────────────

const PLANOS = {
    basico: {
        nome: 'Básico', icone: 'fa-seedling', cor: '#64748b', corFundo: '#f1f5f9',
        total: 1, admins: 1, subs: 0,
        descricao: '1 usuário responsável, sem sub-usuários.',
        recursos: ['Processos de exportação/importação', 'Cadastro de empresas', 'Cadastro de produtos', 'Propostas comerciais', 'Relatórios básicos'],
    },
    regular: {
        nome: 'Regular', icone: 'fa-star', cor: '#3b82f6', corFundo: '#dbeafe',
        total: 3, admins: 1, subs: 2,
        descricao: '1 administrador + 2 sub-usuários.',
        recursos: ['Tudo do Básico', 'Até 3 usuários simultâneos', 'Permissões por módulo', 'Relatórios intermediários', 'Suporte por e-mail'],
    },
    profissional: {
        nome: 'Profissional', icone: 'fa-rocket', cor: '#f7931e', corFundo: '#fff7ed',
        total: 5, admins: 2, subs: 3,
        descricao: '2 administradores + 3 sub-usuários.',
        recursos: ['Tudo do Regular', 'Até 5 usuários simultâneos', '2 administradores', 'Relatórios avançados', 'Suporte prioritário'],
    },
    empresa: {
        nome: 'Empresa', icone: 'fa-building', cor: '#7c3aed', corFundo: '#ede9fe',
        total: null, admins: null, subs: null,
        descricao: 'Capacidade personalizada conforme contrato.',
        recursos: ['Tudo do Profissional', 'Usuários ilimitados', 'SLA garantido', 'Gerente de conta dedicado', 'Integrações sob medida'],
    }
};

let usuarioAtual = null;
let dadosPerfil = null;
let codigoAtivo = null;
let codigoExpiry = null;
let canalAtivo = 'email'; // 'email' | 'sms'

document.addEventListener('DOMContentLoaded', async function () {
    usuarioAtual = obterUsuarioLogado();
    if (!usuarioAtual) return;

    atualizarTopbar();

    // Busca dados completos do DB
    const res = await buscarDadosPerfilCompleto();
    dadosPerfil = res.sucesso ? res.data : {};

    console.log('[Perfil] dadosPerfil.empresa_id:', dadosPerfil?.empresa_id);
    console.log('[Perfil] usuarioAtual.empresa_id:', usuarioAtual?.empresa_id);
    console.log('[Perfil] dadosPerfil.empresas (join):', dadosPerfil?.empresas);

    // Usa join do buscarDadosPerfilCompleto se retornou dados
    // Caso contrário, tenta query direta na tabela empresas
    if (!dadosPerfil.empresas) {
        const empresaId = dadosPerfil.empresa_id || usuarioAtual?.empresa_id;
        if (empresaId) {
            const { data: empData, error: empErr } = await supabaseClient
                .from('empresas')
                .select('id, razao_social, nome_fantasia, cnpj, ie, im, suframa, cep, estado, cidade, endereco, numero, complemento')
                .eq('id', empresaId)
                .single();
            console.log('[Perfil] query direta empresas:', { empData, empErr });
            if (!empErr && empData) dadosPerfil.empresas = empData;
        }
    }

    // Limpa flag de atualização da URL se presente
    if (new URLSearchParams(window.location.search).get('empresa_atualizada') === '1') {
        window.history.replaceState({}, '', 'perfil.html');
    }

    try { preencherSidebar(); }    catch(e) { console.error('[Perfil] preencherSidebar:', e); }
    try { preencherFormulario(); } catch(e) { console.error('[Perfil] preencherFormulario:', e); }
    try { preencherEmpresa(); }    catch(e) { console.error('[Perfil] preencherEmpresa:', e); }
    atualizarTopbar(); // atualiza avatar no topbar após ter dadosPerfil

    // Preencher dados mascarados nos canais de segurança
    const email = dadosPerfil?.email || usuarioAtual.email || '';
    const telefone = dadosPerfil?.telefone || '';
    document.getElementById('segEmailMasked').textContent = email ? mascararEmail(email) : 'Não cadastrado';

    const telMasked = document.getElementById('segTelMasked');
    if (telefone) {
        telMasked.textContent = mascararTelefone(telefone);
    } else {
        telMasked.textContent = 'Não cadastrado';
        document.getElementById('btnCanalSms').disabled = true;
        document.getElementById('btnCanalSms').title = 'Cadastre um telefone nos Dados Pessoais';
    }

    const isAdmin = usuarioAtual.perfil === 'admin';
    if (isAdmin) {
        document.getElementById('secaoPlano').style.display = 'block';
        const btnEditar = document.getElementById('btnEditarEmpresa');
        if (btnEditar) btnEditar.style.display = '';
        const sidePlanoCard = document.getElementById('sidePlanoCard');
        if (sidePlanoCard) sidePlanoCard.style.display = '';
        const resPlano = await buscarDadosPlano();
        if (resPlano.sucesso) renderizarPlano(resPlano.data);
    }
});

// ========================================
// TOPBAR
// ========================================

function atualizarTopbar() {
    const nome = usuarioAtual.nome || '';
    document.getElementById('displayUsername').textContent = nome || '—';
    document.getElementById('userEmail').textContent = usuarioAtual.email || '—';

    const avatarUrl = dadosPerfil?.avatar_url || usuarioAtual.avatar_url || null;
    if (avatarUrl) {
        const icon = document.getElementById('topbarAvatarIcon');
        const img  = document.getElementById('topbarAvatarImg');
        if (icon) icon.style.display = 'none';
        if (img)  { img.src = avatarUrl; img.style.display = 'block'; }
    }
}

// ========================================
// SIDEBAR
// ========================================

function preencherSidebar() {
    const u = dadosPerfil || {};
    const nome = u.nome_completo || usuarioAtual.nome || '';
    const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
    const perfis = { admin: 'Administrador', gerente: 'Gerente', usuario: 'Usuário' };
    const perfilLabel = perfis[u.perfil || usuarioAtual.perfil] || '—';

    // Avatar + nome
    document.getElementById('avatarGrande').textContent = iniciais;
    if (u.avatar_url) carregarFoto(u.avatar_url);
    document.getElementById('sideNome').textContent = nome || '—';
    document.getElementById('pageHeaderNome').textContent = nome ? `Olá, ${nome.split(' ')[0]}` : 'Meu Perfil';

    // Cargo
    const cargoEl = document.getElementById('sideCargo');
    cargoEl.textContent = u.cargo || '';
    cargoEl.style.display = u.cargo ? 'block' : 'none';

    // Perfil badge
    const badge = document.getElementById('sidePerfilBadge');
    badge.textContent = perfilLabel;

    // Team badge (sub-usuário)
    const nomeEmpresa = u.empresas?.razao_social || usuarioAtual.empresa || '';
    if (usuarioAtual.perfil !== 'admin' && nomeEmpresa) {
        document.getElementById('sideTeam').style.display = 'flex';
        document.getElementById('sideTeamEmpresa').textContent = nomeEmpresa;
    }

    // Dados rápidos
    document.getElementById('sideMembro').textContent = u.criado_em
        ? new Date(u.criado_em).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : '—';

    document.getElementById('sideUltimoAcesso').textContent = u.ultimo_login
        ? formatarDataRelativa(u.ultimo_login)
        : 'Nunca registrado';

    document.getElementById('sidePerfilInfo').textContent = perfilLabel;

    const ativo = u.ativo !== undefined ? u.ativo : true;
    document.getElementById('sideStatus').textContent = ativo ? 'Ativo' : 'Inativo';
    document.getElementById('sideStatus').style.color = ativo ? '#22c55e' : '#dc2626';

    // Email na sidebar de segurança
    const emailEl = document.getElementById('sideEmailValor');
    if (emailEl) emailEl.textContent = mascararEmail(u.email || usuarioAtual.email || '');

    // Celular na sidebar de segurança
    const telSidebar = document.getElementById('sideTelStatus');
    const telValor = document.getElementById('sideTelValor');
    const telAdicionar = document.getElementById('sideTelAdicionar');
    if (u.telefone) {
        telSidebar.classList.remove('sidebar-seg-aviso');
        telSidebar.classList.add('sidebar-seg-ok');
        telSidebar.querySelector('i').className = 'fa-solid fa-circle-check';
        if (telValor) telValor.textContent = mascararTelefone(u.telefone);
        if (telAdicionar) telAdicionar.style.display = 'none';
    } else {
        telSidebar.classList.remove('sidebar-seg-ok');
        telSidebar.classList.add('sidebar-seg-aviso');
        telSidebar.querySelector('i').className = 'fa-solid fa-circle-xmark';
        if (telValor) telValor.textContent = 'Não cadastrado';
        if (telAdicionar) telAdicionar.style.display = 'inline';
    }

    // Último acesso na seção segurança
    document.getElementById('segAcessoValor').textContent = u.ultimo_login
        ? formatarDataCompleta(u.ultimo_login)
        : 'Nenhum acesso registrado ainda.';
}

// ========================================
// FORMULÁRIO DADOS PESSOAIS
// ========================================

function preencherFormulario() {
    const u = dadosPerfil || {};
    const nome = u.nome_completo || usuarioAtual.nome || '';
    const perfis = { admin: 'Administrador', gerente: 'Gerente', usuario: 'Usuário' };

    document.getElementById('inputNome').value = nome;
    document.getElementById('inputEmail').value = u.email || usuarioAtual.email || '';
    document.getElementById('inputCpf').value = mascararCpf(u.cpf || usuarioAtual.cpf || '');
    document.getElementById('inputCargo').value = u.cargo || '';
    document.getElementById('inputTelefone').value = u.telefone || '';
    document.getElementById('inputPerfilAcesso').value = perfis[u.perfil || usuarioAtual.perfil] || '—';
}

// ========================================
// EMPRESA
// ========================================

function preencherEmpresa() {
    const empresa = dadosPerfil?.empresas || {};
    const isAdmin = usuarioAtual?.perfil === 'admin';

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    const cnpjRaw = (empresa.cnpj || '').replace(/\D/g, '');
    const tipoDoc = cnpjRaw.length === 14 ? 'CNPJ' : cnpjRaw.length === 11 ? 'CPF' : '';
    const docFormatado = cnpjRaw ? formatarCnpj(cnpjRaw) : '';

    const perfis = { admin: 'Administrador', gerente: 'Gerente', usuario: 'Usuário' };

    set('empView-razao',    empresa.razao_social || usuarioAtual?.empresa || '');
    set('empView-fantasia', empresa.nome_fantasia);
    set('empView-tipo',     tipoDoc);
    set('empView-doc',      docFormatado);
    set('empView-pais',     empresa.pais || 'BRASIL');
    set('empView-perfil',   perfis[usuarioAtual?.perfil] || '');

    // Label do documento atualiza com o tipo correto
    const docLabel = document.getElementById('empView-doc-label');
    if (docLabel && tipoDoc) docLabel.innerHTML = `${tipoDoc} <span class="label-readonly">somente leitura</span>`;

    // Botão editar (só admin)
    const btnEditar = document.getElementById('btnEditarEmpresa');
    if (btnEditar) btnEditar.style.display = isAdmin ? '' : 'none';
}

function copiarChave(chave) {
    navigator.clipboard.writeText(chave).then(() => mostrarToast('Chave copiada!', 'sucesso'));
}

// ========================================
// EDITAR EMPRESA
// ========================================

let _dadosEmpresaCarregados = null;

async function abrirEditarEmpresa() {
    const empresa = dadosPerfil?.empresas || {};
    const cnpjRaw = (empresa.cnpj || '').replace(/\D/g, '');

    // Mapeia empresas → formato esperado pelo formulário de parceiro
    const dadosForm = {
        _tenantId:             empresa.id,
        tipo_cadastro:         cnpjRaw.length === 11 ? 'cpf' : 'cnpj',
        documento:             cnpjRaw,
        razao_social:          empresa.razao_social   || '',
        nome_fantasia:         empresa.nome_fantasia  || '',
        inscricao_estadual:    empresa.ie             || '',
        inscricao_municipal:   empresa.im             || '',
        suframa:               empresa.suframa        || '',
        email_contato:         empresa.email          || '',
        cep:                   (empresa.cep || '').replace(/\D/g, ''),
        estado:                empresa.estado         || '',
        cidade:                empresa.cidade         || '',
        endereco:              empresa.endereco       || '',
        numero:                empresa.numero         || '',
        complemento:           empresa.complemento   || '',
    };

    sessionStorage.setItem('_tenantEmpresaEdicao', JSON.stringify(dadosForm));
    window.location.href = 'formularios.html?tab=empresa&modo=tenant';
}

function fecharEditarEmpresa(event) {
    if (event?.target === document.getElementById('modalEditarEmpresa')) fecharEditarEmpresaBtn();
}

function fecharEditarEmpresaBtn() {
    const modal = document.getElementById('modalEditarEmpresa');
    if (modal) modal.style.display = 'none';
}

async function salvarEdicaoEmpresa() {
    const razao = document.getElementById('editEmpRazaoSocial')?.value.trim();
    if (!razao) { mostrarToast('Razão Social é obrigatória.', 'erro'); return; }

    const dados = {
        razao_social:  razao,
        nome_fantasia: document.getElementById('editEmpNomeFantasia')?.value.trim() || null,
        cnpj:          (document.getElementById('editEmpDocumento')?.value || '').replace(/\D/g, '') || null,
        ie:            document.getElementById('editEmpIE')?.value.trim() || null,
        im:            document.getElementById('editEmpIM')?.value.trim() || null,
        suframa:       document.getElementById('editEmpSuframa')?.value.trim() || null,
        cep:           (document.getElementById('editEmpCep')?.value || '').replace(/\D/g, '') || null,
        estado:        document.getElementById('editEmpEstado')?.value.trim() || null,
        cidade:        document.getElementById('editEmpCidade')?.value.trim() || null,
        endereco:      document.getElementById('editEmpEndereco')?.value.trim() || null,
        numero:        document.getElementById('editEmpNumero')?.value.trim() || null,
        complemento:   document.getElementById('editEmpComplemento')?.value.trim() || null,
    };

    const btn = document.getElementById('btnSalvarEmpresaModal');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

    const res = await window.supabaseAPI.atualizarTenantEmpresa(dados);

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar'; }

    if (res.sucesso) {
        mostrarToast('Dados da empresa atualizados!', 'sucesso');
        fecharEditarEmpresaBtn();
        if (dadosPerfil?.empresas) Object.assign(dadosPerfil.empresas, dados);
        preencherEmpresa();
    } else {
        mostrarToast('Erro ao atualizar: ' + (res.mensagem || 'Tente novamente.'), 'erro');
    }
}

// ========================================
// DOCUMENTOS DA EMPRESA
// ========================================

const BUCKET_DOCS = 'empresa-docs';

async function carregarDocumentosEmpresa() {
    const empresaId = dadosPerfil?.empresa_id || usuarioAtual?.empresa_id;
    const listaEl   = document.getElementById('docEmpLista');
    if (!listaEl) return;

    if (!empresaId) {
        listaEl.innerHTML = '<div class="doc-emp-vazio">Empresa não vinculada.</div>';
        return;
    }

    listaEl.innerHTML = '<div class="doc-emp-carregando"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div>';

    const { data, error } = await supabaseClient.storage
        .from(BUCKET_DOCS)
        .list(`${empresaId}/`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (error || !data?.length) {
        listaEl.innerHTML = '<div class="doc-emp-vazio">Nenhum documento enviado ainda.</div>';
        return;
    }

    const itens = data.filter(d => d.name !== '.emptyFolderPlaceholder');
    if (!itens.length) {
        listaEl.innerHTML = '<div class="doc-emp-vazio">Nenhum documento enviado ainda.</div>';
        return;
    }

    listaEl.innerHTML = itens.map(doc => {
        const ext  = doc.name.split('.').pop().toLowerCase();
        const icone = ext === 'pdf' ? 'fa-file-pdf' : 'fa-file-csv';
        const cor   = ext === 'pdf' ? '#dc2626'     : '#16a34a';
        const size  = doc.metadata?.size ? formatarTamanho(doc.metadata.size) : '';
        const path  = `${empresaId}/${doc.name}`;
        const nome  = doc.name.replace(/^\d+_/, ''); // remove timestamp prefix for display
        return `
            <div class="doc-emp-item">
                <div class="doc-emp-icone" style="color:${cor};">
                    <i class="fa-solid ${icone}"></i>
                </div>
                <div class="doc-emp-info">
                    <div class="doc-emp-nome" title="${nome}">${nome}</div>
                    ${size ? `<div class="doc-emp-meta">${size} · ${ext.toUpperCase()}</div>` : `<div class="doc-emp-meta">${ext.toUpperCase()}</div>`}
                </div>
                <div class="doc-emp-acoes">
                    <button class="doc-emp-btn doc-emp-btn-baixar" onclick="baixarDocEmpresa('${path}','${nome}')" title="Baixar">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="doc-emp-btn doc-emp-btn-excluir" onclick="excluirDocEmpresa('${path}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

async function uploadDocEmpresa(files) {
    const empresaId = dadosPerfil?.empresa_id || usuarioAtual?.empresa_id;
    if (!empresaId) { mostrarToast('Sem empresa vinculada.', 'erro'); return; }
    if (!files?.length) return;

    const progWrap  = document.getElementById('uploadDocProgresso');
    const progBarra = document.getElementById('uploadDocBarraInner');
    const progTexto = document.getElementById('uploadDocProgTexto');

    progWrap.style.display = 'block';
    progBarra.style.width  = '0%';

    let enviados = 0;
    const total  = files.length;

    for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop().toLowerCase();

        if (!['pdf', 'csv'].includes(ext)) {
            mostrarToast(`${file.name}: tipo não suportado. Use PDF ou CSV.`, 'erro');
            continue;
        }
        if (file.size > 10 * 1024 * 1024) {
            mostrarToast(`${file.name}: excede o limite de 10 MB.`, 'erro');
            continue;
        }

        progTexto.textContent = `Enviando ${file.name}…`;

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${empresaId}/${Date.now()}_${safeName}`;

        const { error } = await supabaseClient.storage
            .from(BUCKET_DOCS)
            .upload(path, file);

        if (error) {
            mostrarToast(`Erro ao enviar ${file.name}: ${error.message}`, 'erro');
        } else {
            enviados++;
        }

        progBarra.style.width = `${Math.round(((enviados) / total) * 100)}%`;
    }

    progTexto.textContent = `${enviados} de ${total} arquivo(s) enviado(s).`;
    setTimeout(() => { progWrap.style.display = 'none'; progBarra.style.width = '0%'; }, 2500);

    document.getElementById('inputDocEmpresa').value = '';
    if (enviados > 0) {
        mostrarToast(`${enviados} documento(s) enviado(s) com sucesso!`, 'sucesso');
        carregarDocumentosEmpresa();
    }
}

async function baixarDocEmpresa(path, nome) {
    const { data, error } = await supabaseClient.storage
        .from(BUCKET_DOCS)
        .download(path);

    if (error) { mostrarToast('Erro ao baixar documento.', 'erro'); return; }

    const url = URL.createObjectURL(data);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function excluirDocEmpresa(path) {
    if (!confirm('Deseja excluir este documento? Esta ação não pode ser desfeita.')) return;

    const { error } = await supabaseClient.storage
        .from(BUCKET_DOCS)
        .remove([path]);

    if (error) { mostrarToast('Erro ao excluir: ' + error.message, 'erro'); return; }

    mostrarToast('Documento excluído.', 'sucesso');
    carregarDocumentosEmpresa();
}

function uploadDocDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadDocZone').classList.add('drag-over');
}
function uploadDocDragLeave() {
    document.getElementById('uploadDocZone').classList.remove('drag-over');
}
function uploadDocDrop(e) {
    e.preventDefault();
    document.getElementById('uploadDocZone').classList.remove('drag-over');
    uploadDocEmpresa(e.dataTransfer.files);
}

function formatarTamanho(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ========================================
// PLANO (admin)
// ========================================

function renderizarPlano(dados) {
    const planoKey      = dados.plano || 'basico';
    const plano         = PLANOS[planoKey] || PLANOS.basico;
    const ativos        = dados.usuarios_ativos || 0;
    const totalUsuarios = dados.total_usuarios  || 0;
    const isEmpresa     = planoKey === 'empresa';
    const proximos      = { basico: 'regular', regular: 'profissional', profissional: 'empresa' };
    const proximo       = proximos[planoKey];
    const capacidade    = isEmpresa ? totalUsuarios : plano.total;
    const vagas         = isEmpresa ? null : capacidade - ativos;
    const pct           = isEmpresa ? null : Math.min((ativos / capacidade) * 100, 100);
    const corBarra      = !isEmpresa && vagas === 0 ? '#dc2626' : vagas === 1 ? '#f59e0b' : plano.cor;

    // ── Badge no header ───────────────────────────────────────
    const badge = document.getElementById('planoBadge');
    badge.textContent      = plano.nome;
    badge.style.background = plano.corFundo;
    badge.style.color      = plano.cor;

    // ── Sidebar ───────────────────────────────────────────────
    const sidePlanoInfo = document.getElementById('sidePlanoInfo');
    if (sidePlanoInfo) sidePlanoInfo.innerHTML = `
        <div class="sidebar-plano-pill" style="background:${plano.corFundo}; color:${plano.cor};">
            <i class="fa-solid ${plano.icone}"></i> ${plano.nome}
        </div>
        <div class="sidebar-plano-uso">${ativos} ${ativos === 1 ? 'usuário ativo' : 'usuários ativos'}${!isEmpresa ? ` de ${capacidade}` : ''}</div>
        ${proximo ? `<div class="sidebar-plano-upgrade">Upgrade: ${PLANOS[proximo].nome}</div>` : ''}
    `;

    // ── Bloco principal ───────────────────────────────────────
    document.getElementById('planoGrid').innerHTML = `
        <div class="plano-bloco">
            <div class="plano-bloco-topo">
                <div class="plano-bloco-icone" style="background:${plano.corFundo}; color:${plano.cor};">
                    <i class="fa-solid ${plano.icone}"></i>
                </div>
                <div class="plano-bloco-info">
                    <div class="plano-bloco-nome" style="color:${plano.cor};">${plano.nome}</div>
                    <div class="plano-bloco-desc">${plano.descricao}</div>
                </div>
                <div class="plano-bloco-stats">
                    <div class="plano-bloco-stat">
                        <span class="plano-bloco-stat-val">${isEmpresa ? totalUsuarios : capacidade}</span>
                        <span class="plano-bloco-stat-lbl">${isEmpresa ? 'cadastrados' : 'licenças'}</span>
                    </div>
                    <div class="plano-bloco-stat-sep"></div>
                    <div class="plano-bloco-stat">
                        <span class="plano-bloco-stat-val" style="color:${plano.cor};">${ativos}</span>
                        <span class="plano-bloco-stat-lbl">ativos</span>
                    </div>
                    ${!isEmpresa ? `
                    <div class="plano-bloco-stat-sep"></div>
                    <div class="plano-bloco-stat">
                        <span class="plano-bloco-stat-val" style="color:${corBarra};">${vagas}</span>
                        <span class="plano-bloco-stat-lbl">disponíveis</span>
                    </div>` : ''}
                </div>
            </div>

            <div class="plano-bloco-recursos">
                ${(plano.recursos || []).map(r => `
                    <span class="plano-bloco-rec">
                        <i class="fa-solid fa-circle-check" style="color:${plano.cor};"></i>${r}
                    </span>`).join('')}
            </div>
        </div>
    `;

    // ── Barra de uso ──────────────────────────────────────────
    document.getElementById('planoUso').innerHTML = isEmpresa ? '' : `
        <div class="plano-uso-wrap">
            <div class="plano-uso-header">
                <span class="plano-uso-label">Licenças utilizadas</span>
                <span class="plano-uso-count" style="color:${corBarra};">${ativos} / ${capacidade}</span>
            </div>
            <div class="plano-barra-fundo">
                <div class="plano-barra-preenchida" style="width:${pct}%; background:${corBarra};"></div>
            </div>
            <span class="plano-uso-vagas" style="color:${corBarra};">
                ${vagas > 0 ? `${vagas} vaga${vagas !== 1 ? 's' : ''} disponível${vagas !== 1 ? 'is' : ''}` : 'Todas as licenças em uso'}
            </span>
        </div>
    `;

    // ── Upgrade ───────────────────────────────────────────────
    if (proximo) {
        const prox   = PLANOS[proximo];
        const ganhos = prox.recursos.filter(r => !plano.recursos.includes(r));
        document.getElementById('planoUpgrade').innerHTML = `
            <div class="plano-upgrade-banner">
                <div class="plano-upgrade-banner-esq">
                    <span class="plano-upgrade-banner-badge" style="background:${prox.corFundo}; color:${prox.cor};">
                        <i class="fa-solid ${prox.icone}"></i> ${prox.nome}
                    </span>
                    <span class="plano-upgrade-banner-texto">
                        Faça upgrade e tenha acesso a
                        ${ganhos.length ? `<strong>${ganhos[0]}</strong>${ganhos.length > 1 ? ` e mais ${ganhos.length - 1} recurso${ganhos.length > 2 ? 's' : ''}` : ''}` : 'mais recursos'}.
                    </span>
                </div>
                <button class="plano-upgrade-banner-btn" style="background:${prox.cor};" onclick="solicitarUpgrade('${proximo}')">
                    <i class="fa-solid fa-arrow-trend-up"></i> Upgrade
                </button>
            </div>
        `;
    } else {
        document.getElementById('planoUpgrade').innerHTML = `
            <div class="plano-maximo-banner">
                <i class="fa-solid fa-trophy" style="color:#ca8a04;"></i>
                <span>Você está no plano máximo — capacidade <strong>personalizada</strong> ativa.</span>
            </div>
        `;
    }
}

// ── Collapsible ───────────────────────────────────────────────
let _planoAberto = true;

function togglePlanoSection() {
    _planoAberto = !_planoAberto;
    const body = document.getElementById('planoBody');
    const icon = document.getElementById('planoToggleIcon');
    if (_planoAberto) {
        body.style.maxHeight = body.scrollHeight + 'px';
        icon.style.transform = 'rotate(0deg)';
        setTimeout(() => { body.style.maxHeight = '2000px'; }, 310);
    } else {
        body.style.maxHeight = body.scrollHeight + 'px';
        body.offsetHeight; // força reflow antes de animar para 0
        body.style.maxHeight = '0';
        icon.style.transform = 'rotate(-90deg)';
    }
}

function solicitarUpgrade(planoDesejado) {
    mostrarToast(`Entre em contato para migrar para o plano ${PLANOS[planoDesejado].nome}.`, 'sucesso');
}

// ========================================
// FOTO DE PERFIL
// ========================================

function previewFoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        mostrarToast('A foto deve ter no máximo 2MB.', 'erro');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = document.getElementById('avatarImg');
        const iniciais = document.getElementById('avatarGrande');
        img.src = e.target.result;
        img.style.display = 'block';
        iniciais.style.display = 'none';

        // Salvar no banco
        uploadFoto(file);
    };
    reader.readAsDataURL(file);
}

async function uploadFoto(file) {
    const fileName = `avatar_${usuarioAtual.id}_${Date.now()}.${file.name.split('.').pop()}`;

    // Upload para Supabase Storage (bucket 'avatars')
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

    if (uploadError) {
        mostrarToast('Erro ao enviar a foto.', 'erro');
        return;
    }

    const { data: urlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(fileName);

    const avatarUrl = urlData?.publicUrl;
    if (!avatarUrl) { mostrarToast('Erro ao obter URL da foto.', 'erro'); return; }

    // Salvar URL no banco e na sessão
    const res = await atualizarDadosPessoais(usuarioAtual.id, { avatar_url: avatarUrl });
    if (res.sucesso) {
        if (dadosPerfil) dadosPerfil.avatar_url = avatarUrl;

        // Persistir na sessão para que todas as outras páginas exibam o novo avatar
        usuarioAtual.avatar_url = avatarUrl;
        const sessaoStr = JSON.stringify(usuarioAtual);
        sessionStorage.setItem('usuarioLogado', sessaoStr);
        if (localStorage.getItem('usuarioSalvo')) {
            localStorage.setItem('usuarioSalvo', sessaoStr);
        }

        atualizarTopbar();
        mostrarToast('Foto de perfil atualizada!', 'sucesso');
    } else {
        mostrarToast('Foto enviada, mas houve erro ao salvar: ' + (res.mensagem || ''), 'erro');
    }
}

function carregarFoto(avatarUrl) {
    if (!avatarUrl) return;
    const img = document.getElementById('avatarImg');
    const iniciais = document.getElementById('avatarGrande');
    img.src = avatarUrl;
    img.style.display = 'block';
    iniciais.style.display = 'none';
}

// ========================================
// SEGURANÇA - TROCA DE SENHA POR CÓDIGO
// ========================================

function selecionarCanal(canal) {
    canalAtivo = canal;
    document.getElementById('btnCanalEmail').classList.toggle('active', canal === 'email');
    document.getElementById('btnCanalSms').classList.toggle('active', canal === 'sms');
    document.getElementById('segCanalEmailCard').style.display = canal === 'email' ? 'flex' : 'none';
    document.getElementById('segCanalSmsCard').style.display = canal === 'sms' ? 'flex' : 'none';
}

async function solicitarCodigo() {
    const email    = dadosPerfil?.email || usuarioAtual.email || '';
    const telefone = dadosPerfil?.telefone || '';

    if (canalAtivo === 'email' && !email) {
        mostrarToast('E-mail não encontrado na conta.', 'erro'); return;
    }
    if (canalAtivo === 'sms' && !telefone) {
        mostrarToast('Cadastre um telefone nos Dados Pessoais primeiro.', 'erro'); return;
    }

    codigoAtivo  = Math.floor(100000 + Math.random() * 900000).toString();
    codigoExpiry = Date.now() + 10 * 60 * 1000; // 10 min

    const btn = document.getElementById('btnSolicitarCodigo');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    const destino = canalAtivo === 'email'
        ? mascararEmail(email)
        : mascararTelefone(telefone);

    if (canalAtivo === 'email') {
        try {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                to_name:  dadosPerfil?.nome_completo || usuarioAtual.nome || 'Usuário',
                to_email: email,
                codigo:   codigoAtivo,
            });
        } catch (err) {
            console.error('[EmailJS] Falha ao enviar e-mail:', err);
            // Fallback: exibe o código no console para testes enquanto EmailJS não está configurado
            console.info(`[DEV] Código de verificação: ${codigoAtivo}`);
        }
    } else {
        // SMS: integração futura (Twilio, etc.)
        console.info(`[DEV] Código SMS: ${codigoAtivo}`);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Código';

    document.getElementById('segStep1').style.display = 'none';
    document.getElementById('segStep2').style.display = 'block';
    document.getElementById('segEmailDisplay').textContent = destino;

    mostrarToast(`Código enviado ${canalAtivo === 'email' ? 'por e-mail' : 'via SMS'} para ${destino}`, 'sucesso');
}

async function reenviarCodigo() {
    document.getElementById('segStep2').style.display = 'none';
    document.getElementById('segStep1').style.display = 'block';
    codigoAtivo  = null;
    codigoExpiry = null;
    document.getElementById('inputCodigo').value = '';
    document.getElementById('inputNovaSenha').value = '';
    document.getElementById('inputConfirmarSenha').value = '';
    await solicitarCodigo();
}

function voltarStep1() {
    document.getElementById('segStep2').style.display = 'none';
    document.getElementById('segStep1').style.display = 'block';
    codigoAtivo = null;
    codigoExpiry = null;
    document.getElementById('inputCodigo').value = '';
    document.getElementById('inputNovaSenha').value = '';
    document.getElementById('inputConfirmarSenha').value = '';
}

async function confirmarSenha() {
    const codigo = document.getElementById('inputCodigo').value.trim();
    const novaSenha = document.getElementById('inputNovaSenha').value;
    const confirmar = document.getElementById('inputConfirmarSenha').value;

    if (!codigo || !novaSenha || !confirmar) {
        mostrarToast('Preencha todos os campos.', 'erro'); return;
    }
    if (!codigoAtivo || Date.now() > codigoExpiry) {
        mostrarToast('Código expirado. Solicite um novo.', 'erro');
        voltarStep1(); return;
    }
    if (codigo !== codigoAtivo) {
        mostrarToast('Código de verificação incorreto.', 'erro'); return;
    }
    if (novaSenha !== confirmar) {
        mostrarToast('As senhas não coincidem.', 'erro'); return;
    }
    if (novaSenha.length < 6) {
        mostrarToast('A senha deve ter no mínimo 6 caracteres.', 'erro'); return;
    }

    const res = await redefinirSenha(usuarioAtual.id, novaSenha);
    if (res.sucesso) {
        voltarStep1();
        mostrarToast('Senha alterada com sucesso!', 'sucesso');
    } else {
        mostrarToast(res.mensagem || 'Erro ao alterar senha.', 'erro');
    }
}

// ========================================
// SALVAR DADOS PESSOAIS
// ========================================

async function salvarDados() {
    const btn = document.getElementById('btnSalvarDados');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const dados = {
        nome_completo: document.getElementById('inputNome').value.trim(),
        email: document.getElementById('inputEmail').value.trim(),
        cargo: document.getElementById('inputCargo').value.trim(),
        telefone: document.getElementById('inputTelefone').value.trim(),
    };

    if (!dados.nome_completo || !dados.email) {
        mostrarToast('Nome e e-mail são obrigatórios.', 'erro');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações';
        return;
    }

    const res = await atualizarDadosPessoais(usuarioAtual.id, dados);

    if (res.sucesso) {
        usuarioAtual = obterUsuarioLogado();
        // Atualizar dadosPerfil local
        if (dadosPerfil) Object.assign(dadosPerfil, { nome_completo: dados.nome_completo, email: dados.email, cargo: dados.cargo, telefone: dados.telefone });
        preencherSidebar();
        preencherFormulario();
        atualizarTopbar();
        mostrarToast('Dados atualizados com sucesso!', 'sucesso');
    } else {
        mostrarToast(res.mensagem || 'Erro ao salvar dados.', 'erro');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações';
}

// ========================================
// ALTERAR SENHA
// ========================================

async function salvarSenha() {
    const senhaAtual = document.getElementById('inputSenhaAtual').value;
    const novaSenha  = document.getElementById('inputNovaSenha').value;
    const confirmar  = document.getElementById('inputConfirmarSenha').value;

    if (!senhaAtual || !novaSenha || !confirmar) {
        mostrarToast('Preencha todos os campos de senha.', 'erro'); return;
    }
    if (novaSenha !== confirmar) {
        mostrarToast('A nova senha e a confirmação não coincidem.', 'erro'); return;
    }
    if (novaSenha.length < 6) {
        mostrarToast('A senha deve ter pelo menos 6 caracteres.', 'erro'); return;
    }

    const res = await atualizarSenha(usuarioAtual.id, senhaAtual, novaSenha);

    if (res.sucesso) {
        document.getElementById('inputSenhaAtual').value = '';
        document.getElementById('inputNovaSenha').value = '';
        document.getElementById('inputConfirmarSenha').value = '';
        mostrarToast('Senha alterada com sucesso!', 'sucesso');
    } else {
        mostrarToast(res.mensagem || 'Erro ao alterar senha.', 'erro');
    }
}

// ========================================
// UTILITÁRIOS
// ========================================

function toggleSenha(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function mascararCpf(cpf) {
    const d = cpf.replace(/\D/g, '');
    if (d.length !== 11) return cpf;
    return d.slice(0, 2) + '*.***.***-' + d.slice(-2);
}

function mascararTelefone(tel) {
    const d = tel.replace(/\D/g, '');
    if (d.length < 8) return tel;
    return d.slice(0, 2) + ' *****-' + d.slice(-4);
}

function mascararEmail(email) {
    if (!email || !email.includes('@')) return email;
    const [user, domain] = email.split('@');
    if (user.length <= 2) return `${user[0]}*@${domain}`;
    return `${user[0]}${'*'.repeat(Math.min(user.length - 2, 4))}${user[user.length - 1]}@${domain}`;
}

function formatarCnpj(cnpj) {
    const d = cnpj.replace(/\D/g, '');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return cnpj;
}

function formatarDataRelativa(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    if (h < 24) return `há ${h}h`;
    if (d === 1) return 'ontem';
    if (d < 7) return `há ${d} dias`;
    return new Date(iso).toLocaleDateString('pt-BR');
}

function formatarDataCompleta(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long',
        year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function focarCampoTelefone() {
    const el = document.getElementById('inputTelefone');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => el.focus(), 400);
    }
}

// ========================================
// MÁSCARAS
// ========================================

function _mascaraDocBR(valor) {
    const d = valor.replace(/\D/g, '');
    const tipo = document.getElementById('editEmpTipoCadastro')?.value;
    if (tipo === 'cpf') {
        const n = d.slice(0, 11);
        let o = n.slice(0, 3);
        if (n.length > 3) o += '.' + n.slice(3, 6);
        if (n.length > 6) o += '.' + n.slice(6, 9);
        if (n.length > 9) o += '-' + n.slice(9, 11);
        return o;
    } else {
        const n = d.slice(0, 14);
        let o = n.slice(0, 2);
        if (n.length > 2)  o += '.' + n.slice(2, 5);
        if (n.length > 5)  o += '.' + n.slice(5, 8);
        if (n.length > 8)  o += '/' + n.slice(8, 12);
        if (n.length > 12) o += '-' + n.slice(12, 14);
        return o;
    }
}

function _mascaraIE(valor) {
    const d = valor.replace(/\D/g, '').slice(0, 12);
    if (d.length <= 9) {
        let o = d.slice(0, 3);
        if (d.length > 3) o += '.' + d.slice(3, 6);
        if (d.length > 6) o += '.' + d.slice(6, 8);
        if (d.length > 8) o += '-' + d.slice(8, 9);
        return o;
    } else {
        let o = d.slice(0, 3);
        if (d.length > 3) o += '.' + d.slice(3, 6);
        if (d.length > 6) o += '.' + d.slice(6, 9);
        if (d.length > 9) o += '.' + d.slice(9, 12);
        return o;
    }
}

function _mascaraIM(valor) {
    const d = valor.replace(/\D/g, '').slice(0, 7);
    let o = d.slice(0, 6);
    if (d.length > 6) o += '-' + d.slice(6, 7);
    return o;
}

// ========================================
// EDITAR EMPRESA — TIPO / CEP
// ========================================

function editEmpAlterarTipo() {
    const tipoEl = document.getElementById('editEmpTipoCadastro');
    const tipo   = tipoEl?.value;
    const input  = document.getElementById('editEmpDocumento');
    if (!input) return;
    if (tipoEl?.disabled) return;  // campos bloqueados — não reabilitar
    input.disabled = !tipo;
    input.value = '';
    if (tipo === 'cnpj') {
        input.placeholder = '00.000.000/0000-00';
        input.maxLength = 18;
    } else if (tipo === 'cpf') {
        input.placeholder = '000.000.000-00';
        input.maxLength = 14;
    } else {
        input.placeholder = 'Selecione o tipo primeiro';
        input.maxLength = 18;
    }
}

async function editEmpBuscarCep() {
    const cep = document.getElementById('editEmpCep')?.value.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;
    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) return;
        const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
        set('editEmpEstado',  data.uf);
        set('editEmpCidade',  data.localidade);
        set('editEmpBairro',  data.bairro);
        set('editEmpEndereco', data.logradouro);
    } catch {}
}

function mostrarToast(msg, tipo = 'sucesso') {
    const toast = document.getElementById('toast');
    const icone = tipo === 'sucesso' ? 'circle-check' : 'circle-exclamation';
    toast.innerHTML = `<i class="fa-solid fa-${icone}"></i> ${msg}`;
    toast.className = `toast ${tipo} show`;
    setTimeout(() => toast.classList.remove('show'), 5000);
}
