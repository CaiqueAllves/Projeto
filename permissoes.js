// ========================================
// USUÁRIOS E PERMISSÕES - PAINEL ADMIN
// ========================================

let usuarioAtual = null;
let todosUsuarios = [];
let pendingToggle = null; // { id, ativoAtual }
let dadosPlanoAtual = null; // { plano, total_usuarios, usuarios_ativos }

const PLANO_SUBS = { basico: 0, regular: 2, profissional: 4, empresa: Infinity };

document.addEventListener('DOMContentLoaded', async function () {
    usuarioAtual = obterUsuarioLogado();
    if (!usuarioAtual) return;

    atualizarTopbar();

    // Somente admin/gerente pode acessar este painel
    if (usuarioAtual.perfil !== 'admin' && usuarioAtual.perfil !== 'gerente') {
        document.getElementById('semAcesso').style.display = 'block';
        return;
    }

    document.getElementById('painelAdmin').style.display = 'block';

    const [resultUsuarios, resultSolicitacoes, resultChave, resultPlano] = await Promise.all([
        buscarUsuariosDaEmpresa(),
        buscarSolicitacoesPendentes(),
        buscarChaveEmpresa(),
        buscarDadosPlano()
    ]);

    if (resultPlano.sucesso) dadosPlanoAtual = resultPlano.data;

    todosUsuarios = (resultUsuarios.data || []).filter(u => u.id !== usuarioAtual.id);

    // Chave visível apenas para admin
    if (usuarioAtual.perfil !== 'admin') {
        document.getElementById('secaoChaveEmpresa').style.display = 'none';
    }

    renderizarStats(todosUsuarios, resultSolicitacoes.data || []);
    renderizarChave(resultChave);
    renderizarSolicitacoes(resultSolicitacoes.data || []);
    renderizarUsuarios(todosUsuarios);
    renderizarAtividade(todosUsuarios);
});

// ========================================
// TOPBAR
// ========================================

function atualizarTopbar() {
    const el = document.getElementById('displayUsername');
    const em = document.getElementById('userEmail');
    if (el) el.textContent = usuarioAtual.nome || '—';
    if (em) em.textContent = usuarioAtual.email || '—';
}

// ========================================
// STATS
// ========================================

function renderizarStats(usuarios, solicitacoes) {
    document.getElementById('statTotal').textContent = usuarios.length;
    document.getElementById('statAtivos').textContent = usuarios.filter(u => u.ativo).length;
    document.getElementById('statInativos').textContent = usuarios.filter(u => !u.ativo).length;
    document.getElementById('statPendentes').textContent = solicitacoes.length;
}

// ========================================
// CHAVE DA EMPRESA
// ========================================

function renderizarChave(resultado) {
    if (resultado.sucesso && resultado.data) {
        document.getElementById('chaveEmpresaValor').textContent = resultado.data.chave_empresa || '—';
    }
}

function copiarChave() {
    const chave = document.getElementById('chaveEmpresaValor').textContent;
    navigator.clipboard.writeText(chave).then(() => mostrarToast('Chave copiada!', 'sucesso'));
}

// ========================================
// SOLICITAÇÕES PENDENTES
// ========================================

