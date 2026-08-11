// ========================================
// WIDGET DE SUPORTE — injeta em todas as páginas
// ========================================
//
// Tabela e bucket de Storage necessários no Supabase: ver database/database-chamados.sql

// ── Configurações ────────────────────────────────────────────────────────────

// Chat de dúvidas: chama a Edge Function suporte-ia (supabase/functions/suporte-ia),
// que guarda a chave da Anthropic no servidor e nunca a expõe no front-end.
const SUPORTE_IA_ENDPOINT = `${SUPABASE_URL}/functions/v1/suporte-ia`;

// EmailJS — configure em https://www.emailjs.com
const SUPORTE_EMAILJS_PUBLIC_KEY  = 'zpEU_nVjkI8qGClOC';
const SUPORTE_EMAILJS_SERVICE_ID  = 'service_umbw1hi';
const SUPORTE_EMAILJS_TEMPLATE_ID = 'template_ddtkzcj';
const SUPORTE_EMAIL_DESTINO       = 'marpex.controller@hotmail.com';

// ── Prompt do assistente de IA ───────────────────────────────────────────────

const SUPORTE_SYSTEM_PROMPT = `Você é um assistente virtual da Marpex, sistema de gestão de comércio exterior brasileiro.
Seu objetivo é ajudar os usuários a usar o sistema de forma clara e eficiente.

O sistema Marpex é organizado em 4 módulos, selecionáveis no topo do menu lateral:

Operacional:
- Início: painel principal com visão geral.
- Empresas: cadastro de empresas parceiras (clientes, fornecedores etc.).
- Produtos: cadastro de produtos.
- Proformas: emissão e gestão de proformas.
- Processos: quadro kanban para gestão de processos de exportação, exportação indireta e importação. Status disponíveis: Aberta, Pendente e Encerrada.
- Relatórios: relatórios do módulo operacional (produtos, proformas, processos).
- Termos: termos e condições.
- Apoio: tabelas de apoio (países e regiões, portos e armadores, aeroportos e cias aéreas, moedas, embalagens e unidades de medida, termos de pagamento, acondicionamento, container, NCM).

Comercial:
- Pipeline: quadro kanban do funil de vendas.
- Pedidos: gestão de pedidos.
- Relatórios: relatórios comerciais.

Financeiro:
- Contas a Pagar / Contas a Receber: gestão financeira de contas.
- Fluxo de Caixa: acompanhamento de entradas e saídas.
- DRE / Balancete: demonstrativo de resultado.
- Relatórios: relatórios financeiros.

Configurações:
- Perfil: dados da conta do usuário.
- Usuários e Permissões: gestão de usuários e permissões de acesso.

Regras de resposta:
- Use português brasileiro claro e amigável
- Seja objetivo e direto, sem enrolação
- Para problemas técnicos ou bugs, oriente o usuário a usar "Reportar um problema" no menu de suporte
- Para ajuda urgente, sugira o WhatsApp disponível no menu
- Formate respostas longas em tópicos quando adequado
- Não invente funcionalidades que não foram mencionadas acima`;

// ── Estado global ────────────────────────────────────────────────────────────

let _suporteChatHistorico   = [];
let _suporteEnviando        = false;
let _suporteImagemColada    = null;
let _suporteChamadoAbertoId = null;

// ── HTML do widget ───────────────────────────────────────────────────────────

