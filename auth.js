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

    if (usuarioAtual) {
        _authAtualizarInterface(usuarioAtual);
        _authNotificarSolicitacoesPendentes(usuarioAtual);

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
function _authNotificarSolicitacoesPendentes(usuarioAtual) {
    if (_authSolicitacoesNotificadas) return;
    if (usuarioAtual.perfil === 'admin' && usuarioAtual.empresa_id && window.supabaseAPI) {
        _authSolicitacoesNotificadas = true;
        setTimeout(async () => {
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
    
    if (usuarioSessao || (rememberMe && usuarioLocal)) {
        // Já está logado - redirecionar para dashboard
        window.location.href = 'inicio.html';
    } else {
        // Preencher CPF se salvo
        const savedCpf = localStorage.getItem('cpfSalvo');
        const cpfInput = document.getElementById('cpf');
        if (savedCpf && cpfInput) {
            cpfInput.value = savedCpf;
        }
    }
}

// Função de Logout
// Sair sempre encerra a sessão de vez, mesmo com "Lembrar-me" ativo (login
// automático não deve sobreviver a um logout explícito). cpfSalvo é mantido
// de propósito, só pra não precisar redigitar o CPF na próxima vez.
function handleLogout() {
    if (confirm('Deseja realmente sair do sistema?')) {
        sessionStorage.removeItem('usuarioLogado');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('usuarioSalvo');
        localStorage.removeItem('lastLogin');
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
