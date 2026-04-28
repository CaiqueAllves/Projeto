// ========================================
// LOGIN - JAVASCRIPT
// ========================================

// Aplicar máscara de CPF
function aplicarMascaraCPF(input) {
    input.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        
        value = value.replace(/^(\d{3})(\d)/, '$1.$2');
        value = value.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        value = value.replace(/\.(\d{3})(\d)/, '.$1-$2');
        
        e.target.value = value;
    });
}

// Validar CPF
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digito1 = resto >= 10 ? 0 : resto;
    
    if (digito1 !== parseInt(cpf.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digito2 = resto >= 10 ? 0 : resto;
    
    if (digito2 !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

// Alternar visibilidade da senha
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');
    
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

// Preencher credenciais de teste (agora com CPF)
function preencherCredenciais(cpf, senha) {
    document.getElementById('cpf').value = cpf;
    document.getElementById('password').value = senha;
    
    // Adicionar efeito visual
    const inputs = document.querySelectorAll('.input-group input');
    inputs.forEach(input => {
        input.style.borderColor = '#22C55E';
        setTimeout(() => {
            input.style.borderColor = '';
        }, 1000);
    });
    
    mostrarNotificacao('Credenciais preenchidas! Clique em "Entrar" para continuar.', 'success');
}

// Abrir modal de recuperar senha
function abrirRecuperarSenha(event) {
    event.preventDefault();
    document.getElementById('modalRecuperar').classList.add('active');
}

// Abrir modal de cadastro
function abrirCadastro(event) {
    event.preventDefault();
    document.getElementById('modalCadastro').classList.add('active');
}

// Fechar modal
function fecharModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Enviar recuperação de senha
function enviarRecuperacao() {
    const email = document.getElementById('emailRecuperar').value.trim();
    
    if (!email) {
        mostrarNotificacao('Digite seu e-mail!', 'error');
        return;
    }
    
    if (!validarEmail(email)) {
        mostrarNotificacao('E-mail inválido!', 'error');
        return;
    }
    
    // Simular envio
    mostrarNotificacao('📧 E-mail de recuperação enviado com sucesso!', 'success');
    fecharModal('modalRecuperar');
    document.getElementById('emailRecuperar').value = '';
}

// Realizar cadastro
async function realizarCadastro() {
    const btnCriar = document.querySelector('#modalCadastro .btn-primary');
    const nome = document.getElementById('nomeCompleto').value.trim();
    const cpf = document.getElementById('cpfCadastro').value.trim();
    const empresa = document.getElementById('empresa').value.trim();
    const chaveEmpresa = document.getElementById('chaveEmpresa').value.trim();
    const email = document.getElementById('emailCadastro').value.trim();
    const senha = document.getElementById('senhaCadastro').value;
    const aceitouTermos = document.getElementById('aceitarTermos').checked;

    if (!nome || !cpf || !email || !senha) {
        mostrarNotificacao('Preencha todos os campos obrigatórios!', 'error');
        return;
    }

    if (!validarCPF(cpf)) {
        mostrarNotificacao('CPF inválido!', 'error');
        return;
    }

    if (!validarEmail(email)) {
        mostrarNotificacao('E-mail inválido!', 'error');
        return;
    }

    if (senha.length < 6) {
        mostrarNotificacao('A senha deve ter no mínimo 6 caracteres!', 'error');
        return;
    }

    if (!aceitouTermos) {
        mostrarNotificacao('Você deve aceitar os termos de uso!', 'error');
        return;
    }

    if (btnCriar) {
        btnCriar.disabled = true;
        btnCriar.textContent = 'Criando conta...';
    }

    try {
        const resultado = await window.supabaseAPI.cadastrar({ nome, cpf, email, senha, empresa, chaveEmpresa, aceitouTermos });

        if (resultado.sucesso) {
            fecharModal('modalCadastro');
            document.getElementById('cadastroForm').reset();
            document.getElementById('cpf').value = cpf;

            if (resultado.chave_gerada) {
                document.getElementById('chaveDisplay').textContent = resultado.chave_gerada;
                document.getElementById('modalChave').classList.add('active');
            } else if (resultado.aviso) {
                mostrarNotificacao(resultado.aviso, 'warning');
            } else {
                mostrarNotificacao('Conta criada com sucesso! Faça login para continuar.', 'success');
            }
        } else {
            mostrarNotificacao(resultado.mensagem, 'error');
        }
    } catch (err) {
        console.error('Erro ao criar conta:', err);
        mostrarNotificacao('Erro inesperado. Tente novamente.', 'error');
    } finally {
        if (btnCriar) {
            btnCriar.disabled = false;
            btnCriar.innerHTML = '<i class="fa-solid fa-check"></i> Criar Conta';
        }
    }
}

// Copiar chave da empresa
function copiarChave() {
    const chave = document.getElementById('chaveDisplay').textContent;
    navigator.clipboard.writeText(chave).then(() => {
        mostrarNotificacao('Chave copiada!', 'success');
    }).catch(() => {
        mostrarNotificacao('Selecione a chave e copie manualmente.', 'info');
    });
}


// Validar e-mail
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Sistema de notificações
function mostrarNotificacao(mensagem, tipo = 'info') {
    // Remover notificação anterior se existir
    const notifAnterior = document.querySelector('.toast-notification');
    if (notifAnterior) {
        notifAnterior.remove();
    }

    const notificacao = document.createElement('div');
    notificacao.className = `toast-notification toast-${tipo}`;
    
    const icones = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };
    
    const cores = {
        success: '#22C55E',
        error: '#dc2626',
        warning: '#f59e0b',
        info: '#4776ec'
    };
    
    notificacao.innerHTML = `
        <i class="fa-solid ${icones[tipo]}"></i>
        <span>${mensagem}</span>
    `;
    
    notificacao.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: white;
        color: ${cores[tipo]};
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        z-index: 10000;
        animation: toastSlide 0.4s ease;
        border-left: 4px solid ${cores[tipo]};
        max-width: 400px;
        font-size: 14px;
    `;
    
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        notificacao.style.animation = 'toastSlideOut 0.4s ease';
        setTimeout(() => notificacao.remove(), 400);
    }, 5000);
}

// Validação em tempo real
document.addEventListener('DOMContentLoaded', function() {
    const cpfInput = document.getElementById('cpf');
    const password = document.getElementById('password');
    const cpfCadastro = document.getElementById('cpfCadastro');
    
    // Aplicar máscara no CPF de login
    if (cpfInput) {
        aplicarMascaraCPF(cpfInput);
        
        cpfInput.addEventListener('input', function() {
            const cpfLimpo = this.value.replace(/\D/g, '');
            if (cpfLimpo.length === 11 && validarCPF(this.value)) {
                this.style.borderColor = '#22C55E';
            } else if (cpfLimpo.length > 0) {
                this.style.borderColor = '#f59e0b';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    // Aplicar máscara na chave da empresa
    const chaveInput = document.getElementById('chaveEmpresa');
    if (chaveInput) {
        chaveInput.addEventListener('input', function() {
            let value = this.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 12);
            if (value.length > 8) value = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8);
            else if (value.length > 4) value = value.slice(0, 4) + '-' + value.slice(4);
            this.value = value;
        });
    }

    // Aplicar máscara no CPF de cadastro
    if (cpfCadastro) {
        aplicarMascaraCPF(cpfCadastro);
        
        cpfCadastro.addEventListener('input', function() {
            const cpfLimpo = this.value.replace(/\D/g, '');
            if (cpfLimpo.length === 11 && validarCPF(this.value)) {
                this.style.borderColor = '#22C55E';
            } else if (cpfLimpo.length > 0) {
                this.style.borderColor = '#f59e0b';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    // Validar senha ao digitar
    if (password) {
        password.addEventListener('input', function() {
            if (this.value.length >= 6) {
                this.style.borderColor = '#22C55E';
            } else if (this.value.length > 0) {
                this.style.borderColor = '#f59e0b';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    // Restaurar CPF salvo pelo "Lembrar-me"
    if (localStorage.getItem('rememberMe') === 'true') {
        const cpfSalvo = localStorage.getItem('cpfSalvo');
        if (cpfSalvo && cpfInput) {
            cpfInput.value = cpfSalvo;
            document.getElementById('rememberMe').checked = true;
        }
    }

    // Fechar modal ao pressionar ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
});

// Adicionar animações CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes toastSlide {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes toastSlideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Override da função handleLogin do auth.js para usar Supabase
window.handleLogin = async function(event) {
    event.preventDefault();

    const btnLogin = document.getElementById('btnLogin');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    const cpfInput = document.getElementById('cpf').value.trim();
    const password = document.getElementById('password').value;

    if (!validarCPF(cpfInput)) {
        errorMessage.style.display = 'flex';
        errorMessage.querySelector('span').textContent = 'CPF inválido!';
        mostrarNotificacao('CPF inválido!', 'error');
        return false;
    }

    btnLogin.classList.add('loading');
    btnLogin.disabled = true;

    const resultado = await window.supabaseAPI.login(cpfInput, password);

    if (resultado.sucesso) {
        successMessage.style.display = 'flex';
        mostrarNotificacao('Login realizado com sucesso! Redirecionando...', 'success');

        const rememberMe = document.getElementById('rememberMe').checked;

        const usuarioLogado = {
            id: resultado.usuario.id,
            cpf: resultado.usuario.cpf,
            nome: resultado.usuario.nome,
            empresa: resultado.usuario.empresa,
            empresa_id: resultado.usuario.empresa_id,
            email: resultado.usuario.email,
            perfil: resultado.usuario.perfil,
            avatar_url: resultado.usuario.avatar_url || null
        };

        sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));

        if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('usuarioSalvo', JSON.stringify(usuarioLogado));
            localStorage.setItem('cpfSalvo', cpfInput);
            localStorage.setItem('lastLogin', new Date().toISOString());
        }

        setTimeout(() => {
            window.location.href = 'inicio.html';
        }, 1000);

    } else {
        btnLogin.classList.remove('loading');
        btnLogin.disabled = false;
        errorMessage.style.display = 'flex';
        errorMessage.querySelector('span').textContent = resultado.mensagem;
        mostrarNotificacao(resultado.mensagem, 'error');
        document.getElementById('password').value = '';
        document.getElementById('password').focus();
    }

    return false;
};