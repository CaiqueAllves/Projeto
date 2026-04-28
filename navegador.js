// ========================================
// NAVEGAÇÃO - DESTACAR ITEM ATIVO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    destacarMenuAtivo();
    inicializarMenuColapsavel();
    destacarInicio();
});

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
        'dashboard.html': 'menu-inicio',
        'inicio.html': 'menu-inicio',
        '': 'menu-inicio', // Página em branco vai para início
        
        // Submenus - Empresa
        'cadastros.html': 'submenu-clientes',
        'clientes.html': 'submenu-clientes',
        'fornecedores.html': 'submenu-fornecedores',
        'relatorios.html': 'submenu-relatorios',

        // Submenus - Documentos
        'formularios.html': 'submenu-documentos-cadastro',

        // Submenus - Processos
        'processos.html': 'submenu-processos-cadastro',
        
        // Submenus - Produtos
        'produtos.html': 'submenu-produtos-cadastro',
        'consulta.html': 'submenu-consulta',
        'consulta.html': 'submenu-consulta',
        
        // Submenus - Termos
        'termos.html':            'submenu-termos',
        'termos-negociacao.html': 'submenu-termos-negociacao',
        'termos-pagamentos.html': 'submenu-termos-pagamentos',
        
        // Submenus - Configurações
        'perfil.html': 'submenu-perfil',
        'permissoes.html': 'submenu-permissoes',
        
        // Submenus - Apoio
        'tabela-paises.html': 'submenu-paises',
        'tabela-estados.html': 'submenu-estados',
        'tabela-portos.html': 'submenu-portos',
        'tabela-aeroportos.html': 'submenu-aeroportos',
        'tabela-cias-aereas.html': 'submenu-cias',
        'tabela-armadores.html': 'submenu-armadores',
        'tabela-moedas.html': 'submenu-moedas',
        'tabela-embalagens.html': 'submenu-embalagens',
        'tabela-ncm.html': 'submenu-ncm',
        'suporte.html': 'submenu-suporte'
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
