// ========================================
// WIDGET DE SUPORTE — injeta em todas as páginas
// ========================================
//
// Tabela e bucket de Storage necessários no Supabase: ver database/database-chamados.sql

// ── Configurações ────────────────────────────────────────────────────────────

// Chat de dúvidas: chama a Edge Function suporte-ia (supabase/functions/suporte-ia),
// que guarda a chave da Anthropic no servidor e nunca a expõe no front-end.
const SUPORTE_IA_ENDPOINT = `${SUPABASE_URL}/functions/v1/suporte-ia`;

// Repasse do chamado: mensagem pronta no WhatsApp da equipe (wa.me — abre o
// WhatsApp do usuário com o texto preenchido; ele só confirma o envio).
const SUPORTE_WHATSAPP_DESTINO    = '5511987216497';

// ── Prompt do assistente de IA ───────────────────────────────────────────────

const SUPORTE_SYSTEM_PROMPT = `Você é um assistente virtual da Marpex, sistema de gestão de comércio exterior brasileiro.
Seu objetivo é ajudar os usuários a usar o sistema de forma clara e eficiente.

O sistema Marpex é organizado em 4 módulos, selecionáveis no topo do menu lateral:

Operacional:
- Início: painel principal com visão geral.
- Empresas: cadastro de empresas parceiras (clientes, fornecedores etc.).
- Produtos: cadastro de produtos.
- Proformas: emissão e gestão de proformas.
- Processos: quadro kanban para gestão de processos de exportação e exportação indireta. Status disponíveis: Aberta, Pendente e Encerrada.
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
            <span class="suporte-badge-notif" id="suporteBadgeFloat" style="display:none;"></span>
        </div>
        <div class="suporte-toast-notif" id="suporteToastNotif" style="display:none;" onclick="suporteAbrirNotificacao()"></div>`;

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
                            <span class="suporte-opcao-titulo">Meus chamados <span class="suporte-badge-notif suporte-badge-notif--inline" id="suporteBadgeMenu" style="display:none;"></span></span>
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
                    <p class="suporte-sucesso-desc">Recebemos seu reporte. Toque abaixo para avisar nossa equipe pelo WhatsApp e agilizar o atendimento.</p>
                    <button class="suporte-sucesso-btn suporte-sucesso-btn-wpp" onclick="suporteAbrirWhatsApp()">
                        <i class="fa-brands fa-whatsapp"></i> Avisar a equipe no WhatsApp
                    </button>
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
                    <div class="suporte-resp-anexo-chip" id="suporteRespAnexoChip" style="display:none;">
                        <img id="suporteRespAnexoThumb" alt="">
                        <span id="suporteRespAnexoNome"></span>
                        <button type="button" onclick="suporteRemoverAnexoResposta()" title="Remover anexo"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="suporte-chat-input-row">
                        <label class="suporte-resp-clipe" title="Anexar imagem ou print (ou cole com Ctrl+V)">
                            <i class="fa-solid fa-paperclip"></i>
                            <input type="file" id="suporteRespArquivo" accept="image/*,.pdf" style="display:none;" onchange="suporteEscolherAnexoResposta(this.files[0])">
                        </label>
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
        document.getElementById('suporteChamadoDetalheInput').addEventListener('paste', e => {
            const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
            if (item) { e.preventDefault(); suporteEscolherAnexoResposta(item.getAsFile()); }
        });
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

let _suporteWhatsAppTexto = '';
let _suporteUltimoNumero = null;
const _suporteNumFmt = n => '#' + String(n).padStart(4, '0');

