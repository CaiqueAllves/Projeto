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
        
        // Atualizar email (gerar email baseado no username)
        const userEmail = document.getElementById('userEmail');
        if (userEmail) {
            userEmail.textContent = `${usuario.username}@${usuario.empresa.toLowerCase().replace(/\s+/g, '')}.com`;
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
function toggleWhatsappChat() {
    const chat = document.getElementById('whatsappChat');
    chat.classList.toggle('active');
}

// Enviar mensagem no chat
function enviarMensagem() {
    const input = document.getElementById('chatInput');
    const mensagem = input.value.trim();
    
    if (mensagem === '') return;
    
    // Adicionar mensagem do usuário
    const chatBody = document.querySelector('.chat-body');
    const userMessage = document.createElement('div');
    userMessage.className = 'chat-message user';
    userMessage.innerHTML = `
        <div class="message-content">${mensagem}</div>
        <div class="message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    chatBody.appendChild(userMessage);
    
    // Limpar input
    input.value = '';
    
    // Scroll para o final
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // Simular resposta automática
    setTimeout(() => {
        const botMessage = document.createElement('div');
        botMessage.className = 'chat-message bot';
        botMessage.innerHTML = `
            <div class="message-content">Obrigado pela sua mensagem! Nossa equipe responderá em breve. 😊</div>
            <div class="message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        chatBody.appendChild(botMessage);
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 1000);
}

// Permitir enviar mensagem com Enter
document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                enviarMensagem();
            }
        });
    }
});

// Inicializar dashboard
window.addEventListener('load', function() {
    atualizarInformacoesUsuario();
    atualizarEstatisticas();
});
