/* =============================================
   TABELAS DE APOIO — Dynamic Tab Loader
   Carrega dados do Supabase conforme ?tab=X
   ============================================= */

// --------------------------------------------------
// CONFIGURAÇÃO DAS TABELAS
// Adicione novas tabelas aqui ao implementá-las.
// --------------------------------------------------
const TABELAS_CONFIG = {
    paises: {
        titulo:     'Países e Regiões',
        descricao:  'Países e regiões geográficas reconhecidos internacionalmente.',
        icone:      'fa-solid fa-earth-americas',
        tabela:     'paises',
        ordenar:    'numero',
        fonte:      'Marinha Mercante - Atualizado em 2026',
        colunas: [
            { campo: 'numero',    label: 'Nº',        mono: true,  largura: '60px' },
            { campo: 'codigo',    label: 'Código',    mono: true,  largura: '100px' },
            { campo: 'descricao', label: 'Descrição', mono: false, largura: '' },
        ],
        buscar_por: ['descricao', 'codigo'],
    },

    portos: {
        titulo:    'Portos e Armadores',
        descricao: 'Portos marítimos e armadores utilizados em operações de comércio exterior.',
        icone:     'fa-solid fa-anchor',
        tabela:    'portos',
        ordenar:   'nome',
        fonte:     '',
        colunas: [
            { campo: 'codigo_unlo', label: 'LOCODE',    mono: true,  largura: '90px'  },
            { campo: 'nome',        label: 'Nome',      mono: false, largura: ''      },
            { campo: 'cidade',      label: 'Cidade',    mono: false, largura: '130px' },
            { campo: 'pais_iso2',   label: 'País',      mono: true,  largura: '60px'  },
            { campo: 'tipo',        label: 'Tipo',      mono: false, largura: '100px' },
        ],
        buscar_por: ['nome', 'codigo_unlo', 'cidade', 'pais_iso2'],
    },

    aeroportos: {
        titulo:    'Aeroportos e Cias Aéreas',
        descricao: 'Aeroportos internacionais e companhias aéreas para operações de importação e exportação.',
        icone:     'fa-solid fa-plane',
        tabela:    'aeroportos',
        ordenar:   'nome',
        fonte:     '',
        colunas: [
            { campo: 'codigo_iata', label: 'IATA',      mono: true,  largura: '70px'  },
            { campo: 'codigo_icao', label: 'ICAO',      mono: true,  largura: '70px'  },
            { campo: 'nome',        label: 'Nome',      mono: false, largura: ''      },
            { campo: 'cidade',      label: 'Cidade',    mono: false, largura: '130px' },
            { campo: 'pais_iso2',   label: 'País',      mono: true,  largura: '60px'  },
            { campo: 'tipo',        label: 'Tipo',      mono: false, largura: '110px' },
        ],
        buscar_por: ['nome', 'codigo_iata', 'codigo_icao', 'cidade'],
    },

    moedas: {
        titulo:    'Moedas',
        descricao: 'Moedas internacionais utilizadas em operações de comércio exterior.',
        icone:     'fa-solid fa-coins',
        tabela:    'moedas',
        ordenar:   'numero',
        fonte:     'Marinha Mercante - Atualizado em 2026',
        colunas: [
            { campo: 'numero',    label: 'Nº',        mono: true,  largura: '60px'  },
            { campo: 'codigo',    label: 'Código',    mono: true,  largura: '100px' },
            { campo: 'simbolo',   label: 'Símbolo',   mono: true,  largura: '80px'  },
            { campo: 'descricao', label: 'Descrição', mono: false, largura: ''      },
        ],
        buscar_por: ['descricao', 'codigo', 'simbolo'],
    },

    embalagens: {
        titulo:    'Embalagens',
        descricao: 'Tipos de embalagens aceitas em operações de importação e exportação.',
        icone:     'fa-solid fa-box',
        tabela:    'embalagens',
        ordenar:   'descricao',
        fonte:     '',
        colunas: [
            { campo: 'codigo',    label: 'Código',    mono: true,  largura: '90px'  },
            { campo: 'descricao', label: 'Descrição', mono: false, largura: ''      },
            { campo: 'unidade',   label: 'Unidade',   mono: true,  largura: '90px'  },
        ],
        buscar_por: ['descricao', 'codigo', 'unidade'],
    },

    'termos-pagamento': {
        titulo:    'Termos de Pagamentos',
        descricao: 'Condições e termos de pagamento utilizados no comércio internacional.',
        icone:     'fa-solid fa-file-invoice-dollar',
        tabela:    'termos_pagamento',
        ordenar:   'codigo',
        fonte:     '',
        colunas: [
            { campo: 'codigo',    label: 'Código',    mono: true,  largura: '100px' },
            { campo: 'descricao', label: 'Descrição', mono: false, largura: ''      },
        ],
        buscar_por: ['descricao', 'codigo'],
    },

    acondicionamento: {
        titulo:    'Acondicionamento',
        descricao: 'Tipos de acondicionamento utilizados no transporte de mercadorias.',
        icone:     'fa-solid fa-truck-ramp-box',
        tabela:    'acondicionamento_tipos',
        ordenar:   'descricao',
        fonte:     '',
        colunas: [
            { campo: 'codigo',    label: 'Código',     mono: true,  largura: '100px' },
            { campo: 'descricao', label: 'Descrição',  mono: false, largura: ''      },
            { campo: 'tipo',      label: 'Tipo',       mono: false, largura: '140px' },
            { campo: 'observacao',label: 'Observação', mono: false, largura: '200px' },
        ],
        buscar_por: ['codigo', 'descricao', 'tipo'],
    },

    container: {
        titulo:    'Container',
        descricao: 'Tipos de containers utilizados no transporte de mercadorias.',
        icone:     'fa-solid fa-box-open',
        tabela:    'acondicionamento',
        ordenar:   'numero',
        fonte:     'Marinha Mercante - Atualizado em 2026',
        colunas: [
            { campo: 'numero',        label: 'Nº',            mono: true,  largura: '60px'  },
            { campo: 'tipo',          label: 'Tipo',           mono: false, largura: '140px' },
            { campo: 'identificacao', label: 'Identificação',  mono: true,  largura: '120px' },
            { campo: 'descricao',     label: 'Descrição',      mono: false, largura: ''      },
            { campo: 'capacidade',    label: 'Capacidade',     mono: false, largura: '100px' },
        ],
        buscar_por: ['descricao', 'identificacao', 'capacidade', 'tipo'],
    },

    ncm: {
        titulo:    'NCM',
        descricao: 'Nomenclatura Comum do Mercosul — classificação fiscal de mercadorias.',
        icone:     'fa-solid fa-barcode',
        tabela:    'ncm',
        ordenar:   'codigo',
        fonte:     '',
        colunas: [
            { campo: 'codigo',      label: 'Código NCM',  mono: true,  largura: '110px' },
            { campo: 'descricao',   label: 'Descrição',   mono: false, largura: ''      },
            { campo: 'capitulo',    label: 'Capítulo',    mono: true,  largura: '80px'  },
            { campo: 'unidade_med', label: 'Unid.',       mono: true,  largura: '70px'  },
            { campo: 'ii',          label: 'II (%)',      mono: true,  largura: '70px'  },
            { campo: 'ipi',         label: 'IPI (%)',     mono: true,  largura: '70px'  },
        ],
        buscar_por: ['descricao', 'codigo', 'capitulo'],
    },
};