function suporteAbrirWhatsApp() {
    if (!_suporteWhatsAppTexto) return;
    window.open(`https://wa.me/${SUPORTE_WHATSAPP_DESTINO}?text=${encodeURIComponent(_suporteWhatsAppTexto)}`, '_blank', 'noopener');
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

            payload.usuario_nome  = usuario?.nome  || null;
            payload.usuario_email = usuario?.email || null;

            let { data, error } = await supabaseClient.from('chamados').insert(payload).select('id, numero').single();
            // Migrações ainda não rodadas (número / nome do solicitante) — tenta sem as colunas novas
            if (error && /numero/.test(error.message || '')) {
                ({ data, error } = await supabaseClient.from('chamados').insert(payload).select('id').single());
            }
            if (error && /usuario_(nome|email)/.test(error.message || '')) {
                delete payload.usuario_nome; delete payload.usuario_email;
                ({ data, error } = await supabaseClient.from('chamados').insert(payload).select('id').single());
            }
            if (data?.numero != null) _suporteUltimoNumero = data.numero;
            return (!error && data) ? data.id : null;
        } catch (e) {
            console.warn('[Suporte Report] Supabase save failed:', e);
            return null;
        }
    })();

    const resumoPromise = _suporteGerarResumoIA(titulo, modulo, desc);

    _suporteUltimoNumero = null;
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

    // 3. Monta a mensagem de WhatsApp (o envio em si é um clique do usuário)
    const resumoCurto = resumoIA ? String(resumoIA).slice(0, 600) : 'Triagem automática indisponível.';
    _suporteWhatsAppTexto = [
        '*Novo chamado Marpex*',
        `*Título:* ${titulo}`,
        `*Módulo:* ${modulo || 'Não informado'}`,
        `*Usuário:* ${usuario?.nome || 'N/A'}${usuario?.email ? ' (' + usuario.email + ')' : ''}`,
        `*Descrição:* ${desc}`,
        `*Triagem IA:* ${resumoCurto}`,
        `*Página:* ${window.location.href}`,
        anexoUrl ? `*Print:* ${anexoUrl}` : null,
        `*Chamado:* ${_suporteUltimoNumero != null ? _suporteNumFmt(_suporteUltimoNumero) : (chamadoId || 'N/A (não foi salvo no sistema)')}`
    ].filter(Boolean).join('\n');

    const tituloSucesso = document.querySelector('#suporteReportSucesso .suporte-sucesso-titulo');
    if (tituloSucesso) tituloSucesso.textContent = _suporteUltimoNumero != null ? `Chamado ${_suporteNumFmt(_suporteUltimoNumero)} enviado!` : 'Enviado com sucesso!';
    _suporteReportSetEstado('sucesso');
}

// ── ④ Meus chamados ───────────────────────────────────────────────────────────

function _suporteMostrarChamados() {
    document.getElementById('suporteBody').style.display = 'none';
    document.getElementById('suportePanel').classList.add('suporte-panel--chamados');
    document.getElementById('suporteChamadosView').classList.add('ativo');
    _suporteCarregarChamados();
}

async function _suporteCarregarChamados(silencioso = false) {
    const lista = document.getElementById('suporteChamadosLista');

    // Mostrar loading
    if (!silencioso) lista.innerHTML = `<div class="suporte-chamados-loading"><div class="suporte-loading-spinner"></div></div>`;

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
            .select('*')
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
        if (silencioso) return;
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
                <p class="suporte-chamado-titulo">${c.numero != null ? `<strong>${_suporteNumFmt(c.numero)}</strong> · ` : ''}${_suporteEscapar(c.titulo)}</p>
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
    _suporteAplicarNaoLidosNaLista();
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

// silencioso = atualização automática em segundo plano (sem spinner, sem
// mexer na tela se nada mudou, sem mostrar erro de rede passageiro)
let _suporteDetalheAssinatura = '';
async function _suporteCarregarChamadoDetalhe(id, silencioso = false) {
    const msgsEl = document.getElementById('suporteChamadoDetalheMsgs');
    const metaEl = document.getElementById('suporteChamadoDetalheMeta');
    if (!silencioso) {
        _suporteDetalheAssinatura = '';
        msgsEl.innerHTML = `<div class="suporte-chamados-loading"><div class="suporte-loading-spinner"></div></div>`;
        metaEl.innerHTML = '';
    }

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
            .select('*')
            .eq('id', id)
            .single();
        if (errChamado) throw errChamado;

        const { data: mensagens, error: errMsgs } = await supabaseClient
            .from('chamados_mensagens')
            .select('id, autor_tipo, usuario_nome, mensagem, anexo_url, created_at')
            .eq('chamado_id', id)
            .order('created_at', { ascending: true });
        if (errMsgs) throw errMsgs;

        const lista = mensagens || [];
        const assinatura = `${chamado.status}|${lista.length}|${lista[lista.length - 1]?.id || ''}`;
        if (silencioso && assinatura === _suporteDetalheAssinatura) return;
        if (id !== _suporteChamadoAbertoId) return; // usuário já saiu/trocou de chamado
        _suporteDetalheAssinatura = assinatura;
        _suporteRenderChamadoDetalhe(chamado, lista);
        _suporteMarcarVisto(id);

    } catch (e) {
        if (silencioso) return;
        console.error('[Suporte Chamado Detalhe]', e);
        msgsEl.innerHTML = `<div class="suporte-chamados-vazio">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>Erro ao carregar o chamado.</p>
        </div>`;
    }
}