(function injetarSuporteWidget() {

    const btnHtml = `
        <div class="suporte-float" id="suporteFloat" title="Suporte">
            <i class="fa-solid fa-circle-question"></i>
        </div>`;

    const panelHtml = `
        <div class="suporte-panel" id="suportePanel">

            <!-- Cabeçalho fixo (escondido quando chamados está ativo) -->
            <div class="suporte-header">
                <div class="suporte-header-info">
                    <i class="fa-solid fa-headset"></i>
                    <span>Ajuda Marpex</span>
                </div>
                <button class="suporte-close" onclick="suporteFechar()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- ① Menu principal -->
            <div class="suporte-body" id="suporteBody">
                <p class="suporte-subtitle">Como posso te ajudar?</p>
                <div class="suporte-opcoes">

                    <div class="suporte-opcao" onclick="suporteAcao('duvida')">
                        <div class="suporte-opcao-icon suporte-icon-duvida">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div class="suporte-opcao-texto">
                            <span class="suporte-opcao-titulo">Tirar dúvida / aprender a usar</span>
                            <span class="suporte-opcao-desc">Pergunte "como faço X" e te guiamos passo a passo.</span>
                        </div>
                        <i class="fa-solid fa-chevron-right suporte-opcao-arrow"></i>
                    </div>

                    <div class="suporte-opcao" onclick="suporteAcao('problema')">
                        <div class="suporte-opcao-icon suporte-icon-problema">
                            <i class="fa-solid fa-screwdriver-wrench"></i>
                        </div>
                        <div class="suporte-opcao-texto">
                            <span class="suporte-opcao-titulo">Reportar um problema</span>
                            <span class="suporte-opcao-desc">Achou um erro ou falta alguma coisa? Abra um chamado pro time.</span>
                        </div>
                        <i class="fa-solid fa-chevron-right suporte-opcao-arrow"></i>
                    </div>

                    <div class="suporte-opcao" onclick="suporteAcao('chamados')">
                        <div class="suporte-opcao-icon suporte-icon-chamados">
                            <i class="fa-regular fa-envelope-open"></i>
                        </div>
                        <div class="suporte-opcao-texto">
                            <span class="suporte-opcao-titulo">Meus chamados</span>
                            <span class="suporte-opcao-desc">Acompanhe e responda os chamados que você abriu.</span>
                        </div>
                        <i class="fa-solid fa-chevron-right suporte-opcao-arrow"></i>
                    </div>

                    <div class="suporte-opcao" onclick="suporteAcao('whatsapp')">
                        <div class="suporte-opcao-icon suporte-icon-whatsapp">
                            <i class="fa-brands fa-whatsapp"></i>
                        </div>
                        <div class="suporte-opcao-texto">
                            <span class="suporte-opcao-titulo">WhatsApp</span>
                            <span class="suporte-opcao-desc">Fale diretamente com nossa equipe pelo WhatsApp.</span>
                        </div>
                        <i class="fa-solid fa-chevron-right suporte-opcao-arrow"></i>
                    </div>

                </div>
            </div>

            <!-- ② Chat de IA -->
            <div class="suporte-chat-view" id="suporteChatView">
                <div class="suporte-chat-subheader">
                    <button class="suporte-chat-voltar" onclick="suporteVoltarMenu()" title="Voltar">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="suporte-chat-avatar">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </div>
                    <div class="suporte-chat-info">
                        <span class="suporte-chat-nome">Assistente Marpex</span>
                        <span class="suporte-chat-status">
                            <span class="suporte-chat-dot"></span>IA · Online
                        </span>
                    </div>
                </div>
                <div class="suporte-chat-msgs" id="suporteChatMsgs"></div>
                <div class="suporte-chat-bottom">
                    <div class="suporte-chat-input-row">
                        <input type="text" id="suporteChatInput"
                            placeholder="Digite sua dúvida..."
                            onkeydown="if(event.key==='Enter')suporteEnviarMsg()"
                            autocomplete="off">
                        <button class="suporte-chat-send" id="suporteChatSend" onclick="suporteEnviarMsg()">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    <p class="suporte-chat-aviso">Respostas geradas por IA · podem conter erros</p>
                </div>
            </div>

            <!-- ③ Formulário de reporte -->
            <div class="suporte-report-view" id="suporteReportView">

                <div class="suporte-chat-subheader">
                    <button class="suporte-chat-voltar" onclick="suporteVoltarMenu()" title="Voltar">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="suporte-chat-avatar suporte-avatar-report">
                        <i class="fa-solid fa-screwdriver-wrench"></i>
                    </div>
                    <div class="suporte-chat-info">
                        <span class="suporte-chat-nome">Reportar problema</span>
                        <span class="suporte-chat-status" style="color:#64748b;">Enviamos pro time analisar</span>
                    </div>
                </div>

                <div class="suporte-report-body" id="suporteReportBody">
                    <p class="suporte-report-intro">Descreva o problema. Vou fazer algumas perguntas pra entender melhor e registrar pro time analisar.</p>

                    <div class="suporte-form-group">
                        <label class="suporte-form-label">Título <span class="suporte-required">*</span></label>
                        <input type="text" id="suporteReportTitulo" class="suporte-form-input"
                            placeholder="Ex: Não consigo salvar diário da obra">
                    </div>

                    <div class="suporte-form-group">
                        <label class="suporte-form-label">Módulo <span class="suporte-optional">(opcional)</span></label>
                        <select id="suporteReportModulo" class="suporte-form-select">
                            <option value="">— escolher —</option>
                            <optgroup label="Operacional">
                                <option value="Início">Início</option>
                                <option value="Empresas">Empresas</option>
                                <option value="Produtos">Produtos</option>
                                <option value="Proformas">Proformas</option>
                                <option value="Processos">Processos</option>
                                <option value="Relatórios (Operacional)">Relatórios</option>
                                <option value="Termos">Termos</option>
                                <option value="Apoio">Apoio</option>
                            </optgroup>
                            <optgroup label="Comercial">
                                <option value="Pipeline">Pipeline</option>
                                <option value="Pedidos">Pedidos</option>
                                <option value="Relatórios (Comercial)">Relatórios</option>
                            </optgroup>
                            <optgroup label="Financeiro">
                                <option value="Contas a Pagar">Contas a Pagar</option>
                                <option value="Contas a Receber">Contas a Receber</option>
                                <option value="Fluxo de Caixa">Fluxo de Caixa</option>
                                <option value="DRE / Balancete">DRE / Balancete</option>
                                <option value="Relatórios (Financeiro)">Relatórios</option>
                            </optgroup>
                            <optgroup label="Configurações">
                                <option value="Perfil">Perfil</option>
                                <option value="Usuários e Permissões">Usuários e Permissões</option>
                            </optgroup>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>

                    <div class="suporte-form-group">
                        <label class="suporte-form-label">O que aconteceu? <span class="suporte-required">*</span></label>
                        <textarea id="suporteReportDesc" class="suporte-form-textarea"
                            placeholder="Descreva com seus detalhes. Pode colar um print (Ctrl+V) aqui também."></textarea>
                        <p class="suporte-form-hint">
                            <i class="fa-regular fa-lightbulb"></i>
                            Cole um print da tela aqui com Ctrl+V (Windows) ou Cmd+V (Mac).
                        </p>
                        <div class="suporte-img-preview-wrap" id="suporteImgWrap">
                            <img id="suporteImgPreview" src="" alt="print colado">
                            <button class="suporte-img-remove" onclick="suporteRemoverImagem()" title="Remover">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>

                    <div class="suporte-form-group">
                        <label class="suporte-form-file-label" for="suporteReportArquivo">
                            <i class="fa-solid fa-paperclip"></i> Anexar arquivos manualmente
                        </label>
                        <input type="file" id="suporteReportArquivo" accept="image/*,.pdf"
                            onchange="_suportePreviewArquivo(this)">
                        <span class="suporte-file-nome" id="suporteFileNome"></span>
                    </div>
                </div>

                <div class="suporte-report-footer" id="suporteReportFooter">
                    <button class="suporte-report-btn" onclick="suporteEnviarReport()">
                        <i class="fa-solid fa-paper-plane"></i> Enviar
                    </button>
                </div>

                <div class="suporte-report-loading" id="suporteReportLoading">
                    <div class="suporte-loading-spinner"></div>
                    <p>Enviando...</p>
                </div>

                <div class="suporte-report-sucesso" id="suporteReportSucesso">
                    <div class="suporte-sucesso-icon"><i class="fa-solid fa-circle-check"></i></div>
                    <p class="suporte-sucesso-titulo">Enviado com sucesso!</p>
                    <p class="suporte-sucesso-desc">Recebemos seu reporte. Nossa equipe vai analisar e entrar em contato em breve.</p>
                    <button class="suporte-sucesso-btn" onclick="suporteVoltarMenu()">Fechar</button>
                </div>

            </div>

            <!-- ④ Meus chamados -->
            <div class="suporte-chamados-view" id="suporteChamadosView">

                <div class="suporte-chamados-header">
                    <button class="suporte-chamados-voltar" onclick="suporteVoltarMenu()" title="Voltar">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="suporte-chamados-header-info">
                        <i class="fa-regular fa-circle-question"></i>
                        <span>Meus chamados</span>
                    </div>
                    <button class="suporte-close" onclick="suporteFechar()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="suporte-chamados-actions">
                    <button class="suporte-chamados-novo-btn" onclick="suporteAcao('problema')">
                        <i class="fa-solid fa-plus"></i> Reportar novo problema
                    </button>
                </div>

                <div class="suporte-chamados-lista" id="suporteChamadosLista">
                    <div class="suporte-chamados-loading" id="suporteChamadosLoading">
                        <div class="suporte-loading-spinner"></div>
                    </div>
                </div>

            </div>

            <!-- ⑤ Detalhe do chamado -->
            <div class="suporte-chamado-detalhe-view" id="suporteChamadoDetalheView">

                <div class="suporte-chamados-header">
                    <button class="suporte-chamados-voltar" onclick="_suporteFecharChamadoDetalhe()" title="Voltar">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div class="suporte-chamados-header-info">
                        <i class="fa-regular fa-envelope-open"></i>
                        <span id="suporteChamadoDetalheTitulo">Chamado</span>
                    </div>
                    <button class="suporte-close" onclick="suporteFechar()">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="suporte-chamado-detalhe-meta" id="suporteChamadoDetalheMeta"></div>

                <div class="suporte-chamado-detalhe-resumo" id="suporteChamadoDetalheResumo"></div>

                <p class="suporte-chamado-thread-label">Conversa</p>

                <div class="suporte-chat-msgs" id="suporteChamadoDetalheMsgs"></div>

                <div class="suporte-chat-bottom">
                    <div class="suporte-chat-input-row">
                        <input type="text" id="suporteChamadoDetalheInput"
                            placeholder="Escreva uma mensagem..."
                            onkeydown="if(event.key==='Enter')suporteEnviarMensagemChamado()"
                            autocomplete="off">
                        <button class="suporte-chat-send" id="suporteChamadoDetalheSend" onclick="suporteEnviarMensagemChamado()">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>

            </div>

        </div>`;

    function montar() {
        document.body.insertAdjacentHTML('beforeend', btnHtml);
        document.body.insertAdjacentHTML('beforeend', panelHtml);

        document.getElementById('suporteFloat').addEventListener('click', suporteToggle);

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#suporteFloat') && !e.target.closest('#suportePanel')) {
                suporteFechar();
            }
        });

        document.getElementById('suporteReportDesc').addEventListener('paste', _suportePasteImagem);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', montar);
    } else {
        montar();
    }
})();