// --------------------------------------------------
// ESTADO
// --------------------------------------------------
let dadosCompletos  = [];
let dadosFiltrados  = [];
let configAtual     = null;
let termoBusca      = '';
let campoBusca      = 'todos';

// --------------------------------------------------
// ELEMENTOS
// --------------------------------------------------
const elTitulo          = document.getElementById('apoioTitulo');
const elIcone           = document.getElementById('apoioIcone');
const elDescricao       = document.getElementById('apoioDescricao');
const elTopbarTitulo    = document.getElementById('topbarTitulo');
const elCardTitulo      = document.getElementById('cardTitulo');
const elCardTabela      = document.getElementById('cardTabela');
const elTelaInicial     = document.getElementById('telaInicial');
const elCarregando      = document.getElementById('mensagemCarregando');
const elVazio           = document.getElementById('mensagemVazia');
const elTabela          = document.getElementById('tabelaPrincipal');
const elHead            = document.getElementById('tabelaHead');
const elBody            = document.getElementById('tabelaBody');
const elContador        = document.getElementById('contadorRegistros');
const elCampoBusca      = document.getElementById('campoBusca');
const elTipoBusca       = document.getElementById('tipoBusca');
const elSugestoes       = document.getElementById('listaSugestoes');
const elBtnLimpar       = document.getElementById('btnLimpar');
const elFonte           = document.getElementById('fonteTabela');

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const tab    = params.get('tab');

    if (!tab || !TABELAS_CONFIG[tab]) {
        mostrarTelaInicial();
        return;
    }

    const config = TABELAS_CONFIG[tab];

    // Destaque no menu lateral sempre, independente de em_breve
    destacarMenuLateral(tab);

    if (config.em_breve) {
        mostrarEmBreve(config);
        return;
    }

    configAtual = config;
    inicializarTabela(config);
    carregarDados(config);
});