function _suporteRenderChamadoDetalhe(chamado, mensagens) {
    document.getElementById('suporteChamadoDetalheTitulo').textContent = (chamado.numero != null ? _suporteNumFmt(chamado.numero) + ' · ' : '') + chamado.titulo;

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

    if (anexoUrl && /^https:\/\//i.test(anexoUrl)) {
        const a = document.createElement('a');
        a.href = anexoUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Abrir anexo';
        if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(anexoUrl)) {
            a.className = 'suporte-msg-img';
            const img = document.createElement('img');
            img.src = anexoUrl;
            img.alt = 'Anexo';
            a.appendChild(img);
        } else {
            a.className = 'suporte-chamado-anexo';
            a.innerHTML = '<i class="fa-solid fa-paperclip"></i> Anexo';
        }
        div.appendChild(a);
    }

    return div;
}

let _suporteAnexoResposta = null;

function suporteEscolherAnexoResposta(arquivo) {
    if (!arquivo) return;
    if (arquivo.size > 10 * 1024 * 1024) { alert('O arquivo é grande demais (máx. 10 MB).'); return; }
    _suporteAnexoResposta = arquivo;
    const chip = document.getElementById('suporteRespAnexoChip');
    const thumb = document.getElementById('suporteRespAnexoThumb');
    document.getElementById('suporteRespAnexoNome').textContent = arquivo.name || 'imagem colada';
    if (arquivo.type.startsWith('image/')) { thumb.src = URL.createObjectURL(arquivo); thumb.style.display = ''; } else { thumb.style.display = 'none'; }
    chip.style.display = 'flex';
}

function suporteRemoverAnexoResposta() {
    _suporteAnexoResposta = null;
    document.getElementById('suporteRespAnexoChip').style.display = 'none';
    document.getElementById('suporteRespArquivo').value = '';
}