function renderizarSolicitacoes(solicitacoes) {
    const secao = document.getElementById('secaoSolicitacoes');
    const badge = document.getElementById('badgePendentes');
    badge.textContent = solicitacoes.length;

    if (solicitacoes.length > 0) {
        secao.style.display = 'block';
    }

    const container = document.getElementById('listaSolicitacoes');

    if (solicitacoes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>Nenhuma solicitação pendente.</p>
            </div>`;
        return;
    }

    container.innerHTML = solicitacoes.map(sol => `
        <div class="solicitacao-item" id="sol-${sol.id}">
            <div class="sol-avatar">
                ${iniciaisDe(sol.nome_usuario)}
            </div>
            <div class="sol-info">
                <div class="sol-nome">${sol.nome_usuario || '—'}</div>
                <div class="sol-email">${sol.email_usuario || '—'}</div>
                <div class="sol-data"><i class="fa-regular fa-clock"></i> Solicitado em ${formatarData(sol.criado_em)}</div>
            </div>
            <div class="sol-acoes">
                <button class="btn-aprovar" onclick="responder('${sol.id}', true)">
                    <i class="fa-solid fa-check"></i> Aprovar
                </button>
                <button class="btn-rejeitar" onclick="responder('${sol.id}', false)">
                    <i class="fa-solid fa-xmark"></i> Rejeitar
                </button>
            </div>
        </div>
    `).join('');
}

async function responder(id, aprovado) {
    const resultado = await responderSolicitacao(id, aprovado);
    if (resultado.sucesso) {
        document.getElementById(`sol-${id}`)?.remove();
        const pendentes = document.querySelectorAll('.solicitacao-item').length;
        document.getElementById('badgePendentes').textContent = pendentes;
        document.getElementById('statPendentes').textContent = pendentes;

        if (pendentes === 0) {
            document.getElementById('listaSolicitacoes').innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-inbox"></i>
                    <p>Nenhuma solicitação pendente.</p>
                </div>`;
        }

        mostrarToast(aprovado ? 'Usuário aprovado com sucesso!' : 'Solicitação rejeitada.', aprovado ? 'sucesso' : 'erro');

        if (aprovado) {
            const res = await buscarUsuariosDaEmpresa();
            todosUsuarios = (res.data || []).filter(u => u.id !== usuarioAtual.id);
            renderizarUsuarios(todosUsuarios);
            renderizarAtividade(todosUsuarios);
            document.getElementById('statTotal').textContent = todosUsuarios.length;
            document.getElementById('statAtivos').textContent = todosUsuarios.filter(u => u.ativo).length;
            document.getElementById('statInativos').textContent = todosUsuarios.filter(u => !u.ativo).length;
        }
    } else {
        mostrarToast('Erro ao processar solicitação.', 'erro');
    }
}

// ========================================
// USUÁRIOS - CARDS
// ========================================