// ── Controles do painel ──────────────────────────────────────────────────────

function suporteToggle() {
    document.getElementById('suportePanel')?.classList.toggle('ativo');
}

function suporteFechar() {
    document.getElementById('suportePanel')?.classList.remove('ativo');
}

function suporteVoltarMenu() {
    document.getElementById('suporteChatView')?.classList.remove('ativo');
    document.getElementById('suporteReportView')?.classList.remove('ativo');
    document.getElementById('suporteChamadosView')?.classList.remove('ativo');
    document.getElementById('suporteChamadoDetalheView')?.classList.remove('ativo');
    document.getElementById('suportePanel')?.classList.remove('suporte-panel--chamados');
    document.getElementById('suporteBody').style.display = '';
    _suporteChamadoAbertoId = null;
    _suporteReportResetar();
}

function suporteAcao(tipo) {
    if (tipo === 'whatsapp') {
        window.open('https://wa.me/55SEUNUMERO', '_blank');
        return;
    }
    if (tipo === 'duvida')    { _suporteMostrarChat();     return; }
    if (tipo === 'problema')  { _suporteMostrarReport();   return; }
    if (tipo === 'chamados')  { _suporteMostrarChamados(); return; }
}

// ── ② Chat de IA ─────────────────────────────────────────────────────────────