// --------------------------------------------------
// INICIALIZAR UI DA TABELA
// --------------------------------------------------
function inicializarTabela(config) {
    // Atualiza títulos
    elIcone.className     = config.icone;
    elTitulo.innerHTML    = `<i class="${config.icone}"></i> ${config.titulo}`;
    elDescricao.textContent = config.descricao || '';
    elTopbarTitulo.innerHTML = `<i class="${config.icone}"></i> ${config.titulo}`;
    elCardTitulo.innerHTML = `<i class="${config.icone}" style="color:#f7931e"></i> ${config.titulo}`;
    document.title        = `Marpex | ${config.titulo}`;

    elCardTabela.style.display  = '';
    elTelaInicial.style.display = 'none';

    // Rodapé de fonte dos dados
    if (config.fonte) {
        elFonte.innerHTML = `<i class="fa-solid fa-circle-info"></i> Fonte: ${config.fonte}`;
        elFonte.style.display = '';
    } else {
        elFonte.style.display = 'none';
    }

    // Popula select de tipo de busca
    elTipoBusca.innerHTML = '<option value="todos">Todos os campos</option>';
    (config.buscar_por || []).forEach(campo => {
        const col = config.colunas.find(c => c.campo === campo);
        if (col) {
            elTipoBusca.innerHTML += `<option value="${campo}">${col.label}</option>`;
        }
    });

    // Constrói cabeçalho da tabela
    elHead.innerHTML = `<tr>${config.colunas.map(c =>
        `<th style="${c.largura ? `width:${c.largura}` : ''}">${c.label}</th>`
    ).join('')}</tr>`;

    // Listeners de busca
    elCampoBusca.addEventListener('input', () => {
        termoBusca = elCampoBusca.value.toLowerCase().trim();
        aplicarFiltro();
        renderSugestoes();
    });

    elTipoBusca.addEventListener('change', () => {
        campoBusca = elTipoBusca.value;
        aplicarFiltro();
    });

    elBtnLimpar.addEventListener('click', limparFiltros);

    document.addEventListener('click', e => {
        if (!elSugestoes.contains(e.target) && e.target !== elCampoBusca) {
            elSugestoes.style.display = 'none';
        }
    });
}