async function suporteEnviarMensagemChamado() {
    const input = document.getElementById('suporteChamadoDetalheInput');
    const texto = input.value.trim();
    const arquivo = _suporteAnexoResposta;
    if ((!texto && !arquivo) || !_suporteChamadoAbertoId) return;

    const sendBtn = document.getElementById('suporteChamadoDetalheSend');
    input.disabled = true;
    sendBtn.disabled = true;

    const usuario = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;

    try {
        let anexoUrl = null;
        if (arquivo) {
            const caminho = `${_suporteChamadoAbertoId}/${Date.now()}.${_suporteExtensaoArquivo(arquivo)}`;
            const { error: errUp } = await supabaseClient.storage.from('chamados-anexos')
                .upload(caminho, arquivo, { contentType: arquivo.type || 'image/png' });
            if (errUp) throw errUp;
            anexoUrl = supabaseClient.storage.from('chamados-anexos').getPublicUrl(caminho).data?.publicUrl || null;
        }

        const mensagem = texto || '(anexo)';
        const payload = {
            chamado_id: _suporteChamadoAbertoId,
            autor_tipo: 'usuario',
            usuario_id: usuario?.id || null,
            usuario_nome: usuario?.nome || null,
            mensagem,
            anexo_url: anexoUrl
        };

        const { error } = await supabaseClient.from('chamados_mensagens').insert(payload);
        if (error) throw error;

        await supabaseClient
            .from('chamados')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', _suporteChamadoAbertoId);

        const msgsEl = document.getElementById('suporteChamadoDetalheMsgs');
        msgsEl.querySelector('.suporte-chamado-sem-respostas')?.remove();
        msgsEl.appendChild(_suporteMontarBalaoMensagem('usuario', mensagem, anexoUrl));
        msgsEl.scrollTop = msgsEl.scrollHeight;
        input.value = '';
        suporteRemoverAnexoResposta();
        _suporteDetalheAssinatura = ''; // próxima atualização automática redesenha com a versão do banco

    } catch (e) {
        console.error('[Suporte Chamado] Erro ao enviar mensagem:', e);
        alert('Não foi possível enviar sua mensagem. Tente novamente.');
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// ── Atualização automática (o usuário vê a resposta do suporte sem recarregar) ──
// Polling leve enquanto o painel está aberto e a aba visível.
setInterval(() => {
    if (document.hidden || document.documentElement.dataset.abaInativa === '1') return;
    const painel = document.getElementById('suportePanel');
    if (!painel || !painel.classList.contains('ativo')) return;
    if (document.getElementById('suporteChamadoDetalheView')?.classList.contains('ativo') && _suporteChamadoAbertoId) {
        _suporteCarregarChamadoDetalhe(_suporteChamadoAbertoId, true);
    } else if (document.getElementById('suporteChamadosView')?.classList.contains('ativo')) {
        _suporteCarregarChamados(true);
    }
}, 8000);

// ── Notificações de resposta/mensagem nova ────────────────────────────────────
// Usuário comum: avisa quando o suporte responde um chamado (badge + animação no
// botão flutuante, aviso "Nova resposta no chamado #N", ponto no "Meus chamados").
// Administrador (Central): avisa chamado novo e mensagem nova de usuário.
// Sem servidor de push — polling leve a cada 20s; o "visto" fica no localStorage.

let _suporteLeiturasOk = null;          // null = ainda não sabe; false = tabela não existe (usa só o localStorage)
let _suporteNaoLidosQtd = new Map();   // chamado_id -> nº de respostas não lidas
let _suporteNaoLidos = new Set();      // ids de chamados com resposta não lida (usuário)
let _suporteNotifTotal = null;          // total anterior (null = primeira verificação)
let _suporteToastChamadoId = null;
let _suporteToastTimer = null;

function _suporteChaveVistos() {
    const u = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;
    return u?.id ? `suporte_vistos_${u.id}` : null;
}

function _suporteLerVistos() {
    const chave = _suporteChaveVistos();
    if (!chave) return null;
    try {
        const v = JSON.parse(localStorage.getItem(chave) || 'null');
        if (v?.baseline) return v;
    } catch {}
    const novo = { baseline: new Date().toISOString(), chamados: {} };
    localStorage.setItem(chave, JSON.stringify(novo));
    return novo;
}

function _suporteMarcarVisto(chamadoId) {
    const chave = _suporteChaveVistos();
    const v = _suporteLerVistos();
    if (!chave || !v) return;
    const agora = new Date().toISOString();
    v.chamados[chamadoId] = agora;
    localStorage.setItem(chave, JSON.stringify(v));
    // "Visto" no servidor (vale em qualquer navegador/dispositivo) — só se a migração database-chamados-leituras.sql rodou
    const u = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;
    if (_suporteLeiturasOk !== false && u?.id && typeof supabaseClient !== 'undefined') {
        supabaseClient.from('chamados_leituras').upsert({ chamado_id: chamadoId, usuario_id: u.id, visto_em: agora }, { onConflict: 'chamado_id,usuario_id' })
            .then(({ error }) => { if (error && /chamados_leituras|relation|schema cache/i.test(error.message || '')) _suporteLeiturasOk = false; });
    }
    if (_suporteNaoLidos.delete(chamadoId)) {
        _suporteNotifTotal = Math.max(0, (_suporteNotifTotal || 0) - (_suporteNaoLidosQtd.get(chamadoId) || 1));
        _suporteNaoLidosQtd.delete(chamadoId);
        _suporteAtualizarBadges(_suporteNotifTotal, false);
    }
}

function _suporteAtualizarBadges(total, animar) {
    const rotulo = total > 9 ? '9+' : String(total);
    ['suporteBadgeFloat', 'suporteBadgeMenu'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = rotulo;
        el.style.display = total > 0 ? '' : 'none';
    });
    const flutuante = document.getElementById('suporteFloat');
    if (flutuante) {
        flutuante.classList.toggle('suporte-float--novo', total > 0);
        if (animar) { flutuante.classList.remove('suporte-float--balanca'); void flutuante.offsetWidth; flutuante.classList.add('suporte-float--balanca'); }
    }
    document.title = document.title.replace(/^\(\d+\)\s*/, '');
    if (total > 0) document.title = `(${total}) ${document.title}`;
}

function _suporteMostrarToast(texto, chamadoId) {
    const el = document.getElementById('suporteToastNotif');
    if (!el) return;
    _suporteToastChamadoId = chamadoId || null;
    el.innerHTML = `<i class="fa-solid fa-bell"></i> <span></span>`;
    el.querySelector('span').textContent = texto;
    el.style.display = 'flex';
    el.classList.remove('suporte-toast-notif--entra'); void el.offsetWidth; el.classList.add('suporte-toast-notif--entra');
    clearTimeout(_suporteToastTimer);
    _suporteToastTimer = setTimeout(() => { el.style.display = 'none'; }, 8000);
}

function suporteAbrirNotificacao() {
    document.getElementById('suporteToastNotif').style.display = 'none';
    if (typeof ehAdminSuporte === 'function' && ehAdminSuporte()) {
        if (window.top !== window && typeof window.top.abrirAba === 'function') window.top.abrirAba('chamados-admin.html');
        else window.location.href = 'chamados-admin.html';
        return;
    }
    document.getElementById('suportePanel')?.classList.add('ativo');
    if (_suporteToastChamadoId) { suporteAcao('chamados'); setTimeout(() => _suporteAbrirChamado(_suporteToastChamadoId), 150); }
    else suporteAcao('chamados');
}

function _suporteNumFmtSeguro(c) { return c?.numero != null ? ' ' + _suporteNumFmt(c.numero) : ''; }

async function _suporteVerificarNovidades() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    const usuario = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;
    if (!usuario?.id) return;
    try {
        if (typeof ehAdminSuporte === 'function' && ehAdminSuporte()) return _suporteVerificarNovidadesAdmin();

        const vistos = _suporteLerVistos();
        // Só os chamados que ESTE usuário abriu (quem relatou é quem precisa ser avisado)
        const { data: meus } = await supabaseClient.from('chamados').select('id').eq('usuario_id', usuario.id).limit(300);
        const ids = (meus || []).map(c => c.id);
        if (!ids.length) { _suporteNaoLidos = new Set(); _suporteNaoLidosQtd = new Map(); _suporteNotifTotal = 0; _suporteAtualizarBadges(0, false); return; }

        let leituras = null;
        if (_suporteLeiturasOk !== false) {
            const r = await supabaseClient.from('chamados_leituras').select('chamado_id, visto_em').eq('usuario_id', usuario.id).in('chamado_id', ids);
            if (r.error) { if (/chamados_leituras|relation|schema cache/i.test(r.error.message || '')) _suporteLeiturasOk = false; }
            else { _suporteLeiturasOk = true; leituras = new Map((r.data || []).map(x => [x.chamado_id, x.visto_em])); }
        }
        // Sem a tabela no servidor: cai no "visto" local (janela de 7 dias, pra não perder respostas de quem voltou depois)
        const desde = leituras ? '1970-01-01T00:00:00Z' : new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: msgs, error } = await supabaseClient.from('chamados_mensagens')
            .select('chamado_id, created_at').eq('autor_tipo', 'suporte').in('chamado_id', ids)
            .gt('created_at', desde).order('created_at', { ascending: false }).limit(300);
        if (error) return;

        const abertoAgora = document.getElementById('suportePanel')?.classList.contains('ativo')
            && document.getElementById('suporteChamadoDetalheView')?.classList.contains('ativo')
            ? _suporteChamadoAbertoId : null;

        const naoLidos = new Map(); // chamado_id -> quantidade
        const t = iso => new Date(iso).getTime();
        for (const m of (msgs || [])) {
            const visto = leituras ? (leituras.get(m.chamado_id) || '1970-01-01T00:00:00Z') : (vistos.chamados[m.chamado_id] || desde);
            if (t(m.created_at) > t(visto)) naoLidos.set(m.chamado_id, (naoLidos.get(m.chamado_id) || 0) + 1);
        }
        if (abertoAgora && naoLidos.has(abertoAgora)) { _suporteMarcarVisto(abertoAgora); naoLidos.delete(abertoAgora); }

        const total = Array.from(naoLidos.values()).reduce((a, b) => a + b, 0);
        _suporteNaoLidos = new Set(naoLidos.keys());
        _suporteNaoLidosQtd = naoLidos;
        // Primeira checagem da sessão de login com resposta pendente também avisa (quem voltou depois da resposta)
        const primeiraDaSessao = !sessionStorage.getItem('suporte_aviso_inicial') && total > 0;
        if (primeiraDaSessao) sessionStorage.setItem('suporte_aviso_inicial', '1');
        const subiu = (_suporteNotifTotal !== null && total > _suporteNotifTotal) || primeiraDaSessao;
        _suporteNotifTotal = total;
        _suporteAtualizarBadges(total, subiu);
        _suporteAplicarNaoLidosNaLista();

        if (subiu) {
            const id = msgs.find(m => naoLidos.has(m.chamado_id))?.chamado_id;
            let num = '';
            try { const { data: c } = await supabaseClient.from('chamados').select('numero').eq('id', id).maybeSingle(); num = _suporteNumFmtSeguro(c); } catch {}
            _suporteMostrarToast(`Nova resposta no chamado${num}`, id);
        }
    } catch (e) { /* rede instável: tenta de novo no próximo ciclo */ }
}

