// ========================================
// NAVEGAÇÃO - SIDEBAR CENTRALIZADO
// ========================================

const SIDEBAR_HTML = `
    <h2><i class="fa-solid fa-file-contract"></i> Marpex</h2>
    <ul>
        <li id="menu-inicio" onclick="window.location.href='inicio.html'">
            <i class="fa-solid fa-chart-line"></i> Início
        </li>

        <div class="menu-item">
            <a href="#" class="menu-title">
                <i class="fa-solid fa-building"></i>Empresas
                <i class="fa-solid fa-chevron-down arrow"></i>
            </a>
            <div class="submenu">
                <a href="cadastros.html" id="submenu-clientes"><i class="fa-solid fa-users"></i> Cadastro</a>
                <a href="relatorios.html" id="submenu-relatorios"><i class="fa-solid fa-chart-line"></i> Relatórios</a>
            </div>
        </div>

        <div class="menu-item">
            <a href="#" class="menu-title">
                <i class="fa-solid fa-boxes-stacked"></i>Produtos
                <i class="fa-solid fa-chevron-down arrow"></i>
            </a>
            <div class="submenu">
                <a href="produtos.html" id="submenu-produtos-cadastro"><i class="fa-solid fa-plus"></i> Cadastro</a>
                <a href="relatorios-produtos.html" id="submenu-produtos-relatorios"><i class="fa-solid fa-chart-line"></i> Relatórios</a>
            </div>
        </div>

        <div class="menu-item">
            <a href="#" class="menu-title">
                <i class="fa-solid fa-file-lines"></i>Proformas
                <i class="fa-solid fa-chevron-down arrow"></i>
            </a>
            <div class="submenu">
                <a href="proforma.html" id="submenu-documentos-cadastro"><i class="fa-solid fa-plus"></i> Cadastros</a>
                <a href="relatorios-proforma.html" id="submenu-documentos-relatorios"><i class="fa-solid fa-chart-line"></i> Relatórios</a>
            </div>
        </div>

        <div class="menu-item">
            <a href="#" class="menu-title">
                <i class="fa-solid fa-ship"></i>Processos
                <i class="fa-solid fa-chevron-down arrow"></i>
            </a>
            <div class="submenu">
                <a href="processos.html" id="submenu-processos-cadastro"><i class="fa-solid fa-plus"></i> Cadastros</a>
                <a href="relatorios-processos.html" id="submenu-processos-relatorios"><i class="fa-solid fa-chart-line"></i> Relatórios</a>
            </div>
        </div>

        <div class="menu-item">
            <a href="#" class="menu-title">
                <i class="fa-solid fa-scale-balanced"></i>Termos
                <i class="fa-solid fa-chevron-down arrow"></i>
            </a>
            <div class="submenu">
                <a href="termos.html" id="submenu-termos"><i class="fa-solid fa-file-contract"></i> Termos e Políticas</a>
            </div>
        </div>

        <div class="menu-item" id="menu-apoio">
            <a href="#" class="menu-title">
                <i class="fa-solid fa-book-open"></i>Apoio
                <i class="fa-solid fa-chevron-down arrow"></i>
            </a>
            <div class="submenu">
                <a href="apoio.html?tab=paises" id="submenu-paises"><i class="fa-solid fa-earth-americas"></i> Países e Regiões</a>
                <a href="apoio.html?tab=portos" id="submenu-portos"><i class="fa-solid fa-anchor"></i> Portos e Armadores</a>
                <a href="apoio.html?tab=aeroportos" id="submenu-aeroportos"><i class="fa-solid fa-plane"></i> Aeroportos e Cias Aéreas</a>
                <a href="apoio.html?tab=moedas" id="submenu-moedas"><i class="fa-solid fa-coins"></i> Moedas</a>
                <a href="apoio.html?tab=embalagens" id="submenu-embalagens"><i class="fa-solid fa-box"></i> Embalagens e Unid. Medida</a>
                <a href="apoio.html?tab=termos-pagamento" id="submenu-termos-apoio"><i class="fa-solid fa-file-invoice-dollar"></i> Termos de Pagamentos</a>
                <a href="apoio.html?tab=acondicionamento" id="submenu-acondicionamento"><i class="fa-solid fa-truck-ramp-box"></i> Acondicionamento</a>
                <a href="apoio.html?tab=container" id="submenu-container"><i class="fa-solid fa-box-open"></i> Container</a>
                <a href="apoio.html?tab=ncm" id="submenu-ncm"><i class="fa-solid fa-barcode"></i> NCM</a>
            </div>
        </div>

        <div class="menu-item">
            <a href="#" class="menu-title">
                <i class="fa-solid fa-gear"></i>Configurações
                <i class="fa-solid fa-chevron-down arrow"></i>
            </a>
            <div class="submenu">
                <a href="perfil.html" id="submenu-perfil"><i class="fa-solid fa-user"></i> Perfil</a>
                <a href="permissoes.html" id="submenu-permissoes"><i class="fa-solid fa-user-shield"></i> Usuários e Permissões</a>
            </div>
        </div>

    </ul>
`;

