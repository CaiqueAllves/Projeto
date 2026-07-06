// ========================================
// WIDGET DE SUPORTE — injeta em todas as páginas
// ========================================
//
// Tabela necessária no Supabase:
// CREATE TABLE chamados (
//     id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     empresa_proprietaria_id UUID REFERENCES empresas(id),
//     usuario_id       UUID,
//     titulo           TEXT NOT NULL,
//     modulo           TEXT,
//     descricao        TEXT NOT NULL,
//     status           TEXT DEFAULT 'aberto'
//                          CHECK (status IN ('aberto','em_andamento','resolvido')),
//     created_at       TIMESTAMPTZ DEFAULT NOW(),
//     updated_at       TIMESTAMPTZ DEFAULT NOW()
// );

// ── Configurações ────────────────────────────────────────────────────────────

// Chave da API Anthropic para o chat de dúvidas
// ATENÇÃO: em produção, use um proxy backend para proteger esta chave
const SUPORTE_API_KEY = 'SUA_CHAVE_AQUI';

// EmailJS — configure em https://www.emailjs.com
const SUPORTE_EMAILJS_PUBLIC_KEY  = 'SUA_PUBLIC_KEY';
const SUPORTE_EMAILJS_SERVICE_ID  = 'SUA_SERVICE_ID';
const SUPORTE_EMAILJS_TEMPLATE_ID = 'SEU_TEMPLATE_ID';
const SUPORTE_EMAIL_DESTINO       = 'email@suporte.com';

// ── Prompt do assistente de IA ───────────────────────────────────────────────

const SUPORTE_SYSTEM_PROMPT = `Você é um assistente virtual da Marpex, sistema de gestão de comércio exterior brasileiro.
Seu objetivo é ajudar os usuários a usar o sistema de forma clara e eficiente.

O sistema Marpex inclui:
- Processos: quadro kanban para gestão de processos de exportação, exportação indireta e importação. Status disponíveis: Aberta, Pendente e Encerrada.
- Cadastros: cadastro de empresas parceiras e produtos.
- Apoio: recursos de apoio, documentos e materiais de referência.
- Início: painel principal com visão geral.

Regras de resposta:
- Use português brasileiro claro e amigável
- Seja objetivo e direto, sem enrolação
- Para problemas técnicos ou bugs, oriente o usuário a usar "Reportar um problema" no menu de suporte
- Para ajuda urgente, sugira o WhatsApp disponível no menu
- Formate respostas longas em tópicos quando adequado
- Não invente funcionalidades que não foram mencionadas acima`;

// ── Estado global ────────────────────────────────────────────────────────────

let _suporteChatHistorico = [];
let _suporteEnviando      = false;
let _suporteImagemColada  = null;

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
                            <option value="Processos">Processos</option>
                            <option value="Cadastros">Cadastros</option>
                            <option value="Produtos">Produtos</option>
                            <option value="Apoio">Apoio</option>
                            <option value="Início / Dashboard">Início / Dashboard</option>
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
    document.getElementById('suportePanel')?.classList.remove('suporte-panel--chamados');
    document.getElementById('suporteBody').style.display = '';
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
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SUPORTE_API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-request-type': 'CORS'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 512,
                system: SUPORTE_SYSTEM_PROMPT,
                messages: _suporteChatHistorico
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data    = await res.json();
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

    // 1. Salvar no Supabase
    let chamadoId = null;
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
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
            if (!error && data) chamadoId = data.id;
        } catch (e) {
            console.warn('[Suporte Report] Supabase save failed:', e);
        }
    }

    // 2. Enviar email via EmailJS
    _suporteCarregarEmailJS(async (err) => {
        if (!err) {
            try {
                await emailjs.send(SUPORTE_EMAILJS_SERVICE_ID, SUPORTE_EMAILJS_TEMPLATE_ID, {
                    to_email:  SUPORTE_EMAIL_DESTINO,
                    titulo,
                    modulo:    modulo || 'Não informado',
                    descricao: desc,
                    pagina:    window.location.href,
                    data_hora: new Date().toLocaleString('pt-BR'),
                    tem_imagem: _suporteImagemColada ? 'Sim' : 'Não',
                    chamado_id: chamadoId || 'N/A'
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
            .select('id, titulo, modulo, status, updated_at')
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

        return `<div class="suporte-chamado-item">
            <div class="suporte-chamado-info">
                <p class="suporte-chamado-titulo">${_suporteEscapar(c.titulo)}</p>
                <span class="suporte-chamado-data">Atualizado em ${dataFmt}</span>
            </div>
            <span class="suporte-chamado-badge ${badgeClass[status] || 'suporte-badge-aberto'}">
                ${statusLabel[status] || status}
            </span>
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