function renderizarUsuarios(usuarios) {
    const container = document.getElementById('usuariosContainer');
    const countEl = document.getElementById('usuariosCount');

    if (usuarios.length === 0) {
        countEl.textContent = '';
        container.innerHTML = `
            <div class="empty-state-usuarios">
                <div class="empty-usuarios-icon">
                    <i class="fa-solid fa-user-plus"></i>
                </div>
                <h4>Nenhum sub-usuário cadastrado</h4>
                <p>Compartilhe a <strong>chave de acesso</strong> da empresa com seus colaboradores.<br>
                Ao se cadastrar com a chave, eles aparecerão aqui aguardando sua aprovação.</p>
            </div>`;
        return;
    }

    countEl.textContent = `${usuarios.length} usuário${usuarios.length !== 1 ? 's' : ''}`;

    const perfisLabel = { admin: 'Admin', gerente: 'Gerente', usuario: 'Usuário' };
    const perfisBadge = { admin: 'badge-admin', gerente: 'badge-gerente', usuario: 'badge-usuario' };

    container.innerHTML = `
        <div class="usuarios-grid">
            ${usuarios.map(u => {
                const iniciais = iniciaisDe(u.nome_completo);
                const badgeStatus = u.ativo ? 'badge-status-ativo' : 'badge-status-inativo';
                const badgePerfil = perfisBadge[u.perfil] || 'badge-usuario';
                const isAdmin = usuarioAtual.perfil === 'admin';

                return `
                <div class="usuario-card ${u.ativo ? '' : 'usuario-inativo'}" id="card-${u.id}">
                    <div class="usuario-card-top">
                        <div class="usuario-card-avatar">${iniciais}</div>
                        <div class="usuario-card-identidade">
                            <div class="usuario-card-nome">${u.nome_completo || '—'}</div>
                            <div class="usuario-card-email">${u.email || '—'}</div>
                            ${u.cargo ? `<div class="usuario-card-cargo"><i class="fa-solid fa-briefcase"></i> ${u.cargo}</div>` : ''}
                        </div>
                        <span class="${badgeStatus} badge-status-card">${u.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>

                    <div class="usuario-card-info">
                        <div class="usuario-info-item">
                            <span class="usuario-info-label">CPF</span>
                            <span class="usuario-info-valor">${u.cpf || '—'}</span>
                        </div>
                        <div class="usuario-info-item">
                            <span class="usuario-info-label">Último acesso</span>
                            <span class="usuario-info-valor">${u.ultimo_login ? formatarDataRelativa(u.ultimo_login) : 'Nunca acessou'}</span>
                        </div>
                    </div>

                    <div class="usuario-card-controles">
                        <div class="usuario-controle-grupo">
                            <label class="controle-label">Perfil de acesso</label>
                            ${isAdmin
                                ? `<select class="perfil-select" onchange="alterarPerfil('${u.id}', this.value)">
                                    <option value="gerente" ${u.perfil === 'gerente' ? 'selected' : ''}>Gerente</option>
                                    <option value="usuario" ${u.perfil === 'usuario' ? 'selected' : ''}>Usuário</option>
                                   </select>`
                                : `<span class="badge-perfil ${badgePerfil}">${perfisLabel[u.perfil] || u.perfil}</span>`
                            }
                        </div>
                        ${isAdmin
                            ? `<button class="btn-toggle-usuario ${u.ativo ? 'btn-desativar' : 'btn-ativar'}"
                                onclick="confirmarToggle('${u.id}', ${u.ativo}, '${(u.nome_completo || '').replace(/'/g, "\\'")}')">
                                <i class="fa-solid fa-${u.ativo ? 'ban' : 'circle-check'}"></i>
                                ${u.ativo ? 'Desativar' : 'Ativar'}
                               </button>`
                            : ''
                        }
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

// ========================================
// ATIVIDADE RECENTE
// ========================================

function renderizarAtividade(usuarios) {
    const secao = document.getElementById('secaoAtividade');
    const container = document.getElementById('listaAtividade');

    const comLogin = usuarios
        .filter(u => u.ultimo_login)
        .sort((a, b) => new Date(b.ultimo_login) - new Date(a.ultimo_login));

    if (comLogin.length === 0) {
        secao.style.display = 'none';
        return;
    }

    secao.style.display = 'block';

    container.innerHTML = `
        <div class="atividade-lista">
            ${comLogin.map((u, i) => `
                <div class="atividade-item">
                    <div class="atividade-avatar">${iniciaisDe(u.nome_completo)}</div>
                    <div class="atividade-info">
                        <span class="atividade-nome">${u.nome_completo || '—'}</span>
                        <span class="atividade-acao">acessou o sistema</span>
                    </div>
                    <div class="atividade-tempo">
                        <i class="fa-regular fa-clock"></i>
                        ${formatarDataRelativa(u.ultimo_login)}
                    </div>
                </div>
            `).join('')}
        </div>`;
}

// ========================================
// AÇÕES DO ADMIN
// ========================================

function confirmarToggle(id, ativoAtual, nome) {
    pendingToggle = { id, ativoAtual };
    const acao = ativoAtual ? 'Desativar' : 'Ativar';
    const descricao = ativoAtual
        ? `<strong>${nome}</strong> perderá acesso imediato ao sistema.`
        : `<strong>${nome}</strong> voltará a ter acesso ao sistema.`;

    document.getElementById('modalDesativarTitulo').textContent = `${acao} usuário?`;
    document.getElementById('modalDesativarTexto').innerHTML = descricao;

    const btnConfirmar = document.getElementById('btnConfirmarToggle');
    btnConfirmar.textContent = acao;
    btnConfirmar.className = `btn-modal-confirm ${ativoAtual ? 'btn-modal-danger' : 'btn-modal-success'}`;
    btnConfirmar.onclick = executarToggle;

    document.getElementById('modalDesativar').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modalDesativar').style.display = 'none';
    pendingToggle = null;
}

async function executarToggle() {
    if (!pendingToggle) return;
    const { id, ativoAtual } = pendingToggle;
    fecharModal();

    const novoStatus = !ativoAtual;
    const res = await ativarDesativarUsuario(id, novoStatus);

    if (res.sucesso) {
        const u = todosUsuarios.find(u => u.id === id);
        if (u) u.ativo = novoStatus;
        renderizarUsuarios(todosUsuarios);
        document.getElementById('statAtivos').textContent = todosUsuarios.filter(u => u.ativo).length;
        document.getElementById('statInativos').textContent = todosUsuarios.filter(u => !u.ativo).length;
        mostrarToast(novoStatus ? 'Usuário ativado com sucesso.' : 'Usuário desativado.', novoStatus ? 'sucesso' : 'erro');
    } else {
        mostrarToast('Erro ao alterar status do usuário.', 'erro');
    }
}

async function alterarPerfil(id, perfil) {
    const res = await atualizarPerfilUsuario(id, perfil);
    if (res.sucesso) {
        const u = todosUsuarios.find(u => u.id === id);
        if (u) u.perfil = perfil;
        mostrarToast('Perfil atualizado com sucesso!', 'sucesso');
    } else {
        mostrarToast('Erro ao atualizar perfil.', 'erro');
        renderizarUsuarios(todosUsuarios);
    }
}

// ========================================
// NOVO USUÁRIO MANUAL
// ========================================

function abrirModalNovoUsuario() {
    const planoKey = dadosPlanoAtual?.plano || 'basico';
    const totalAtual = dadosPlanoAtual?.total_usuarios ?? (todosUsuarios.length + 1);

    const PLANO_TOTAL = { basico: 1, regular: 3, profissional: 5, empresa: Infinity };
    const limiteTotal = PLANO_TOTAL[planoKey] ?? 1;

    if (totalAtual >= limiteTotal) {
        window.location.href = 'inicio.html';
        return;
    }

    // Limpa o formulário
    ['novoNome', 'novoCpf', 'novoEmail', 'novaSenha', 'novoDataNasc'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('novoPerfil').value = 'usuario';

    // Reseta ícone de senha
    const icon = document.getElementById('iconNovaSenha');
    if (icon) icon.className = 'fa-solid fa-eye';
    const senhaInput = document.getElementById('novaSenha');
    if (senhaInput) senhaInput.type = 'password';

    document.getElementById('modalNovoUsuario').classList.add('active');
}

function fecharModalNovoUsuario() {
    document.getElementById('modalNovoUsuario').classList.remove('active');
}

function toggleNovaSenha(btn) {
    const input = document.getElementById('novaSenha');
    const icon = document.getElementById('iconNovaSenha');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}

async function salvarNovoUsuario() {
    const nome       = document.getElementById('novoNome').value.trim();
    const cpf        = document.getElementById('novoCpf').value.replace(/\D/g, '');
    const email      = document.getElementById('novoEmail').value.trim();
    const senha      = document.getElementById('novaSenha').value;
    const perfil     = document.getElementById('novoPerfil').value;
    const dataNasc   = document.getElementById('novoDataNasc').value || null;

    if (!nome || !cpf || !email || !senha) {
        mostrarToast('Preencha todos os campos obrigatórios.', 'erro'); return;
    }
    if (cpf.length !== 11) {
        mostrarToast('CPF inválido — digite 11 dígitos.', 'erro'); return;
    }
    if (senha.length < 6) {
        mostrarToast('A senha deve ter no mínimo 6 caracteres.', 'erro'); return;
    }

    const btn = document.getElementById('btnSalvarNovoUsuario');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const res = await criarSubUsuario({ nome, cpf, email, senha, perfil, dataNasc });

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Usuário';


    if (res.sucesso) {
        fecharModalNovoUsuario();
        mostrarToast('Usuário criado com sucesso!', 'sucesso');

        // Recarrega a lista
        const resultUsuarios = await buscarUsuariosDaEmpresa();
        todosUsuarios = (resultUsuarios.data || []).filter(u => u.id !== usuarioAtual.id);
        renderizarUsuarios(todosUsuarios);
        renderizarAtividade(todosUsuarios);
        renderizarStats(todosUsuarios, []);

        if (dadosPlanoAtual) dadosPlanoAtual.total_usuarios = (dadosPlanoAtual.total_usuarios || 0) + 1;
    } else {
        mostrarToast(res.mensagem || 'Erro ao criar usuário.', 'erro');
    }
}

// Fecha modal de novo usuário clicando fora
document.addEventListener('click', function (e) {
    const modal = document.getElementById('modalNovoUsuario');
    if (e.target === modal) fecharModalNovoUsuario();
}, true);

// ========================================
// UTILITÁRIOS
// ========================================

function iniciaisDe(nome) {
    if (!nome) return '?';
    return nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function formatarData(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
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

function mostrarToast(msg, tipo = 'sucesso') {
    const toast = document.getElementById('toast');
    const icone = tipo === 'sucesso' ? 'circle-check' : 'circle-exclamation';
    toast.innerHTML = `<i class="fa-solid fa-${icone}"></i> ${msg}`;
    toast.className = `toast ${tipo} show`;
    setTimeout(() => toast.classList.remove('show'), 5000);
}

// Fechar modal clicando fora
document.addEventListener('click', function (e) {
    const modal = document.getElementById('modalDesativar');
    if (e.target === modal) fecharModal();
});