function injetarSidebar() {
    const aside = document.querySelector('aside');
    if (aside && !aside.querySelector('.menu-item')) {
        aside.innerHTML = SIDEBAR_HTML;
    }
}

// ── Mobile: hamburger + overlay + conta ──────────────────────
function _injetarMobile() {
    // Overlay (fundo escuro quando sidebar aberta)
    if (!document.getElementById('mob-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'mob-overlay';
        overlay.className = 'mob-overlay';
        overlay.addEventListener('click', (e) => {
            // Só fecha se clicou no overlay mesmo (não no sidebar)
            if (e.target.id === 'mob-overlay') {
                _fecharSidebarMobile();
                _fecharContaMobile();
            }
        });
        document.body.appendChild(overlay);
    }

    const topbar = document.querySelector('.topbar');

    // Hamburger no topbar (primeiro filho — lado esquerdo)
    if (topbar && !topbar.querySelector('.mob-hamburger')) {
        const btn = document.createElement('button');
        btn.className = 'mob-hamburger';
        btn.setAttribute('aria-label', 'Abrir menu');
        btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        btn.addEventListener('click', _toggleSidebarMobile);
        // Inserir como primeiro filho real (antes de qualquer elemento)
        const primeiro = topbar.firstElementChild;
        if (primeiro) topbar.insertBefore(btn, primeiro);
        else topbar.appendChild(btn);
    }

    // Ícone de conta com dropdown (lado direito)
    if (topbar && !topbar.querySelector('.mob-conta-btn')) {
        const u = (() => { try { return JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}'); } catch { return {}; } })();
        const contaBtn = document.createElement('button');
        contaBtn.className = 'mob-conta-btn';
        contaBtn.setAttribute('aria-label', 'Conta');
        if (u.avatar_url) {
            contaBtn.innerHTML = `<img src="${u.avatar_url}" class="mob-conta-avatar-img" alt="avatar">`;
        } else {
            contaBtn.innerHTML = '<i class="fa-solid fa-circle-user"></i>';
        }
        contaBtn.addEventListener('click', _toggleContaMobile);
        topbar.appendChild(contaBtn);

        // Dropdown de conta
        const dropdown = document.createElement('div');
        dropdown.id = 'mob-conta-dropdown';
        dropdown.className = 'mob-conta-dropdown';
        dropdown.innerHTML = `
            <div class="mob-conta-info">
                <span class="mob-conta-nome" id="mob-conta-nome">—</span>
                <span class="mob-conta-email" id="mob-conta-email">—</span>
            </div>
            <button class="mob-conta-sair" onclick="handleLogout()">
                <i class="fa-solid fa-right-from-bracket"></i> Sair da conta
            </button>`;
        document.body.appendChild(dropdown);

        // Preencher nome/email do usuário
        const nomeEl  = dropdown.querySelector('#mob-conta-nome');
        const emailEl = dropdown.querySelector('#mob-conta-email');
        if (nomeEl)  nomeEl.textContent  = u.nome  || '—';
        if (emailEl) emailEl.textContent = u.email || '—';
    }

    // Fechar sidebar ao clicar em qualquer link/item do menu no mobile
    const aside = document.querySelector('aside');
    if (aside) {
        aside.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 && (e.target.closest('a') || e.target.closest('li'))) {
                // Delay pequeno para garantir que a navegação começa antes de fechar
                setTimeout(() => {
                    _fecharSidebarMobile();
                }, 50);
            }
        });
    }

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.mob-conta-btn') && !e.target.closest('.mob-conta-dropdown')) {
            _fecharContaMobile();
        }
    });
}

function _toggleContaMobile() {
    const dropdown = document.getElementById('mob-conta-dropdown');
    const topbar   = document.querySelector('.topbar');
    if (!dropdown) return;
    const aberto = dropdown.classList.toggle('ativo');
    if (aberto && topbar) {
        const rect = topbar.getBoundingClientRect();
        dropdown.style.top = rect.bottom + 'px';
    }
}

function _fecharContaMobile() {
    const dropdown = document.getElementById('mob-conta-dropdown');
    if (dropdown) dropdown.classList.remove('ativo');
}

