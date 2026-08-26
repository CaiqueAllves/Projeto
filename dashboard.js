// ========================================
// DASHBOARD - Página Específica
// ========================================

// Atualizar informações do usuário
function atualizarInformacoesUsuario() {
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    
    if (usuarioLogado) {
        const usuario = JSON.parse(usuarioLogado);
        
        // Atualizar nome completo no topo direito
        const displayUsername = document.getElementById('displayUsername');
        if (displayUsername) {
            displayUsername.textContent = usuario.nome;
        }
        
        // Atualizar nome na mensagem de boas-vindas
        const welcomeUsername = document.getElementById('welcomeUsername');
        if (welcomeUsername) {
            const primeiroNome = usuario.nome.split(' ')[0];
            welcomeUsername.textContent = primeiroNome;
        }
        
        // Atualizar email
        const userEmail = document.getElementById('userEmail');
        if (userEmail) {
            userEmail.textContent = usuario.email || '—';
        }
        
        // Atualizar nome da empresa
        const empresaNome = document.getElementById('empresaNome');
        if (empresaNome) {
            empresaNome.textContent = usuario.empresa;
        }
    }
}

// Atualizar estatísticas do dashboard
function atualizarEstatisticas() {
    const stats = {
        totalDocs: 124
    };
    
    const totalDocsElement = document.getElementById('totalDocs');
    if (totalDocsElement) {
        totalDocsElement.textContent = stats.totalDocs;
    }
}

// Toggle WhatsApp Chat
// Enviar mensagem no chat
// Permitir enviar mensagem com Enter
document.addEventListener('DOMContentLoaded', function() {
});

// Inicializar dashboard
window.addEventListener('load', function() {
    atualizarInformacoesUsuario();
    atualizarEstatisticas();
});
