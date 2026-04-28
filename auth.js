// ========================================
// SISTEMA DE AUTENTICAÇÃO (COMPARTILHADO)
// ========================================

// Verificar autenticação ao carregar qualquer página (exceto login)
window.addEventListener('load', function() {
    const paginaAtual = window.location.pathname.split('/').pop();
    
    // Se não for a página de login, verificar autenticação
    if (paginaAtual !== 'login.html' && paginaAtual !== '' && paginaAtual !== '/') {
        verificarAutenticacao();
    } else if (paginaAtual === 'login.html' || paginaAtual === '' || paginaAtual === '/') {
        // Na página de login, verificar auto-login
        verificarAutoLogin();
    }
});

// Verificar se usuário está autenticado
function verificarAutenticacao() {
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
        // Usuário autenticado - atualizar interface
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
                // Reutiliza img existente (perfil.html já tem #topbarAvatarImg) ou cria uma nova
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
        }

        // Notificar admin sobre solicitações pendentes
        if (usuarioAtual.perfil === 'admin' && usuarioAtual.empresa_id && window.supabaseAPI) {
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
    } else {
        // Não autenticado - redirecionar para login
        window.location.href = 'login.html';
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
function handleLogout() {
    if (confirm('Deseja realmente sair do sistema?')) {
        sessionStorage.removeItem('usuarioLogado');
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('usuarioSalvo');
        localStorage.removeItem('cpfSalvo');
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