// Administrador: chamado novo + mensagem nova de usuário desde a última visita à Central
async function _suporteVerificarNovidadesAdmin() {
    const emCentral = window.location.pathname.split('/').pop() === 'chamados-admin.html' && !document.hidden;
    let desde = localStorage.getItem('suporte_admin_visto');
    if (!desde) { desde = new Date(Date.now() - 7 * 86400000).toISOString(); localStorage.setItem('suporte_admin_visto', desde); }
    if (emCentral) { localStorage.setItem('suporte_admin_visto', new Date().toISOString()); _suporteNotifTotal = 0; _suporteAtualizarBadgeAdmin(0, false); return; }

    const [novos, msgs] = await Promise.all([
        supabaseClient.from('chamados').select('id, numero', { count: 'exact' }).gt('created_at', desde).order('created_at', { ascending: false }).limit(1),
        supabaseClient.from('chamados_mensagens').select('chamado_id', { count: 'exact' }).eq('autor_tipo', 'usuario').gt('created_at', desde).order('created_at', { ascending: false }).limit(1),
    ]);
    if (novos.error || msgs.error) return;
    const total = (novos.count || 0) + (msgs.count || 0);
    const subiu = _suporteNotifTotal !== null && total > _suporteNotifTotal;
    _suporteNotifTotal = total;
    _suporteAtualizarBadgeAdmin(total, subiu);
    if (subiu) {
        _suporteMostrarToast((novos.count || 0) > 0 && (novos.count || 0) >= (msgs.count || 0) ? `Novo chamado${_suporteNumFmtSeguro(novos.data?.[0])}` : 'Nova mensagem de usuário em um chamado', null);
    }
}