function _toggleSidebarMobile() {
    const aside   = document.querySelector('aside');
    const overlay = document.getElementById('mob-overlay');
    if (!aside) return;
    const aberto = aside.classList.toggle('mob-aberto');
    if (overlay) overlay.classList.toggle('ativo', aberto);
}

function _fecharSidebarMobile() {
    const aside   = document.querySelector('aside');
    const overlay = document.getElementById('mob-overlay');
    if (aside)   aside.classList.remove('mob-aberto');
    if (overlay) overlay.classList.remove('ativo');
}

// ========================================
// NAVEGAÇÃO - DESTACAR ITEM ATIVO
// ========================================

function _initNavegador() {
    injetarSidebar();
    destacarMenuAtivo();
    inicializarMenuColapsavel();
    destacarInicio();
    _injetarMobile();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initNavegador);
} else {
    _initNavegador();
}

function destacarInicio() {
    const paginaAtual = window.location.pathname.split('/').pop().toLowerCase();
    const menuInicio = document.getElementById('menu-inicio');
    if (menuInicio && paginaAtual !== 'inicio.html' && paginaAtual !== '') {
        menuInicio.classList.add('menu-inicio-ativo');
    }
}

// ========================================
// DESTACAR ITEM ATIVO BASEADO NA URL
// ========================================

function destacarMenuAtivo() {
    // Pegar o nome da página atual
    const paginaAtual = window.location.pathname.split('/').pop().toLowerCase();
    
    console.log('Página atual:', paginaAtual);
    
    // Remover classe active de todos os itens
    document.querySelectorAll('aside li, aside .submenu a').forEach(item => {
        item.classList.remove('active');
    });
    
    // Mapeamento de páginas para menu
    const mapeamento = {
        'inicio.html':    'menu-inicio',
        'dashboard.html': 'menu-inicio',
        '':               'menu-inicio',

        // Empresa
        'cadastros.html':  'submenu-clientes',
        'relatorios.html': 'submenu-relatorios',

        // Produtos
        'produtos.html':            'submenu-produtos-cadastro',
        'relatorios-produtos.html': 'submenu-produtos-relatorios',

        // Proformas
        'proforma.html':            'submenu-documentos-cadastro',
        'formularios.html':         'submenu-documentos-cadastro',
        'relatorios-proforma.html': 'submenu-documentos-relatorios',

        // Processos
        'processos.html':           'submenu-processos-cadastro',
        'relatorios-processos.html':'submenu-processos-relatorios',

        // Termos
        'termos.html': 'submenu-termos',

        // Configurações
        'perfil.html':     'submenu-perfil',
        'permissoes.html': 'submenu-permissoes',

        // Apoio (por query param — tratado em apoio.js)
    };
    
    const idAtivo = mapeamento[paginaAtual];
    
    if (idAtivo) {
        const elementoAtivo = document.getElementById(idAtivo);
        
        if (elementoAtivo) {
            elementoAtivo.classList.add('active');
            console.log('Menu ativo:', idAtivo);
            
            // Se for um submenu, expandir o menu pai
            if (idAtivo.startsWith('submenu-')) {
                const menuPai = elementoAtivo.closest('.menu-item');
                if (menuPai) {
                    const submenu = menuPai.querySelector('.submenu');
                    if (submenu) {
                        submenu.classList.add('active');
                        submenu.style.maxHeight = '';
                        
                        // Rotacionar a seta
                        const arrow = menuPai.querySelector('.arrow');
                        if (arrow) {
                            arrow.style.transform = 'rotate(180deg)';
                        }
                    }
                }
            }
        }
    }
}

// ========================================
// MENU COLAPSÁVEL (SUBMENUS)
// ========================================

function inicializarMenuColapsavel() {
    const menuTitles = document.querySelectorAll('.menu-title');
    
    menuTitles.forEach(title => {
        title.addEventListener('click', function(e) {
            e.preventDefault();
            
            const menuItem = this.closest('.menu-item');
            const submenu = menuItem.querySelector('.submenu');
            const arrow = this.querySelector('.arrow');
            
            // Toggle do submenu
            if (submenu.classList.contains('active')) {
                submenu.classList.remove('active');
                submenu.style.maxHeight = '';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            } else {
                submenu.classList.add('active');
                submenu.style.maxHeight = '';
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            }
        });
    });
}

// ========================================
// ATUALIZAR MENU AO MUDAR DE PÁGINA
// ========================================

// Interceptar cliques em links do menu
document.addEventListener('click', function(e) {
    const link = e.target.closest('aside a, aside li');
    
    if (link && link.getAttribute('onclick')) {
        // Deixar o onclick padrão funcionar, o menu será atualizado no load da nova página
        console.log('Navegando para nova página...');
    }
});