// --------------------------------------------------
// CARREGAR DADOS DO SUPABASE
// --------------------------------------------------
async function carregarDados(config) {
    estadoCarregando(true);

    try {
        const { data, error } = await supabaseClient
            .from(config.tabela)
            .select('*')
            .order(config.ordenar || config.colunas[0].campo, { ascending: true });

        if (error) throw error;

        dadosCompletos = data || [];
        dadosFiltrados = [...dadosCompletos];
        renderTabela(dadosFiltrados);
    } catch (err) {
        console.error('[Apoio] Erro ao carregar dados:', err);
        const semTabela = err?.code === '42P01' || err?.message?.includes('does not exist');
        estadoCarregando(false);
        elCarregando.style.display = 'none';
        elVazio.style.display      = 'flex';
        elVazio.innerHTML = semTabela
            ? `<i class="fa-solid fa-database" style="font-size:28px; color:#94a3b8; margin-bottom:10px;"></i><br>
               <strong style="color:#1e293b; font-size:14px;">Tabela ainda não criada no Supabase</strong><br>
               <span style="font-size:12px;">Execute o SQL de criação em <code>tabelas-de-apoio.md</code> e adicione os dados.</span>`
            : `<i class="fa-solid fa-triangle-exclamation" style="font-size:28px; color:#f59e0b; margin-bottom:10px;"></i><br>
               <strong style="color:#1e293b; font-size:14px;">Erro ao carregar dados</strong><br>
               <span style="font-size:12px;">Verifique a conexão com o Supabase.</span>`;
    }
}

// --------------------------------------------------
// RENDERIZAR TABELA
// --------------------------------------------------
function renderTabela(lista) {
    estadoCarregando(false);

    if (lista.length === 0) {
        elTabela.style.display = 'none';
        elVazio.style.display  = 'flex';
        elContador.textContent = '0 registros';
        return;
    }

    elVazio.style.display  = 'none';
    elTabela.style.display = '';
    elContador.textContent = `${lista.length} registro${lista.length !== 1 ? 's' : ''}`;

    elBody.innerHTML = lista.map(row =>
        `<tr>${configAtual.colunas.map(col => {
            const val   = row[col.campo] ?? '—';
            const style = col.mono ? 'font-family:"Courier New",monospace; font-size:11px; font-weight:700;' : '';
            return `<td style="${style}">${val}</td>`;
        }).join('')}</tr>`
    ).join('');
}

// --------------------------------------------------
// FILTRO
// --------------------------------------------------
function aplicarFiltro() {
    if (!termoBusca) {
        dadosFiltrados = [...dadosCompletos];
    } else {
        const campos = campoBusca === 'todos'
            ? (configAtual.buscar_por || configAtual.colunas.map(c => c.campo))
            : [campoBusca];

        dadosFiltrados = dadosCompletos.filter(row =>
            campos.some(c => (row[c] ?? '').toString().toLowerCase().includes(termoBusca))
        );
    }
    renderTabela(dadosFiltrados);
}

function limparFiltros() {
    termoBusca              = '';
    campoBusca              = 'todos';
    elCampoBusca.value      = '';
    elTipoBusca.value       = 'todos';
    elSugestoes.style.display = 'none';
    dadosFiltrados          = [...dadosCompletos];
    renderTabela(dadosFiltrados);
}

// --------------------------------------------------
// SUGESTÕES DE BUSCA
// --------------------------------------------------
function renderSugestoes() {
    if (!termoBusca || !configAtual) {
        elSugestoes.style.display = 'none';
        return;
    }

    const campoLabel = configAtual.colunas.find(c => c.campo === configAtual.ordenar || c === configAtual.colunas[0]);
    const campoPrimario = configAtual.buscar_por?.[0] || configAtual.colunas[0].campo;

    const sugs = dadosCompletos
        .filter(row => (row[campoPrimario] ?? '').toString().toLowerCase().includes(termoBusca))
        .slice(0, 8)
        .map(row => row[campoPrimario]);

    if (sugs.length === 0) {
        elSugestoes.style.display = 'none';
        return;
    }

    elSugestoes.innerHTML = sugs.map(s =>
        `<div onclick="selecionarSugestao('${s.replace(/'/g,"\\'")}')">
            <i class="fa-solid fa-magnifying-glass" style="color:#94a3b8; margin-right:6px; font-size:11px;"></i>${s}
         </div>`
    ).join('');
    elSugestoes.style.display = 'block';
}

