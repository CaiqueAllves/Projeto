# DocuTrade - Sistema de Gestão de Documentos

## 🚀 Como Usar

### 1. Abrir o Sistema
- Abra o arquivo **login.html** no navegador
- A tela de login estará centralizada (horizontal e vertical)


### 3. Navegação
Após o login, você será redirecionado para o **Dashboard**.

Use o menu lateral para navegar:
- 📊 **Dashboard** - Visão geral e estatísticas
- 📄 **Documentos** - Gerenciar todos os documentos
- ⬆️ **Upload** - Enviar novos documentos
- 📈 **Relatórios** - Gerar relatórios
- 🛡️ **Permissões** - Gerenciar usuários
- ⚙️ **Configurações** - Preferências do sistema

## 🔧 Problemas Corrigidos

✅ **Tela de Login centralizada** - Horizontal e vertical
✅ **Cor do texto nos inputs** - Agora preto/escuro (não branco)
✅ **Autofill do navegador** - Corrigido para não deixar texto branco
✅ **Login funcional** - admin/admin123 funciona perfeitamente
✅ **Logs de debug** - Console mostra o processo de login

## 📁 Estrutura de Arquivos

```
├── login.html          → Tela de login
├── dashboard.html      → Dashboard principal
├── documentos.html     → Lista de documentos
├── upload.html         → Upload de arquivos
├── relatorios.html     → Relatórios
├── permissoes.html     → Gerenciamento de usuários
├── configuracoes.html  → Configurações
├── style.css          → Estilos (compartilhado)
├── auth.js            → Autenticação (compartilhado)
├── dashboard.js       → Lógica do dashboard
├── documentos.js      → Lógica de documentos
├── upload.js          → Lógica de upload
├── relatorios.js      → Lógica de relatórios
├── permissoes.js      → Lógica de permissões
└── configuracoes.js   → Lógica de configurações
```

## 🔐 LocalStorage

O sistema usa **LocalStorage** para lembrar o usuário:

1. Marque "Lembrar-me" no login
2. Faça logout ou feche o navegador
3. Ao reabrir, você será logado automaticamente

Para limpar dados salvos:
- Vá em **Configurações** → **Limpar Dados Salvos**

## 🎨 Cores do Projeto

- **Azul Principal:** #1f3c88
- **Laranja:** #f7931e
- **Branco:** #ffffff
- **Cinza:** #f4f6f9
- **Verde (sucesso):** #16a34a
- **Vermelho (erro):** #dc2626

## 🐛 Debug

Se o login não funcionar:
1. Abra o **Console do Navegador** (F12)
2. Tente fazer login
3. Verifique as mensagens de debug

## ✨ Funcionalidades

- ✅ Sistema de autenticação completo
- ✅ LocalStorage para lembrar usuário
- ✅ Navegação entre páginas
- ✅ Gerenciamento de documentos
- ✅ Upload de arquivos
- ✅ Filtros e busca
- ✅ Sistema de notificações
- ✅ Gerenciamento de permissões
- ✅ Configurações personalizáveis

---

**© 2026 DocuTrade - Sistema de Gestão Inteligente de Documentos**
 

Email real com EmailJS (perfil.js)

solicitarCodigo() agora chama emailjs.send() de verdade. Para ativar, você precisa:

Criar conta gratuita em emailjs.com (200 emails/mês grátis)
Adicionar um serviço de e-mail (Gmail, Outlook, etc.) → copie o Service ID
Criar um template com estas variáveis:

Para: {{to_email}}

Olá, {{to_name}}!

Seu código de verificação é: {{codigo}}

Válido por 10 minutos.
Copiar o Template ID e o Public Key (Account → API Keys)
Substituir no topo de perfil.js:

const EMAILJS_PUBLIC_KEY  = 'SEU_PUBLIC_KEY';
const EMAILJS_SERVICE_ID  = 'SEU_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'SEU_TEMPLATE_ID';