function _suporteAtualizarBadgeAdmin(total, animar) {
    const rotulo = total > 9 ? '9+' : String(total);
    // No app.html o menu lateral vive na janela principal, não no iframe da tela
    const docMenu = (window.top !== window) ? window.top.document : document;
    let b = docMenu.getElementById('menuChamadosBadge');
    const item = docMenu.getElementById('menu-chamados-admin');
    if (item && !b) { b = docMenu.createElement('span'); b.id = 'menuChamadosBadge'; b.className = 'suporte-badge-notif suporte-badge-notif--menu'; item.appendChild(b); }
    if (b) { b.textContent = rotulo; b.style.display = total > 0 ? '' : 'none'; }
    _suporteAtualizarBadges(total, animar);
}

function _suporteAplicarNaoLidosNaLista() {
    document.querySelectorAll('#suporteChamadosLista .suporte-chamado-item').forEach(item => {
        const m = /_suporteAbrirChamado\('([^']+)'\)/.exec(item.getAttribute('onclick') || '');
        const novo = !!m && _suporteNaoLidos.has(m[1]);
        item.classList.toggle('suporte-chamado-item--novo', novo);
        const info = item.querySelector('.suporte-chamado-titulo');
        if (info && novo && !info.querySelector('.suporte-pill-nova')) info.insertAdjacentHTML('beforeend', ' <span class="suporte-pill-nova">Nova resposta</span>');
        if (info && !novo) info.querySelector('.suporte-pill-nova')?.remove();
    });
}

// Em aba inativa do app.html (iframe escondido) não faz polling — só a aba visível consulta
const _suporteAbaInativa = () => document.documentElement.dataset.abaInativa === '1';
setTimeout(() => { if (!_suporteAbaInativa()) _suporteVerificarNovidades(); }, 3000);
setInterval(() => { if (!document.hidden && !_suporteAbaInativa()) _suporteVerificarNovidades(); }, 20000);