function selecionarSugestao(valor) {
    elCampoBusca.value        = valor;
    termoBusca                = valor.toLowerCase();
    elSugestoes.style.display = 'none';
    aplicarFiltro();
}

// --------------------------------------------------
// ESTADOS DE UI
// --------------------------------------------------
function estadoCarregando(ativo) {
    elCarregando.style.display = ativo ? 'flex' : 'none';
    if (ativo) {
        elTabela.style.display = 'none';
        elVazio.style.display  = 'none';
    }
}

function mostrarTelaInicial() {
    elCardTabela.style.display  = 'none';
    elTelaInicial.style.display = '';
    elTitulo.innerHTML          = '<i class="fa-solid fa-book-open"></i> Tabelas de Apoio';
    elDescricao.textContent     = 'Selecione uma tabela no menu lateral.';
}

function mostrarEmBreve(config) {
    elCardTabela.style.display  = 'none';
    elTelaInicial.style.display = '';
    elIcone.className           = config.icone;
    elTitulo.innerHTML          = `<i class="${config.icone}"></i> ${config.titulo}`;
    elDescricao.textContent     = 'Esta tabela será disponibilizada em breve.';
    elTelaInicial.innerHTML     = `
        <div class="section-card">
            <div class="section-card-body" style="padding:48px; text-align:center;">
                <i class="${config.icone}" style="font-size:48px; color:#f7931e; margin-bottom:16px; display:block;"></i>
                <h3 style="color:#1e293b; margin:0 0 8px; font-size:18px;">${config.titulo}</h3>
                <p style="color:#64748b; margin:0 0 16px; font-size:14px;">Esta tabela de apoio será disponibilizada em breve.</p>
                <span style="background:#fef3c7; color:#92400e; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:600;">Em breve</span>
            </div>
        </div>
    `;
}

// --------------------------------------------------
// DESTAQUE NO MENU LATERAL
// --------------------------------------------------
function destacarMenuLateral(tab) {
    const idMap = {
        paises:             'submenu-paises',
        portos:             'submenu-portos',
        aeroportos:         'submenu-aeroportos',
        moedas:             'submenu-moedas',
        embalagens:         'submenu-embalagens',
        'termos-pagamento': 'submenu-termos-apoio',
        acondicionamento:   'submenu-acondicionamento',
        container:          'submenu-container',
        ncm:                'submenu-ncm',
    };

    // Garantir que o botão Início sempre fica com destaque laranja
    const menuInicio = document.getElementById('menu-inicio');
    if (menuInicio) menuInicio.classList.add('menu-inicio-ativo');

    const id = idMap[tab];
    if (!id) return;

    const el = document.getElementById(id);
    if (!el) return;

    // Destaca o item de submenu
    el.classList.add('active');

    // Expande o submenu pai e rotaciona a seta
    const menuPai = el.closest('.menu-item');
    if (menuPai) {
        const submenu = menuPai.querySelector('.submenu');
        if (submenu) submenu.classList.add('active');
        const arrow = menuPai.querySelector('.arrow');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

// --------------------------------------------------
// WHATSAPP
// --------------------------------------------------
function toggleWhatsappChat() {
    document.getElementById('whatsappChat').classList.toggle('open');
}

function enviarMensagem() {
    const input = document.getElementById('chatInput');
    const texto = input.value.trim();
    if (!texto) return;
    const body  = document.querySelector('.chat-body');
    body.innerHTML += `
        <div class="chat-message" style="align-self:flex-end;">
            <div class="message-content" style="background:#dcf8c6; border-radius:12px 0 12px 12px;">${texto}</div>
            <div class="message-time" style="text-align:right;">Agora</div>
        </div>`;
    input.value = '';
    body.scrollTop = body.scrollHeight;
}
