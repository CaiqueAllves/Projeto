// ========================================
// SISTEMA DE AUTENTICAÇÃO (COMPARTILHADO)
// ========================================

// Páginas que podem ser vistas sem login (ex: políticas legais)
const PAGINAS_PUBLICAS = ['termos.html'];

// Verificar autenticação ao carregar qualquer página (exceto login)
window.addEventListener('load', function() {
    const paginaAtual = window.location.pathname.split('/').pop();

    if (paginaAtual === 'login.html' || paginaAtual === '' || paginaAtual === '/') {
        // Na página de login, verificar auto-login
        verificarAutoLogin();
    } else if (PAGINAS_PUBLICAS.includes(paginaAtual)) {
        // Página pública: mostra dados do usuário se logado, mas não redireciona se anônimo
        verificarAutenticacao({ redirecionar: false });
    } else {
        // Demais páginas exigem login
        verificarAutenticacao({ redirecionar: true });
    }
});

// Conta sandbox (cadastro sem chave/empresa, ver login.js `realizarCadastro`)
// tem 24h de acesso — `empresa_expira_em` só existe pra esse tipo de conta,
// vira null assim que o usuário se vincula a uma empresa de verdade.
function _authSandboxExpirado(usuarioAtual) {
    return !!usuarioAtual.empresa_expira_em && new Date(usuarioAtual.empresa_expira_em) <= new Date();
}

function _authEncerrarSessaoExpirada() {
    sessionStorage.removeItem('usuarioLogado');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('usuarioSalvo');
    localStorage.removeItem('lastLogin');
}

// Bloqueia ações de criação/edição/upload de dados de negócio pra contas
// sandbox ainda sem empresa vinculada — a expiração de 24h em si já é
// tratada em verificarAutenticacao()/verificarAutoLogin()/handleLogin
// (login.js), então se chegou até aqui a sessão é válida, só falta saber
// se está vinculada a uma empresa real. Usar como guarda de uma linha:
// `if (!exigirEmpresaVinculada()) return;` no topo de toda função que salva
// ou envia arquivo.
function exigirEmpresaVinculada() {
    const usuario = (typeof obterUsuarioLogado === 'function')
        ? obterUsuarioLogado()
        : JSON.parse(sessionStorage.getItem('usuarioLogado') || 'null');
    if (usuario && usuario.empresa_status === 'sandbox') {
        mostrarNotificacao('Ação indisponível em conta sem empresa vinculada. Acesse Perfil para inserir uma chave de empresa ou cadastrar a sua.', 'warning');
        return false;
    }
    return true;
}

// Verificar se usuário está autenticado
function verificarAutenticacao(opcoes = {}) {
    const redirecionar = opcoes.redirecionar !== false;
    const usuarioSessao = sessionStorage.getItem('usuarioLogado');
    const usuarioLocal = localStorage.getItem('usuarioSalvo');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';

    let usuarioAtual = null;

    if (usuarioSessao) {
        usuarioAtual = JSON.parse(usuarioSessao);
    } else if (rememberMe && usuarioLocal) {
        usuarioAtual = JSON.parse(usuarioLocal);
        sessionStorage.setItem('usuarioLogado', usuarioLocal);
    }

    if (usuarioAtual && _authSandboxExpirado(usuarioAtual)) {
        _authEncerrarSessaoExpirada();
        window.location.href = 'login.html?trial_expirado=1';
        return;
    }

    if (usuarioAtual) {
        _authAtualizarInterface(usuarioAtual);
        _authNotificarSolicitacoesPendentes(usuarioAtual);

        // Migração de autenticação (ver auditoria de segurança): a sessão
        // customizada acima não basta mais sozinha — as consultas de verdade
        // agora exigem uma sessão real do Supabase Auth por trás (criada no
        // login, guardada em localStorage por conta do próprio supabase-js).
        // Sem isso a tela ficaria "quebrada" (sem dado nenhum, sem aviso
        // nenhum) pra quem tem uma sessão customizada de antes da migração
        // — então checa e força um re-login limpo em vez de deixar quebrado.
        if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth) {
            supabaseClient.auth.getSession().then(({ data }) => {
                if (!data.session) {
                    _authEncerrarSessaoExpirada();
                    window.location.href = 'login.html?sessao_expirada=1';
                }
            });
        }

        // O snapshot acima (sessionStorage/localStorage) pode estar desatualizado
        // — nome, avatar, empresa ou cargo podem ter mudado desde o último login
        // manual, e o auto-login via "Lembrar-me" nunca reconsultava o banco pra
        // refletir isso. Busca os dados reais em segundo plano e re-renderiza.
        if (window.supabaseAPI?.atualizarUsuarioLogado) {
            window.supabaseAPI.atualizarUsuarioLogado().then(atualizado => {
                if (atualizado) _authAtualizarInterface(atualizado);
            });
        }
    } else if (redirecionar) {
        // Não autenticado - redirecionar para login
        window.location.href = 'login.html';
    } else {
        // Não autenticado, mas página pública: exibir versão para visitante
        document.body.classList.add('visitante-anonimo');
    }
}