function _suporteMostrarChat() {
    document.getElementById('suporteBody').style.display = 'none';
    document.getElementById('suporteChatView').classList.add('ativo');

    const msgs = document.getElementById('suporteChatMsgs');
    if (msgs.children.length === 0) {
        _suporteAdicionarMsg('ia', 'Olá! Sou o assistente virtual da Marpex. Como posso te ajudar hoje?');
    }
    setTimeout(() => document.getElementById('suporteChatInput')?.focus(), 150);
}

function _suporteAdicionarMsg(role, texto, typing = false) {
    const msgs = document.getElementById('suporteChatMsgs');
    const div  = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;

    if (typing) {
        div.classList.add('chat-typing');
        div.innerHTML = `<div class="chat-typing-dots"><span></span><span></span><span></span></div>`;
    } else {
        const span = document.createElement('span');
        span.style.whiteSpace = 'pre-wrap';
        span.textContent = texto;
        div.appendChild(span);
    }

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
}

async function suporteEnviarMsg() {
    if (_suporteEnviando) return;
    const input   = document.getElementById('suporteChatInput');
    const sendBtn = document.getElementById('suporteChatSend');
    const texto   = input.value.trim();
    if (!texto) return;

    _suporteEnviando = true;
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    _suporteChatHistorico.push({ role: 'user', content: texto });
    _suporteAdicionarMsg('user', texto);
    const typingEl = _suporteAdicionarMsg('ia', null, true);

    try {
        const res = await fetch(SUPORTE_IA_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: SUPORTE_SYSTEM_PROMPT,
                messages: _suporteChatHistorico
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
        }

        const resposta = data.content[0].text;
        typingEl.remove();
        _suporteChatHistorico.push({ role: 'assistant', content: resposta });
        _suporteAdicionarMsg('ia', resposta);

    } catch (e) {
        typingEl.remove();
        _suporteChatHistorico.pop();
        _suporteAdicionarMsg('ia', 'Desculpe, não consegui me conectar. Tente novamente ou entre em contato pelo WhatsApp.');
        console.error('[Suporte IA]', e);
    } finally {
        _suporteEnviando = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// ── ③ Formulário de reporte ───────────────────────────────────────────────────

function _suporteMostrarReport() {
    // Pode vir do menu principal ou de dentro de "Meus chamados"
    document.getElementById('suporteBody').style.display = 'none';
    document.getElementById('suporteChamadosView')?.classList.remove('ativo');
    document.getElementById('suportePanel')?.classList.remove('suporte-panel--chamados');
    document.getElementById('suporteReportView').classList.add('ativo');
    setTimeout(() => document.getElementById('suporteReportTitulo')?.focus(), 150);
}

function _suporteReportResetar() {
    const ids = ['suporteReportTitulo', 'suporteReportDesc'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const modulo = document.getElementById('suporteReportModulo');
    if (modulo) modulo.value = '';
    const arquivo = document.getElementById('suporteReportArquivo');
    if (arquivo) arquivo.value = '';
    const nome = document.getElementById('suporteFileNome');
    if (nome) nome.textContent = '';
    suporteRemoverImagem();
    _suporteReportSetEstado('form');
}

function _suporteReportSetEstado(estado) {
    document.getElementById('suporteReportBody').style.display   = estado === 'form'    ? '' : 'none';
    document.getElementById('suporteReportFooter').style.display = estado === 'form'    ? '' : 'none';
    document.getElementById('suporteReportLoading').style.display = estado === 'loading' ? 'flex' : 'none';
    document.getElementById('suporteReportSucesso').style.display = estado === 'sucesso' ? 'flex' : 'none';
}

function _suportePasteImagem(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            _suporteImagemColada = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('suporteImgPreview').src = ev.target.result;
                document.getElementById('suporteImgWrap').classList.add('ativo');
            };
            reader.readAsDataURL(file);
            break;
        }
    }
}

