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
        descricao: '1 usuário responsável, sem sub-usuários.'
    },
    regular: {
        nome: 'Regular', icone: 'fa-star', cor: '#3b82f6', corFundo: '#dbeafe',
        total: 3, admins: 1, subs: 2,
        descricao: '1 administrador + 2 sub-usuários.'
    },
    profissional: {
        nome: 'Profissional', icone: 'fa-rocket', cor: '#f7931e', corFundo: '#fff7ed',
        total: 5, admins: 2, subs: 3,
        descricao: '2 administradores + 3 sub-usuários.'
    },
    empresa: {
        nome: 'Empresa', icone: 'fa-building', cor: '#7c3aed', corFundo: '#ede9fe',
        total: null, admins: null, subs: null,
        descricao: 'Capacidade personalizada conforme contrato.'
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

    // Busca dados completos do DB (inclui ultimo_login, criado_em, cargo, telefone)
    const res = await buscarDadosPerfilCompleto();
    dadosPerfil = res.sucesso ? res.data : null;

    preencherSidebar();
    preencherFormulario();
    preencherEmpresa();
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
    const u = dadosPerfil || {};
    const empresa = u.empresas || {};
    const nomeEmpresa = empresa.razao_social || usuarioAtual.empresa || '—';
    const isAdmin = usuarioAtual.perfil === 'admin';
    const isSub = !isAdmin;
    const grid = document.getElementById('empresaInfoGrid');

    if (isSub) {
        document.getElementById('empresaSubtitulo').textContent =
            'Empresa ao qual sua conta está vinculada.';
    }

    const cnpj = empresa.cnpj || null;

    grid.innerHTML = `
        <div class="empresa-info-item">
            <div class="empresa-info-label"><i class="fa-solid fa-building"></i> Razão Social</div>
            <div class="empresa-info-valor">${nomeEmpresa}</div>
        </div>
        <div class="empresa-info-item">
            <div class="empresa-info-label"><i class="fa-solid fa-file-invoice"></i> CNPJ</div>
            <div class="empresa-info-valor">${cnpj ? formatarCnpj(cnpj) : '—'}</div>
        </div>
        <div class="empresa-info-item">
            <div class="empresa-info-label"><i class="fa-solid fa-id-card"></i> Perfil na Empresa</div>
            <div class="empresa-info-valor">
                ${{ admin: '<span class="empresa-role-badge role-admin">Administrador</span>',
                    gerente: '<span class="empresa-role-badge role-gerente">Gerente</span>',
                    usuario: '<span class="empresa-role-badge role-usuario">Usuário</span>' }[usuarioAtual.perfil] || '—'}
            </div>
        </div>
        ${isAdmin && empresa.chave_empresa ? `
        <div class="empresa-info-item empresa-info-full">
            <div class="empresa-info-label"><i class="fa-solid fa-key"></i> Chave de Acesso da Empresa</div>
            <div class="empresa-chave-row">
                <span class="empresa-chave-valor">${empresa.chave_empresa}</span>
                <button class="btn-copiar-chave" onclick="copiarChave('${empresa.chave_empresa}')">
                    <i class="fa-solid fa-copy"></i> Copiar
                </button>
            </div>
        </div>
        ` : ''}
        ${isSub ? `
        <div class="empresa-info-item empresa-info-full">
            <div class="empresa-membro-banner">
                <i class="fa-solid fa-people-group"></i>
                <div>
                    <div class="empresa-membro-titulo">Você faz parte do time <strong>${nomeEmpresa}</strong></div>
                    <div class="empresa-membro-desc">Sua conta está vinculada a esta empresa. Entre em contato com o administrador para informações sobre o plano.</div>
                </div>
            </div>
        </div>
        ` : ''}
    `;
}

function copiarChave(chave) {
    navigator.clipboard.writeText(chave).then(() => mostrarToast('Chave copiada!', 'sucesso'));
}

// ========================================
// PLANO (admin)
// ========================================