function _authAtualizarInterface(usuarioAtual) {
    const displayUsername = document.getElementById('displayUsername');
    const empresaNome = document.getElementById('empresaNome');

    if (displayUsername) {
        displayUsername.textContent = usuarioAtual.nome;
    }
    if (empresaNome) {
        empresaNome.textContent = usuarioAtual.empresa;
    }

    // Avatar na topbar (todas as páginas)
    if (usuarioAtual.avatar_url) {
        const avatarWrap = document.querySelector('.user-avatar');
        if (avatarWrap) {
            const icon = avatarWrap.querySelector('i');
            if (icon) icon.style.display = 'none';
            let img = avatarWrap.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;position:absolute;top:0;left:0;';
                avatarWrap.style.position = 'relative';
                avatarWrap.appendChild(img);
            }
            img.src = usuarioAtual.avatar_url;
            img.style.display = 'block';
        }

        // Atualizar botão de conta mobile
        const contaBtn = document.querySelector('.mob-conta-btn');
        if (contaBtn) {
            contaBtn.innerHTML = `<img src="${usuarioAtual.avatar_url}" class="mob-conta-avatar-img" alt="avatar">`;
        }
    }
}

// Roda uma única vez por carregamento de página, mesmo que a interface seja
// re-renderizada depois com os dados atualizados do banco (evita notificação
// duplicada quando o refresh em segundo plano chama _authAtualizarInterface de novo).
let _authSolicitacoesNotificadas = false;
// Throttle de ~5min entre checagens (revisão de performance): sem isso,
// um admin navegando entre telas disparava essa consulta de novo em toda
// página — o timestamp em sessionStorage sobrevive à navegação (só não
// sobrevive a fechar a aba), diferente de _authSolicitacoesNotificadas
// abaixo, que é só pra não checar 2x na MESMA página.
const _AUTH_SOLICITACOES_INTERVALO_MS = 5 * 60 * 1000;

function _authNotificarSolicitacoesPendentes(usuarioAtual) {
    if (_authSolicitacoesNotificadas) return;
    if (usuarioAtual.perfil === 'admin' && usuarioAtual.empresa_id && window.supabaseAPI) {
        const ultimaChecagem = Number(sessionStorage.getItem('solicitacoesUltimaChecagem') || 0);
        if (Date.now() - ultimaChecagem < _AUTH_SOLICITACOES_INTERVALO_MS) return;

        _authSolicitacoesNotificadas = true;
        setTimeout(async () => {
            sessionStorage.setItem('solicitacoesUltimaChecagem', String(Date.now()));
            const resultado = await window.supabaseAPI.buscarSolicitacoes();
            if (resultado.sucesso && resultado.data && resultado.data.length > 0) {
                const qtd = resultado.data.length;
                mostrarNotificacao(
                    `Você tem ${qtd} solicitação(ões) pendente(s) de entrada na empresa. Acesse Configurações > Usuários para aprovar.`,
                    'warning'
                );
            }
        }, 1000);
    }
}

// Verificar auto-login na página de login
function verificarAutoLogin() {
    const usuarioSessao = sessionStorage.getItem('usuarioLogado');
    const usuarioLocal = localStorage.getItem('usuarioSalvo');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    const usuarioAtual = usuarioSessao ? JSON.parse(usuarioSessao) : ((rememberMe && usuarioLocal) ? JSON.parse(usuarioLocal) : null);

    if (usuarioAtual && _authSandboxExpirado(usuarioAtual)) {
        // Sessão existia mas o prazo de 24h já bateu — encerra e deixa a
        // tela de login normal aparecer, com o aviso, em vez de seguir pro
        // auto-login (senão o usuário nunca vê a tela pra se vincular).
        _authEncerrarSessaoExpirada();
        mostrarNotificacao('Seu período de avaliação de 24h expirou. Insira uma chave de empresa ou cadastre sua empresa para continuar.', 'error');
        return;
    }

    if (usuarioAtual) {
        // Já está logado - redirecionar para o app (abas)
        window.location.href = 'app.html';
    } else {
        // Preencher CPF se salvo
        const savedCpf = localStorage.getItem('cpfSalvo');
        const cpfInput = document.getElementById('cpf');
        if (savedCpf && cpfInput) {
            cpfInput.value = savedCpf;
        }
    }
}