function suporteRemoverImagem() {
    _suporteImagemColada = null;
    document.getElementById('suporteImgWrap')?.classList.remove('ativo');
    const img = document.getElementById('suporteImgPreview');
    if (img) img.src = '';
}

function _suportePreviewArquivo(input) {
    document.getElementById('suporteFileNome').textContent = input.files[0]?.name || '';
}

function _suporteExtensaoArquivo(arquivo) {
    if (arquivo.name && arquivo.name.includes('.')) return arquivo.name.split('.').pop();
    return (arquivo.type || '').split('/')[1] || 'png';
}

async function _suporteUploadAnexo(chamadoId) {
    const arquivo = _suporteImagemColada || document.getElementById('suporteReportArquivo')?.files[0];
    if (!arquivo || typeof supabaseClient === 'undefined' || !supabaseClient) return null;

    try {
        const caminho = `${chamadoId}/${Date.now()}.${_suporteExtensaoArquivo(arquivo)}`;

        const { error } = await supabaseClient.storage
            .from('chamados-anexos')
            .upload(caminho, arquivo, { contentType: arquivo.type || 'image/png' });

        if (error) throw error;

        const { data } = supabaseClient.storage.from('chamados-anexos').getPublicUrl(caminho);
        return data?.publicUrl || null;
    } catch (e) {
        console.warn('[Suporte Report] Upload de anexo falhou:', e);
        return null;
    }
}

// ── Triagem automática por IA (usada no e-mail de "Reportar problema") ──────

const SUPORTE_TRIAGEM_PROMPT = `Você é um assistente de triagem de suporte técnico do sistema Marpex (comércio exterior).
Você vai receber o título, módulo e descrição de um chamado aberto por um usuário do sistema.
Gere uma triagem curta e objetiva para a equipe de suporte, em português, seguindo exatamente este formato (sem markdown, sem títulos extras, sem introdução):

Resumo: <1-2 frases resumindo o problema em linguagem técnica objetiva>
Urgência provável: <Baixa, Média ou Alta> — <motivo em poucas palavras>
Possível causa: <hipótese curta, ou "Não é possível identificar com as informações disponíveis">

Seja direto e não invente detalhes que não estão na descrição.`;

async function _suporteGerarResumoIA(titulo, modulo, desc) {
    try {
        const res = await fetch(SUPORTE_IA_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: SUPORTE_TRIAGEM_PROMPT,
                messages: [{
                    role: 'user',
                    content: `Título: ${titulo}\nMódulo: ${modulo || 'Não informado'}\nDescrição: ${desc}`
                }]
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);

        return data.content[0].text.trim();
    } catch (e) {
        console.warn('[Suporte Report] Triagem IA falhou:', e);
        return null;
    }
}