function renderizarPlano(dados) {
    const planoKey = dados.plano || 'basico';
    const plano = PLANOS[planoKey] || PLANOS.basico;
    const ativos = dados.usuarios_ativos || 0;
    const isEmpresa = planoKey === 'empresa';

    // Badge no header
    const badge = document.getElementById('planoBadge');
    badge.textContent = plano.nome;
    badge.style.background = plano.corFundo;
    badge.style.color = plano.cor;

    // Sidebar resumo
    const proximos = { basico: 'regular', regular: 'profissional', profissional: 'empresa' };
    const proximo = proximos[planoKey];
    document.getElementById('sidePlanoInfo').innerHTML = `
        <div class="sidebar-plano-pill" style="background:${plano.corFundo}; color:${plano.cor};">
            <i class="fa-solid ${plano.icone}"></i> ${plano.nome}
        </div>
        <div class="sidebar-plano-uso">${ativos} ${ativos === 1 ? 'usuário ativo' : 'usuários ativos'}
        ${!isEmpresa ? `de ${plano.total}` : ''}</div>
        ${proximo ? `<div class="sidebar-plano-upgrade">Upgrade disponível: ${PLANOS[proximo].nome}</div>` : ''}
    `;

    // Grid principal
    document.getElementById('planoGrid').innerHTML = `
        <div class="plano-info-card">
            <div class="plano-info-icone" style="background:${plano.corFundo}; color:${plano.cor};">
                <i class="fa-solid ${plano.icone}"></i>
            </div>
            <div>
                <div class="plano-info-titulo">Plano ${plano.nome}</div>
                <div class="plano-info-desc">${plano.descricao}</div>
            </div>
        </div>
        <div class="plano-slots">
            ${isEmpresa
                ? `<div class="plano-slot"><i class="fa-solid fa-infinity" style="color:#7c3aed;"></i><span>Usuários ilimitados</span></div>
                   <div class="plano-slot"><i class="fa-solid fa-handshake" style="color:#7c3aed;"></i><span>Capacidade personalizada</span></div>`
                : `<div class="plano-slot"><i class="fa-solid fa-users" style="color:#3b82f6;"></i><span><strong>${plano.total}</strong> usuário${plano.total !== 1 ? 's' : ''} no total</span></div>
                   <div class="plano-slot"><i class="fa-solid fa-user-shield" style="color:#f7931e;"></i><span><strong>${plano.admins}</strong> administrador${plano.admins !== 1 ? 'es' : ''}</span></div>
                   <div class="plano-slot"><i class="fa-solid fa-user" style="color:#64748b;"></i><span><strong>${plano.subs}</strong> sub-usuário${plano.subs !== 1 ? 's' : ''}</span></div>`
            }
        </div>
    `;

    // Barra de uso
    if (isEmpresa) {
        document.getElementById('planoUso').innerHTML = `
            <div class="plano-uso-box plano-uso-empresa">
                <i class="fa-solid fa-circle-check" style="color:#7c3aed;"></i>
                <span>${ativos} usuário${ativos !== 1 ? 's' : ''} ativo${ativos !== 1 ? 's' : ''} no momento</span>
            </div>`;
    } else {
        const total = plano.total;
        const pct = Math.min((ativos / total) * 100, 100);
        const vagas = total - ativos;
        const cor = vagas === 0 ? '#dc2626' : vagas === 1 ? '#f59e0b' : '#22c55e';
        document.getElementById('planoUso').innerHTML = `
            <div class="plano-uso-box">
                <div class="plano-uso-header">
                    <span class="plano-uso-label">Licenças utilizadas</span>
                    <span class="plano-uso-contagem" style="color:${cor};">${ativos} / ${total}</span>
                </div>
                <div class="plano-barra-fundo">
                    <div class="plano-barra-preenchida" style="width:${pct}%; background:${cor};"></div>
                </div>
                <div class="plano-vagas">
                    ${vagas > 0
                        ? `<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> ${vagas} vaga${vagas !== 1 ? 's' : ''} disponível${vagas !== 1 ? 'is' : ''}`
                        : `<i class="fa-solid fa-circle-exclamation" style="color:#dc2626;"></i> Nenhuma vaga disponível`}
                </div>
            </div>`;
    }

    // Upgrade
    if (proximo) {
        const proximoPlano = PLANOS[proximo];
        document.getElementById('planoUpgrade').innerHTML = `
            <div class="plano-upgrade-banner">
                <div class="plano-upgrade-texto">
                    <strong>Quer expandir seu time?</strong>
                    <span>Upgrade para o plano <strong>${proximoPlano.nome}</strong>
                    ${proximo !== 'empresa' ? `— até ${proximoPlano.total} usuários` : '— capacidade personalizada'}.</span>
                </div>
                <button class="btn-upgrade" onclick="solicitarUpgrade('${proximo}')">
                    <i class="fa-solid fa-arrow-up"></i> Fazer upgrade
                </button>
            </div>`;
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

function mostrarToast(msg, tipo = 'sucesso') {
    const toast = document.getElementById('toast');
    const icone = tipo === 'sucesso' ? 'circle-check' : 'circle-exclamation';
    toast.innerHTML = `<i class="fa-solid fa-${icone}"></i> ${msg}`;
    toast.className = `toast ${tipo} show`;
    setTimeout(() => toast.classList.remove('show'), 5000);
}
