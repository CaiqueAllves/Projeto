// ========================================
// AVISO DE FIM DO PERÍODO GRATUITO (3 dias antes) — administrador da empresa
// ========================================
// Plano Gratuito = 15 dias; depois a empresa entra em modo só leitura
// (database-gratuito-15-dias.sql). Nos últimos 3 dias, quando o ADMINISTRADOR
// abre a tela de INÍCIO de um módulo (AVISO_VENC_PAGINAS — o script só é
// carregado nelas):
//   1. aparece um aviso na tela (uma vez por sessão em cada módulo);
//   2. sai 1 e-mail pelo EmailJS — registrar_aviso_vencimento() marca o envio no
//      banco de forma atômica, então não repete (nem com 2 abas abertas). Se o
//      envio falhar, a marcação é desfeita e tenta de novo no próximo acesso.
//
// E-MAIL AINDA NÃO CONFIGURADO: crie o template no EmailJS com o conteúdo de
// email-template-aviso-vencimento.html (mesma conta/serviço do e-mail de
// boas-vindas) e troque AVISO_VENC_EMAILJS_TEMPLATE_ID abaixo pelo ID gerado.
// Enquanto for o texto de exemplo, só o aviso na tela funciona (nada é marcado
// no banco, para o e-mail sair quando o template existir).

const AVISO_VENC_DIAS               = 3;
const AVISO_VENC_EMAILJS_PUBLIC_KEY = 'zpEU_nVjkI8qGClOC';    // mesma conta do e-mail de boas-vindas (login.js)
const AVISO_VENC_EMAILJS_SERVICE_ID = 'service_umbw1hi';
const AVISO_VENC_EMAILJS_TEMPLATE_ID = 'CONFIGURAR_TEMPLATE_ID_AQUI';
const AVISO_VENC_WHATSAPP           = '5511987216497';         // atendimento Marpex (o mesmo dos chamados)
// Tela de entrada de cada módulo: Operacional → Início, Comercial → Pipeline, Financeiro → Pipeline Financeiro
const AVISO_VENC_PAGINAS = ['inicio.html', 'pipeline.html', 'pipeline-financeiro.html'];

function _avisoVencDiasRestantes(u) {
    if (!u || u.empresa_status === 'sandbox' || !u.empresa_expira_em) return null;
    const ms = new Date(u.empresa_expira_em) - new Date();
    return ms > 0 ? Math.ceil(ms / 864e5) : 0;
}

async function _avisoVencCarregarEmailJS() {
    if (window.emailjs) return;
    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
        s.onload = resolve; s.onerror = () => reject(new Error('EmailJS não carregou'));
        document.head.appendChild(s);
    });
    emailjs.init(AVISO_VENC_EMAILJS_PUBLIC_KEY);
}

async function _avisoVencEnviarEmail() {
    if (AVISO_VENC_EMAILJS_TEMPLATE_ID === 'CONFIGURAR_TEMPLATE_ID_AQUI') return;   // template ainda não criado
    const { data, error } = await supabaseClient.rpc('registrar_aviso_vencimento');
    if (error || !data?.enviar) return;                                              // fora da janela ou já enviado
    try {
        await _avisoVencCarregarEmailJS();
        const vence = new Date(data.expira_em);
        const dias = Math.max(1, Math.ceil((vence - new Date()) / 864e5));
        await emailjs.send(AVISO_VENC_EMAILJS_SERVICE_ID, AVISO_VENC_EMAILJS_TEMPLATE_ID, {
            to_email:        data.email,
            to_name:         data.nome || '',
            empresa:         data.empresa || '',
            data_vencimento: vence.toLocaleDateString('pt-BR'),
            dias_restantes:  `${dias} dia${dias > 1 ? 's' : ''}`,
            link_planos:     new URL('perfil.html', location.href).href,
            link_whatsapp:   `https://wa.me/${AVISO_VENC_WHATSAPP}?text=${encodeURIComponent(`Olá! Quero contratar um plano do Marpex para a empresa ${data.empresa || ''}.`)}`,
        });
    } catch (e) {
        console.warn('[aviso de vencimento] e-mail não enviado — tenta de novo no próximo acesso:', e);
        await supabaseClient.rpc('desfazer_aviso_vencimento').catch(() => {});
    }
}

function _avisoVencMostrarNaTela(u, dias, pagina) {
    const marca = 'avisoVencimentoVisto_' + pagina + '_' + String(u.empresa_expira_em).slice(0, 10);
    try { if (sessionStorage.getItem(marca)) return; sessionStorage.setItem(marca, '1'); } catch (_) { /* sem storage: mostra */ }
    const vence = new Date(u.empresa_expira_em).toLocaleDateString('pt-BR');
    confirmarAcao(
        `O período gratuito da sua empresa termina em ${dias} dia${dias > 1 ? 's' : ''} (${vence}).\n\n`
        + 'Depois disso o sistema entra em modo só leitura: vocês continuam vendo e baixando tudo, mas não será possível criar, alterar ou excluir Propostas, Proformas, Processos, Contas e cadastros.\n\n'
        + 'Para continuar usando normalmente, contrate um plano.',
        { titulo: 'Período gratuito terminando', confirmar: 'Ver planos', cancelar: 'Agora não' }
    ).then(ok => { if (ok) window.location.href = 'perfil.html'; });
}

async function verificarAvisoVencimento() {
    const pagina = (location.pathname.split('/').pop() || 'inicio.html').toLowerCase();
    if (!AVISO_VENC_PAGINAS.includes(pagina)) return;   // só no Início de cada módulo (também dentro das abas)
    if (typeof obterUsuarioLogado !== 'function' || typeof supabaseClient === 'undefined') return;
    const u = obterUsuarioLogado();
    if (!u || u.perfil !== 'admin') return;
    const dias = _avisoVencDiasRestantes(u);
    if (dias === null || dias === 0 || dias > AVISO_VENC_DIAS) return;
    _avisoVencMostrarNaTela(u, dias, pagina);
    _avisoVencEnviarEmail();
}

// depois do auth.js montar a sessão (e da atualização em segundo plano dos dados da empresa)
window.addEventListener('load', () => setTimeout(verificarAvisoVencimento, 2500));