function _suporteCarregarEmailJS(callback) {
    if (window.emailjs) { callback(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    script.onload  = () => { emailjs.init(SUPORTE_EMAILJS_PUBLIC_KEY); callback(); };
    script.onerror = () => callback(new Error('Falha ao carregar EmailJS'));
    document.head.appendChild(script);
}

async function suporteEnviarReport() {
    const titulo = document.getElementById('suporteReportTitulo')?.value.trim();
    const modulo = document.getElementById('suporteReportModulo')?.value;
    const desc   = document.getElementById('suporteReportDesc')?.value.trim();

    // Validação
    if (!titulo) {
        const el = document.getElementById('suporteReportTitulo');
        el.focus();
        el.classList.add('suporte-input-erro');
        setTimeout(() => el.classList.remove('suporte-input-erro'), 2000);
        return;
    }
    if (!desc) {
        const el = document.getElementById('suporteReportDesc');
        el.focus();
        el.classList.add('suporte-input-erro');
        setTimeout(() => el.classList.remove('suporte-input-erro'), 2000);
        return;
    }

    _suporteReportSetEstado('loading');

    const usuario = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;

    // 1. Salvar no Supabase e gerar a triagem de IA em paralelo (não dependem uma da outra)
    const salvarPromise = (async () => {
        if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;
        try {
            const payload = {
                titulo,
                modulo: modulo || null,
                descricao: desc,
                status: 'aberto'
            };
            if (usuario?.empresa_id) payload.empresa_proprietaria_id = usuario.empresa_id;
            if (usuario?.id)         payload.usuario_id = usuario.id;

            const { data, error } = await supabaseClient.from('chamados').insert(payload).select('id').single();
            return (!error && data) ? data.id : null;
        } catch (e) {
            console.warn('[Suporte Report] Supabase save failed:', e);
            return null;
        }
    })();

    const resumoPromise = _suporteGerarResumoIA(titulo, modulo, desc);

    const [chamadoId, resumoIA] = await Promise.all([salvarPromise, resumoPromise]);

    // 2. Upload do anexo (print colado ou arquivo manual), se houver
    let anexoUrl = null;
    if (chamadoId) {
        anexoUrl = await _suporteUploadAnexo(chamadoId);
        if (anexoUrl) {
            try {
                await supabaseClient.from('chamados').update({ anexo_url: anexoUrl }).eq('id', chamadoId);
            } catch (e) {
                console.warn('[Suporte Report] Falha ao salvar anexo_url:', e);
            }
        }
    }

    // 3. Enviar email via EmailJS
    _suporteCarregarEmailJS(async (err) => {
        if (err) {
            console.error('[Suporte Report] Falha ao carregar script do EmailJS (CDN bloqueado?):', err);
        } else {
            try {
                const anexoBloco = anexoUrl
                    ? `<a href="${anexoUrl}" style="color:#4f46e5; text-decoration:none; font-weight:bold;">Ver print anexado →</a>`
                    : 'Nenhum anexo enviado';

                await emailjs.send(SUPORTE_EMAILJS_SERVICE_ID, SUPORTE_EMAILJS_TEMPLATE_ID, {
                    to_email:  SUPORTE_EMAIL_DESTINO,
                    titulo,
                    modulo:    modulo || 'Não informado',
                    descricao: desc,
                    pagina:    window.location.href,
                    data_hora: new Date().toLocaleString('pt-BR'),
                    anexo_bloco: anexoBloco,
                    anexo_url:   anexoUrl || '',
                    chamado_id: chamadoId || 'N/A',
                    resumo_ia: resumoIA || 'Triagem automática indisponível no momento.'
                });
            } catch (emailErr) {
                console.warn('[Suporte Report] Email failed:', emailErr);
                // Não bloqueia se já salvou no Supabase
            }
        }

        // Sucesso se salvou no Supabase OU se email foi enviado
        _suporteReportSetEstado('sucesso');
    });
}

// ── ④ Meus chamados ───────────────────────────────────────────────────────────

function _suporteMostrarChamados() {
    document.getElementById('suporteBody').style.display = 'none';
    document.getElementById('suportePanel').classList.add('suporte-panel--chamados');
    document.getElementById('suporteChamadosView').classList.add('ativo');
    _suporteCarregarChamados();
}

async function _suporteCarregarChamados() {
    const lista = document.getElementById('suporteChamadosLista');

    // Mostrar loading
    lista.innerHTML = `<div class="suporte-chamados-loading"><div class="suporte-loading-spinner"></div></div>`;

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        lista.innerHTML = `<div class="suporte-chamados-vazio">
            <i class="fa-solid fa-plug-circle-xmark"></i>
            <p>Não foi possível conectar ao banco de dados.</p>
        </div>`;
        return;
    }

    const usuario = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;

    try {
        let query = supabaseClient
            .from('chamados')
            .select('id, titulo, modulo, status, updated_at, anexo_url')
            .order('updated_at', { ascending: false })
            .limit(30);

        if (usuario?.empresa_id) {
            query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        } else if (usuario?.id) {
            query = query.eq('usuario_id', usuario.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        _suporteRenderChamados(data || []);

    } catch (e) {
        console.error('[Suporte Chamados]', e);
        lista.innerHTML = `<div class="suporte-chamados-vazio">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>Erro ao carregar chamados. Tente novamente.</p>
        </div>`;
    }
}

function _suporteRenderChamados(chamados) {
    const lista = document.getElementById('suporteChamadosLista');

    if (!chamados.length) {
        lista.innerHTML = `<div class="suporte-chamados-vazio">
            <i class="fa-regular fa-folder-open"></i>
            <p>Nenhum chamado aberto ainda.</p>
        </div>`;
        return;
    }

    const statusLabel = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };
    const badgeClass  = { aberto: 'suporte-badge-aberto', em_andamento: 'suporte-badge-em_andamento', resolvido: 'suporte-badge-resolvido' };

    lista.innerHTML = chamados.map(c => {
        const data = new Date(c.updated_at);
        const dataFmt = `${String(data.getDate()).padStart(2,'0')}/${String(data.getMonth()+1).padStart(2,'0')}, ${String(data.getHours()).padStart(2,'0')}:${String(data.getMinutes()).padStart(2,'0')}`;
        const status  = c.status || 'aberto';

        const anexoHtml = c.anexo_url
            ? `<a href="${_suporteEscapar(c.anexo_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="suporte-chamado-anexo" title="Ver print anexado"><i class="fa-solid fa-paperclip"></i></a>`
            : '';

        const moduloHtml = c.modulo
            ? `<span class="suporte-chamado-modulo-tag"><i class="fa-solid fa-layer-group"></i> ${_suporteEscapar(c.modulo)}</span>`
            : '';

        return `<div class="suporte-chamado-item" onclick="_suporteAbrirChamado('${c.id}')">
            <div class="suporte-chamado-info">
                <p class="suporte-chamado-titulo">${_suporteEscapar(c.titulo)}</p>
                <div class="suporte-chamado-sub">
                    ${moduloHtml}
                    <span class="suporte-chamado-data">Atualizado em ${dataFmt}</span>
                </div>
            </div>
            <span class="suporte-chamado-badge ${badgeClass[status] || 'suporte-badge-aberto'}">
                ${statusLabel[status] || status}
            </span>
            ${anexoHtml}
        </div>`;
    }).join('');
}

function _suporteEscapar(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── ⑤ Detalhe do chamado ─────────────────────────────────────────────────────

function _suporteAbrirChamado(id) {
    _suporteChamadoAbertoId = id;
    document.getElementById('suporteChamadosView')?.classList.remove('ativo');
    document.getElementById('suporteChamadoDetalheView')?.classList.add('ativo');
    _suporteCarregarChamadoDetalhe(id);
}

function _suporteFecharChamadoDetalhe() {
    _suporteChamadoAbertoId = null;
    document.getElementById('suporteChamadoDetalheView')?.classList.remove('ativo');
    document.getElementById('suporteChamadosView')?.classList.add('ativo');
    _suporteCarregarChamados();
}

async function _suporteCarregarChamadoDetalhe(id) {
    const msgsEl = document.getElementById('suporteChamadoDetalheMsgs');
    const metaEl = document.getElementById('suporteChamadoDetalheMeta');
    msgsEl.innerHTML = `<div class="suporte-chamados-loading"><div class="suporte-loading-spinner"></div></div>`;
    metaEl.innerHTML = '';

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        msgsEl.innerHTML = `<div class="suporte-chamados-vazio">
            <i class="fa-solid fa-plug-circle-xmark"></i>
            <p>Não foi possível conectar ao banco de dados.</p>
        </div>`;
        return;
    }

    try {
        const { data: chamado, error: errChamado } = await supabaseClient
            .from('chamados')
            .select('id, titulo, modulo, descricao, status, anexo_url, created_at')
            .eq('id', id)
            .single();
        if (errChamado) throw errChamado;

        const { data: mensagens, error: errMsgs } = await supabaseClient
            .from('chamados_mensagens')
            .select('id, autor_tipo, usuario_nome, mensagem, anexo_url, created_at')
            .eq('chamado_id', id)
            .order('created_at', { ascending: true });
        if (errMsgs) throw errMsgs;

        _suporteRenderChamadoDetalhe(chamado, mensagens || []);

    } catch (e) {
        console.error('[Suporte Chamado Detalhe]', e);
        msgsEl.innerHTML = `<div class="suporte-chamados-vazio">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>Erro ao carregar o chamado.</p>
        </div>`;
    }
}

function _suporteRenderChamadoDetalhe(chamado, mensagens) {
    document.getElementById('suporteChamadoDetalheTitulo').textContent = chamado.titulo;

    const statusLabel = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };
    const badgeClass  = { aberto: 'suporte-badge-aberto', em_andamento: 'suporte-badge-em_andamento', resolvido: 'suporte-badge-resolvido' };
    const status = chamado.status || 'aberto';

    const metaEl = document.getElementById('suporteChamadoDetalheMeta');
    metaEl.innerHTML = `
        ${chamado.modulo ? `<span class="suporte-chamado-detalhe-modulo"><i class="fa-solid fa-layer-group"></i> ${_suporteEscapar(chamado.modulo)}</span>` : '<span class="suporte-chamado-detalhe-modulo suporte-chamado-detalhe-modulo--vazio">Módulo não informado</span>'}
        <span class="suporte-chamado-badge ${badgeClass[status] || 'suporte-badge-aberto'}">${statusLabel[status] || status}</span>`;

    // ── Resumo do problema relatado (destacado, separado da conversa) ──
    const dataAbertura = new Date(chamado.created_at);
    const dataAberturaFmt = `${String(dataAbertura.getDate()).padStart(2,'0')}/${String(dataAbertura.getMonth()+1).padStart(2,'0')}/${dataAbertura.getFullYear()} às ${String(dataAbertura.getHours()).padStart(2,'0')}:${String(dataAbertura.getMinutes()).padStart(2,'0')}`;

    const resumoEl = document.getElementById('suporteChamadoDetalheResumo');
    resumoEl.innerHTML = `
        <p class="suporte-chamado-resumo-label"><i class="fa-solid fa-circle-info"></i> Problema relatado em ${dataAberturaFmt}</p>
        <p class="suporte-chamado-resumo-desc"></p>
        ${chamado.anexo_url ? `<a href="${_suporteEscapar(chamado.anexo_url)}" target="_blank" rel="noopener" class="suporte-chamado-anexo"><i class="fa-solid fa-paperclip"></i> Ver print anexado</a>` : ''}`;
    resumoEl.querySelector('.suporte-chamado-resumo-desc').textContent = chamado.descricao;

    // ── Conversa (respostas trocadas depois da abertura) ──
    const msgsEl = document.getElementById('suporteChamadoDetalheMsgs');
    msgsEl.innerHTML = '';

    if (!mensagens.length) {
        msgsEl.innerHTML = `<p class="suporte-chamado-sem-respostas">Nenhuma resposta ainda. Escreva algo abaixo se quiser complementar o problema.</p>`;
    } else {
        mensagens.forEach(m => {
            msgsEl.appendChild(_suporteMontarBalaoMensagem(m.autor_tipo, m.mensagem, m.anexo_url));
        });
    }

    msgsEl.scrollTop = msgsEl.scrollHeight;

    const podeResponder = status !== 'resolvido';
    const input   = document.getElementById('suporteChamadoDetalheInput');
    const sendBtn = document.getElementById('suporteChamadoDetalheSend');
    input.disabled   = !podeResponder;
    sendBtn.disabled = !podeResponder;
    input.placeholder = podeResponder ? 'Escreva uma mensagem...' : 'Este chamado já foi resolvido';
}

function _suporteMontarBalaoMensagem(autorTipo, texto, anexoUrl) {
    const div = document.createElement('div');
    // Reaproveita o estilo do chat de IA: "usuario" à direita, "suporte" à esquerda
    const role = autorTipo === 'suporte' ? 'ia' : 'user';
    div.className = `chat-msg chat-msg-${role}`;

    const span = document.createElement('span');
    span.style.whiteSpace = 'pre-wrap';
    span.textContent = texto;
    div.appendChild(span);

    if (anexoUrl) {
        const a = document.createElement('a');
        a.href = anexoUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'suporte-chamado-anexo';
        a.title = 'Ver anexo';
        a.innerHTML = '<i class="fa-solid fa-paperclip"></i> Anexo';
        div.appendChild(a);
    }

    return div;
}

async function suporteEnviarMensagemChamado() {
    const input = document.getElementById('suporteChamadoDetalheInput');
    const texto = input.value.trim();
    if (!texto || !_suporteChamadoAbertoId) return;

    const sendBtn = document.getElementById('suporteChamadoDetalheSend');
    input.disabled = true;
    sendBtn.disabled = true;

    const usuario = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;

    try {
        const payload = {
            chamado_id: _suporteChamadoAbertoId,
            autor_tipo: 'usuario',
            usuario_id: usuario?.id || null,
            usuario_nome: usuario?.nome || null,
            mensagem: texto
        };

        const { error } = await supabaseClient.from('chamados_mensagens').insert(payload);
        if (error) throw error;

        await supabaseClient
            .from('chamados')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', _suporteChamadoAbertoId);

        const msgsEl = document.getElementById('suporteChamadoDetalheMsgs');
        msgsEl.querySelector('.suporte-chamado-sem-respostas')?.remove();
        msgsEl.appendChild(_suporteMontarBalaoMensagem('usuario', texto, null));
        msgsEl.scrollTop = msgsEl.scrollHeight;
        input.value = '';

    } catch (e) {
        console.error('[Suporte Chamado] Erro ao enviar mensagem:', e);
        alert('Não foi possível enviar sua mensagem. Tente novamente.');
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}