// ========================================
// CONFIRMAÇÃO (no lugar do confirm() do navegador)
// ========================================
// confirmarAcao(mensagem, { titulo, confirmar, cancelar, perigo }) -> Promise<boolean>
// Ex.: if (!(await confirmarAcao('Excluir este item?', { perigo: true, confirmar: 'Excluir' }))) return;
function confirmarAcao(mensagem, opcoes = {}) {
    return new Promise(resolve => {
        const { titulo = 'Confirmar ação', confirmar = 'Confirmar', cancelar = 'Cancelar', perigo = false } = opcoes;
        const overlay = document.createElement('div');
        overlay.className = 'confirmar-overlay';
        overlay.innerHTML = `
            <div class="confirmar-caixa" role="alertdialog" aria-modal="true">
                <div class="confirmar-icone ${perigo ? 'confirmar-icone--perigo' : ''}"><i class="fa-solid ${perigo ? 'fa-triangle-exclamation' : 'fa-circle-question'}"></i></div>
                <h3 class="confirmar-titulo"></h3>
                <p class="confirmar-msg"></p>
                <div class="confirmar-acoes">
                    <button type="button" class="confirmar-btn confirmar-btn--cancelar"></button>
                    <button type="button" class="confirmar-btn ${perigo ? 'confirmar-btn--perigo' : 'confirmar-btn--ok'}"></button>
                </div>
            </div>`;
        overlay.querySelector('.confirmar-titulo').textContent = titulo;
        overlay.querySelector('.confirmar-msg').textContent = mensagem;
        const btnCancelar = overlay.querySelector('.confirmar-btn--cancelar');
        const btnOk = overlay.querySelector('.confirmar-btn:not(.confirmar-btn--cancelar)');
        btnCancelar.textContent = cancelar;
        btnOk.textContent = confirmar;

        const fechar = resultado => {
            document.removeEventListener('keydown', teclas, true);
            overlay.classList.add('confirmar-saindo');
            setTimeout(() => overlay.remove(), 140);
            resolve(resultado);
        };
        const teclas = e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(false); }
            else if (e.key === 'Enter' && document.activeElement !== btnCancelar) { e.preventDefault(); e.stopPropagation(); fechar(true); }
        };
        btnCancelar.addEventListener('click', () => fechar(false));
        btnOk.addEventListener('click', () => fechar(true));
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) fechar(false); });
        document.addEventListener('keydown', teclas, true);
        document.body.appendChild(overlay);
        (perigo ? btnCancelar : btnOk).focus(); // ação destrutiva: foco começa no Cancelar
    });
}

// Função de Logout
// Sair sempre encerra a sessão de vez, mesmo com "Lembrar-me" ativo (login
// automático não deve sobreviver a um logout explícito). cpfSalvo é mantido
// de propósito, só pra não precisar redigitar o CPF na próxima vez.
async function handleLogout() {
    if (await confirmarAcao('Deseja realmente sair do sistema?', { titulo: 'Sair do sistema', confirmar: 'Sair' })) {
        sessionStorage.removeItem('usuarioLogado');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('usuarioSalvo');
        localStorage.removeItem('lastLogin');
        sessionStorage.removeItem('abas_abertas_v2');
        window.location.href = 'login.html';
    }
}

// Alternar visibilidade da senha
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('.toggle-password');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

// Sistema de Notificações
function mostrarNotificacao(mensagem, tipo = 'info') {
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao notificacao-${tipo}`;
    
    const icones = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };
    
    notificacao.innerHTML = `
        <i class="fa-solid ${icones[tipo]}"></i>
        <span>${mensagem}</span>
    `;
    
    document.body.appendChild(notificacao);
    setTimeout(() => notificacao.classList.add('show'), 10);
    
    setTimeout(() => {
        notificacao.classList.remove('show');
        setTimeout(() => notificacao.remove(), 300);
    }, 5000);
}
