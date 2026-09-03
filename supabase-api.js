// ========================================
// CONFIGURAÇÃO DO SUPABASE
// ========================================

const SUPABASE_URL = 'https://mvgbgjqkxsptbndgoskw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Z2JnanFreHNwdGJuZGdvc2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTgxNTcsImV4cCI6MjA4ODQ5NDE1N30.MSBVWGwpdlYeSKoLL64It5BGWatxoU9uuW6FypgN628';

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
    console.error('[Supabase] FALHA ao criar cliente:', err);
}

// ========================================
// HASH DE SENHA (bcrypt, client-side)
// ========================================
// Antes desta migração, senha_hash guardava a senha em texto puro (nome
// enganoso). Como a policy de RLS de `usuarios` libera leitura pra `anon`
// (chave pública, embutida no próprio JS), qualquer um conseguia ler a
// senha de qualquer usuário direto pela API REST — daí a urgência de
// nunca mais gravar/comparar em texto puro. Isso não resolve o problema de
// fundo (RLS/autenticação real ainda dependem de uma migração maior pra
// Supabase Auth), mas fecha o vazamento mais grave sem quebrar ninguém.

function _hashSenha(senha) {
    return dcodeIO.bcrypt.hashSync(senha, 10);
}

// Compatibilidade com contas que ainda têm a senha em texto puro (de antes
// desta migração): se o valor salvo não tem cara de hash bcrypt, compara
// direto. loginSupabase() re-hasheia automaticamente assim que reconhece
// esse caso, então cada conta migra sozinha no próximo login bem-sucedido.
function _senhaCorreta(senha, hashSalvo) {
    if (!hashSalvo) return false;
    if (!/^\$2[aby]\$/.test(hashSalvo)) return hashSalvo === senha;
    return dcodeIO.bcrypt.compareSync(senha, hashSalvo);
}

// ========================================
// LOGIN
// ========================================
// Estágio 2.2 da migração de autenticação (ver auditoria de segurança).
// Antes, esta função buscava o usuário por CPF direto com a chave `anon` —
// e essa consulta é exatamente o que travava a RLS real: pra remover o
// `anon` de `usuarios` (pré-requisito de auth.uid()), o login não pode mais
// depender dele. Agora todo o trabalho (achar por CPF, checar ativo/
// bloqueio, comparar senha, contar tentativas, linkar no Supabase Auth) foi
// pra dentro da Edge Function `login-usuario`, que roda com service_role
// (ignora RLS). De quebra, fecha outra falha da auditoria: o bloqueio por
// tentativas antes era só client-side (dava pra ignorar batendo direto na
// API REST) — agora é aplicado no servidor, sem como pular.
const LOGIN_ENDPOINT = `${SUPABASE_URL}/functions/v1/login-usuario`;

async function loginSupabase(cpf, senha) {
    try {
        const res = await fetch(LOGIN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, senha }),
        });
        const resultado = await res.json();
        if (!resultado.sucesso) return resultado;

        // A função já garantiu que a conta está criada/atualizada no
        // Supabase Auth — aqui só estabelece a sessão real (JWT) neste
        // navegador, via endpoint público (não precisa de service_role).
        if (resultado.usuario?.email) {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email: resultado.usuario.email,
                password: senha,
            });
            if (error) console.warn('[Auth real] signInWithPassword falhou:', error.message);
        }

        return resultado;
    } catch (err) {
        console.error('Erro no login:', err);
        return { sucesso: false, mensagem: 'Erro ao processar login. Tente novamente.' };
    }
}

// ========================================
// CADASTRO
// ========================================

function gerarChaveEmpresa() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}-${seg()}`;
}

// Estágio 2.2 da migração de autenticação (ver auditoria de segurança).
// Mesmo motivo do login: essa função criava empresa/usuário/solicitação
// direto com a chave `anon` (sem sessão ainda, é a própria conta sendo
// criada). Movida pra dentro da Edge Function `cadastro-usuario`, que roda
// com service_role — réplica fiel da lógica que estava aqui.
const CADASTRO_ENDPOINT = `${SUPABASE_URL}/functions/v1/cadastro-usuario`;

async function cadastrarContaSupabase(dados) {
    try {
        const res = await fetch(CADASTRO_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados),
        });
        return await res.json();
    } catch (err) {
        console.error('[Supabase] Erro ao cadastrar:', err);
        return { sucesso: false, mensagem: 'Erro ao processar cadastro: ' + err.message };
    }
}

// ========================================
// SOLICITAÇÕES DE EMPRESA
// ========================================

async function buscarSolicitacoesPendentes() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario || !usuario.empresa_id) return { sucesso: true, data: [] };

        const { data, error } = await supabaseClient
            .from('solicitacoes_empresa')
            .select('id, nome_usuario, email_usuario, criado_em')
            .eq('empresa_id', usuario.empresa_id)
            .eq('status', 'pendente')
            .order('criado_em', { ascending: false });

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// Estágio 2.2 (ver auditoria de segurança): aprovar uma solicitação exige
// mudar usuarios.empresa_id de OUTRA pessoa pra uma empresa que ainda não
// é a dela — a RLS normal de `usuarios` não permite essa transição (só
// deixa um admin atualizar quem já é da empresa dele). Movido pra Edge
// Function `responder-solicitacao`, que roda com service_role mas exige
// JWT válido (deploy sem --no-verify-jwt) e confere admin por dentro.
const RESPONDER_SOLICITACAO_ENDPOINT = `${SUPABASE_URL}/functions/v1/responder-solicitacao`;

async function responderSolicitacao(solicitacaoId, aprovado) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return { sucesso: false, mensagem: 'Não autenticado' };

        const res = await fetch(RESPONDER_SOLICITACAO_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ solicitacao_id: solicitacaoId, aprovado }),
        });
        return await res.json();
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// Usada na tela de Perfil por contas sandbox (sem empresa vinculada) pra
// pedir entrada numa empresa existente — mesmo fluxo de aprovação pendente
// do cadastro (não altera usuarios.empresa_id na hora; só responderSolicitacao,
// quando aprovado, faz isso).
async function solicitarEntradaEmpresa(chaveEmpresa) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { data: empresaEncontrada } = await supabaseClient
            .from('empresas')
            .select('id, razao_social')
            .eq('chave_empresa', (chaveEmpresa || '').toUpperCase())
            .maybeSingle();

        if (!empresaEncontrada) {
            return { sucesso: false, mensagem: 'Chave de empresa não encontrada.' };
        }

        const { data: solExistente } = await supabaseClient
            .from('solicitacoes_empresa')
            .select('id')
            .eq('usuario_id', usuario.id)
            .eq('empresa_id', empresaEncontrada.id)
            .eq('status', 'pendente')
            .maybeSingle();

        if (solExistente) {
            return { sucesso: false, mensagem: `Você já tem uma solicitação pendente para "${empresaEncontrada.razao_social}".` };
        }

        const { error: erroSol } = await supabaseClient
            .from('solicitacoes_empresa')
            .insert({
                usuario_id: usuario.id,
                empresa_id: empresaEncontrada.id,
                nome_usuario: usuario.nome,
                email_usuario: usuario.email
            });

        if (erroSol) return { sucesso: false, mensagem: 'Erro ao enviar solicitação: ' + erroSol.message };

        await supabaseClient.rpc('notificar_admin_email', {
            p_empresa_id: empresaEncontrada.id,
            p_nome_usuario: usuario.nome,
            p_email_usuario: usuario.email
        }).catch(() => {});

        return { sucesso: true, mensagem: `Solicitação enviada para "${empresaEncontrada.razao_social}". Aguarde a aprovação do responsável.` };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// ========================================
// EMPRESAS CADASTRADAS
// ========================================

async function salvarEmpresaCadastrada(dadosEmpresa) {
    try {
        const usuarioLogado = obterUsuarioLogado();
        if (!usuarioLogado) return { sucesso: false, mensagem: 'Usuário não autenticado' };

        // 1. Inserir na tabela principal
        const { data: parceiro, error: errParceiro } = await supabaseClient
            .from('parceiros')
            .insert({
                created_by:           usuarioLogado.id,
                empresa_id:           usuarioLogado.empresa_id || null,
                is_fabricante:        dadosEmpresa.tipos.includes('fabricante'),
                is_cliente:           dadosEmpresa.tipos.includes('cliente'),
                is_fornecedor:        dadosEmpresa.tipos.includes('fornecedor'),
                is_transportadora:    dadosEmpresa.tipos.includes('transportadora'),
                is_remetente:         dadosEmpresa.tipos.includes('remetente'),
                is_comprador:         dadosEmpresa.tipos.includes('comprador'),
                is_importador:        dadosEmpresa.tipos.includes('importador'),
                modelo:               dadosEmpresa.modelo || 'empresa',
                tipo_cadastro:        dadosEmpresa.tipo_cadastro,
                documento:            dadosEmpresa.documento.replace(/\D/g, ''),
                razao_social:         dadosEmpresa.razao_social,
                nome_fantasia:        dadosEmpresa.nome_fantasia        || null,
                inscricao_estadual:   dadosEmpresa.inscricao_estadual   || null,
                suframa:              dadosEmpresa.suframa               || null,
                pais:                 dadosEmpresa.pais,
                cep:                  dadosEmpresa.cep ? dadosEmpresa.cep.replace(/\D/g, '') : null,
                estado:               dadosEmpresa.estado      || null,
                cidade:               dadosEmpresa.cidade      || null,
                endereco:             dadosEmpresa.endereco    || null,
                numero:               dadosEmpresa.numero      || null,
                complemento:          dadosEmpresa.complemento || null,
                site:                 dadosEmpresa.site                 || null,
                horario_atendimento:  dadosEmpresa.horario_atendimento  || null,
                tags:                 dadosEmpresa.tags || [],
            })
            .select('id')
            .single();

        if (errParceiro) {
            console.error('Erro ao salvar parceiro:', errParceiro);
            if (errParceiro.code === '23505') {
                return { sucesso: false, mensagem: 'Já existe uma empresa cadastrada com este número de identificação (CNPJ/CPF).' };
            }
            return { sucesso: false, mensagem: 'Erro ao salvar cadastro: ' + errParceiro.message };
        }

        const parceiroId = parceiro.id;

        // 2. Inserir contatos
        const contatos = (dadosEmpresa.contatos || []).filter(c => c.tipo || c.nome || c.email || c.telefone);
        if (contatos.length > 0) {
            const rows = contatos.map((c, i) => ({
                parceiro_id: parceiroId,
                tipo:        c.tipo     || 'Geral',
                nome:        c.nome     || null,
                email:       c.email    || null,
                telefone:    c.telefone || null,
                ordem:       i + 1,
            }));
            const { error: errC } = await supabaseClient.from('parceiro_contatos').insert(rows);
            if (errC) console.error('Erro ao salvar contatos:', errC);
        }

        // 3. Inserir dados financeiros
        const fin = dadosEmpresa.financeiro || {};
        if (Object.values(fin).some(v => v)) {
            const { error: errF } = await supabaseClient.from('parceiro_financeiro').insert({
                parceiro_id:    parceiroId,
                pag_forma:      fin.pag_forma      || null,
                pag_condicao:   fin.pag_condicao   || null,
                pag_banco:      fin.pag_banco      || null,
                pag_tipo_conta: fin.pag_tipo_conta || null,
                pag_agencia:    fin.pag_agencia    || null,
                pag_conta:      fin.pag_conta      || null,
                rec_forma:      fin.rec_forma      || null,
                rec_moeda:      fin.rec_moeda      || null,
                rec_banco:      fin.rec_banco      || null,
                rec_tipo_conta: fin.rec_tipo_conta || null,
                rec_agencia:    fin.rec_agencia    || null,
                rec_conta:      fin.rec_conta      || null,
            });
            if (errF) console.error('Erro ao salvar financeiro:', errF);
        }

        return { sucesso: true, mensagem: 'Empresa cadastrada com sucesso!', data: parceiro };

    } catch (err) {
        console.error(err);
        return { sucesso: false, mensagem: 'Erro ao processar cadastro' };
    }
}

async function buscarEmpresasCadastradas() {
    try {
        const usuarioLogado = obterUsuarioLogado();
        if (!usuarioLogado) return { sucesso: false, mensagem: 'Usuário não autenticado' };

        // Filtra por empresa_id (toda a equipe vê) ou fallback por created_by
        let query = supabaseClient
            .from('vw_parceiros_completo')
            .select('*')
            .order('created_at', { ascending: false });

        if (usuarioLogado.empresa_id) {
            query = query.eq('empresa_id', usuarioLogado.empresa_id);
        } else {
            query = query.eq('created_by', usuarioLogado.id);
        }

        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: 'Erro ao buscar cadastros' };
        return { sucesso: true, data: data || [] };

    } catch (err) {
        return { sucesso: false, mensagem: 'Erro ao buscar cadastros' };
    }
}

async function buscarEmpresaPorId(id) {
    try {
        const { data, error } = await supabaseClient
            .from('vw_parceiros_completo')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return { sucesso: false, mensagem: 'Empresa não encontrada' };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: 'Erro ao buscar empresa' };
    }
}

async function editarEmpresaCadastrada(id, dadosEmpresa) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        // 1. Atualizar tabela principal
        let updateQuery = supabaseClient
            .from('parceiros')
            .update({
                is_fabricante:        dadosEmpresa.tipos.includes('fabricante'),
                is_cliente:           dadosEmpresa.tipos.includes('cliente'),
                is_fornecedor:        dadosEmpresa.tipos.includes('fornecedor'),
                is_transportadora:    dadosEmpresa.tipos.includes('transportadora'),
                is_remetente:         dadosEmpresa.tipos.includes('remetente'),
                is_comprador:         dadosEmpresa.tipos.includes('comprador'),
                is_importador:        dadosEmpresa.tipos.includes('importador'),
                modelo:               dadosEmpresa.modelo || 'empresa',
                tipo_cadastro:        dadosEmpresa.tipo_cadastro,
                documento:            dadosEmpresa.documento.replace(/\D/g, ''),
                razao_social:         dadosEmpresa.razao_social,
                nome_fantasia:        dadosEmpresa.nome_fantasia       || null,
                inscricao_estadual:   dadosEmpresa.inscricao_estadual  || null,
                suframa:              dadosEmpresa.suframa              || null,
                pais:                 dadosEmpresa.pais,
                cep:                  dadosEmpresa.cep ? dadosEmpresa.cep.replace(/\D/g, '') : null,
                estado:               dadosEmpresa.estado      || null,
                cidade:               dadosEmpresa.cidade      || null,
                endereco:             dadosEmpresa.endereco    || null,
                numero:               dadosEmpresa.numero      || null,
                complemento:          dadosEmpresa.complemento || null,
                site:                 dadosEmpresa.site                || null,
                horario_atendimento:  dadosEmpresa.horario_atendimento || null,
                tags:                 dadosEmpresa.tags || [],
            })
            .eq('id', id);

        updateQuery = usuario.empresa_id
            ? updateQuery.eq('empresa_id', usuario.empresa_id)
            : updateQuery.eq('created_by', usuario.id);

        const { error: errParceiro } = await updateQuery;

        if (errParceiro) return { sucesso: false, mensagem: 'Erro ao atualizar: ' + errParceiro.message };

        // 2. Substituir contatos (delete + insert)
        await supabaseClient.from('parceiro_contatos').delete().eq('parceiro_id', id);
        const contatos = (dadosEmpresa.contatos || []).filter(c => c.tipo || c.nome || c.email || c.telefone);
        if (contatos.length > 0) {
            const rows = contatos.map((c, i) => ({
                parceiro_id: id,
                tipo:        c.tipo     || 'Geral',
                nome:        c.nome     || null,
                email:       c.email    || null,
                telefone:    c.telefone || null,
                ordem:       i + 1,
            }));
            await supabaseClient.from('parceiro_contatos').insert(rows);
        }

        // 3. Upsert financeiro
        const fin = dadosEmpresa.financeiro || {};
        await supabaseClient.from('parceiro_financeiro').upsert({
            parceiro_id:    id,
            pag_forma:      fin.pag_forma      || null,
            pag_condicao:   fin.pag_condicao   || null,
            pag_banco:      fin.pag_banco      || null,
            pag_tipo_conta: fin.pag_tipo_conta || null,
            pag_agencia:    fin.pag_agencia    || null,
            pag_conta:      fin.pag_conta      || null,
            rec_forma:      fin.rec_forma      || null,
            rec_moeda:      fin.rec_moeda      || null,
            rec_banco:      fin.rec_banco      || null,
            rec_tipo_conta: fin.rec_tipo_conta || null,
            rec_agencia:    fin.rec_agencia    || null,
            rec_conta:      fin.rec_conta      || null,
        }, { onConflict: 'parceiro_id' });

        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: 'Erro ao processar atualização' };
    }
}

async function excluirEmpresaCadastrada(id) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        let query = supabaseClient.from('parceiros').delete().eq('id', id);
        query = usuario.empresa_id
            ? query.eq('empresa_id', usuario.empresa_id)
            : query.eq('created_by', usuario.id);

        const { error } = await query;

        if (error) return { sucesso: false, mensagem: 'Erro ao excluir: ' + error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: 'Erro ao processar exclusão' };
    }
}

// ========================================
// UTILITÁRIOS
// ========================================

function obterUsuarioLogado() {
    const str = sessionStorage.getItem('usuarioLogado');
    return str ? JSON.parse(str) : null;
}

// Reconsulta os dados do usuário logado direto do banco (nome, avatar, cargo,
// empresa) e atualiza sessionStorage/localStorage. Necessário porque o
// auto-login via "Lembrar-me" (ver auth.js) só reaproveita o snapshot salvo
// no momento do login manual original — sem isso, mudanças feitas depois
// (outro dispositivo, edição pelo admin, troca de avatar) nunca apareciam
// pra quem entra via sessão lembrada.
async function atualizarUsuarioLogado() {
    try {
        const atual = obterUsuarioLogado();
        if (!atual?.id) return null;

        const { data: usuario, error } = await supabaseClient
            .from('usuarios')
            .select('id, cpf, nome_completo, email, perfil, ativo, empresa_id, avatar_url, empresas(razao_social, status, expira_em)')
            .eq('id', atual.id)
            .single();
        if (error || !usuario) return null;

        if (!usuario.ativo) {
            // Usuário foi desativado nesse meio tempo — encerra a sessão.
            sessionStorage.removeItem('usuarioLogado');
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('usuarioSalvo');
            window.location.href = 'login.html';
            return null;
        }

        const atualizado = {
            id:         usuario.id,
            cpf:        usuario.cpf,
            nome:       usuario.nome_completo,
            email:      usuario.email,
            perfil:     usuario.perfil,
            empresa:    usuario.empresas?.razao_social || '',
            empresa_id: usuario.empresa_id,
            empresa_status:    usuario.empresas?.status || null,
            empresa_expira_em: usuario.empresas?.expira_em || null,
            avatar_url: usuario.avatar_url || null,
        };

        sessionStorage.setItem('usuarioLogado', JSON.stringify(atualizado));
        if (localStorage.getItem('rememberMe') === 'true' && localStorage.getItem('usuarioSalvo')) {
            localStorage.setItem('usuarioSalvo', JSON.stringify(atualizado));
        }
        return atualizado;
    } catch (err) { return null; }
}

// ========================================
// USUÁRIOS E PERMISSÕES
// ========================================

async function buscarUsuariosDaEmpresa() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario || !usuario.empresa_id) return { sucesso: false, mensagem: 'Sem empresa vinculada', data: [] };
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('id, nome_completo, cpf, email, perfil, ativo, ultimo_login, criado_em, cargo, permissoes')
            .eq('empresa_id', usuario.empresa_id)
            .order('criado_em', { ascending: true });
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) {
        return { sucesso: false, mensagem: err.message, data: [] };
    }
}

// SQL para adicionar a coluna de permissões (executar uma vez no Supabase):
//
// ALTER TABLE usuarios
//     ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{}'::jsonb;
//
// Estrutura esperada:
// { "operacional": true, "comercial": false, "financeiro": true }

async function atualizarPermissoesUsuario(id, permissoes) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };
        const { error } = await supabaseClient
            .from('usuarios')
            .update({ permissoes })
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function atualizarDadosPessoais(id, dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const campos = {};
        if (dados.nome_completo !== undefined) campos.nome_completo = dados.nome_completo;
        if (dados.email !== undefined) campos.email = dados.email;
        if (dados.cargo !== undefined) campos.cargo = dados.cargo;
        if (dados.telefone !== undefined) campos.telefone = dados.telefone;
        if (dados.avatar_url !== undefined) campos.avatar_url = dados.avatar_url;

        const { error } = await supabaseClient
            .from('usuarios')
            .update(campos)
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };

        // Atualizar sessão
        const usuarioAtual = obterUsuarioLogado();
        if (usuarioAtual) {
            const atualizado = { ...usuarioAtual, ...campos };
            sessionStorage.setItem('usuarioLogado', JSON.stringify(atualizado));
        }
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function redefinirSenha(id, novaSenha) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('usuarios')
            .update({ senha_hash: _hashSenha(novaSenha) })
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function atualizarPerfilUsuario(id, perfil) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('usuarios')
            .update({ perfil })
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function ativarDesativarUsuario(id, ativo) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('usuarios')
            .update({ ativo })
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function buscarDadosPerfilCompleto() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.id) return { sucesso: false };

        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('id, cpf, nome_completo, email, perfil, ativo, cargo, telefone, avatar_url, ultimo_login, criado_em, empresa_id, empresas(id, razao_social, nome_fantasia, cnpj, ie, im, suframa, cep, estado, cidade, endereco, numero, complemento, status, expira_em)')
            .eq('id', usuario.id)
            .single();

        if (error) return { sucesso: false };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false };
    }
}

async function buscarDadosPlano() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.empresa_id) return { sucesso: false };

        const [{ data: empresa, error }, { count: totalAtivos }, { count: totalUsuarios }] = await Promise.all([
            supabaseClient
                .from('empresas')
                .select('razao_social, plano')
                .eq('id', usuario.empresa_id)
                .single(),
            supabaseClient
                .from('usuarios')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', usuario.empresa_id)
                .eq('ativo', true),
            supabaseClient
                .from('usuarios')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', usuario.empresa_id)
        ]);

        if (error) return { sucesso: false };
        return {
            sucesso: true,
            data: {
                razao_social: empresa.razao_social,
                plano: empresa.plano || 'basico',
                usuarios_ativos: totalAtivos || 0,
                total_usuarios: totalUsuarios || 0
            }
        };
    } catch (err) {
        return { sucesso: false };
    }
}

async function criarSubUsuario(dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario || !usuario.empresa_id) return { sucesso: false, mensagem: 'Sem empresa vinculada.' };

        // Verificar CPF duplicado
        const { data: cpfExistente } = await supabaseClient
            .from('usuarios')
            .select('cpf')
            .eq('cpf', dados.cpf)
            .maybeSingle();

        if (cpfExistente) return { sucesso: false, mensagem: 'Este CPF já está cadastrado.' };

        // Verificar e-mail duplicado
        const { data: emailExistente } = await supabaseClient
            .from('usuarios')
            .select('email')
            .eq('email', dados.email)
            .maybeSingle();

        if (emailExistente) return { sucesso: false, mensagem: 'Este e-mail já está cadastrado.' };

        const novoUsuario = {
            nome_completo: dados.nome,
            cpf: dados.cpf,
            email: dados.email,
            senha_hash: _hashSenha(dados.senha),
            perfil: dados.perfil || 'usuario',
            ativo: true,
            empresa_id: usuario.empresa_id
        };
        if (dados.dataNasc) novoUsuario.data_nascimento = dados.dataNasc;

        const { data, error } = await supabaseClient
            .from('usuarios')
            .insert(novoUsuario)
            .select()
            .single();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function buscarChaveEmpresa() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario || !usuario.empresa_id) return { sucesso: false };
        const { data, error } = await supabaseClient
            .from('empresas')
            .select('chave_empresa, razao_social')
            .eq('id', usuario.empresa_id)
            .single();
        if (error) return { sucesso: false };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false };
    }
}

// ========================================
// PROCESSOS
// ========================================

async function buscarProcessos(filtros = {}) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario || !usuario.empresa_id) return { sucesso: false, data: [] };

        let query = supabaseClient
            .from('processos')
            .select('*')
            .eq('empresa_proprietaria_id', usuario.empresa_id)
            .neq('status', 'excluido')
            .order('criado_em', { ascending: false });

        if (filtros.tipo)   query = query.eq('tipo', filtros.tipo);
        if (filtros.status) query = query.eq('status', filtros.status);
        // Filtro de período (revisão de performance) — só se aplica a
        // processos já encerrados; um em andamento continua sempre visível,
        // não importa a data, senão sumiria algo que ainda precisa de ação.
        if (filtros.diasAtras) {
            const desde = new Date(Date.now() - filtros.diasAtras * 86400000).toISOString();
            query = query.or(`status.not.in.(concluido,encerrada,cancelado),criado_em.gte.${desde}`);
        }

        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) {
        return { sucesso: false, mensagem: err.message, data: [] };
    }
}

async function buscarProcessoPorId(id) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { data, error } = await supabaseClient
            .from('processos')
            .select('*')
            .eq('id', id)
            .eq('empresa_proprietaria_id', usuario.empresa_id)
            .single();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function _gerarNumeroProcesso(empresaId) {
    const ano     = new Date().getFullYear();
    const pattern = `PROC${ano}%`;

    const { data } = await supabaseClient
        .from('processos')
        .select('numero_processo')
        .eq('empresa_proprietaria_id', empresaId)
        .like('numero_processo', pattern)
        .order('numero_processo', { ascending: false })
        .limit(1);

    let seq = 1;
    if (data && data.length > 0) {
        const ultimo = data[0].numero_processo;
        const num    = parseInt(ultimo?.slice(`PROC${ano}`.length), 10);
        if (!isNaN(num)) seq = num + 1;
    }

    return `PROC${ano}${String(seq).padStart(6, '0')}`;
}

// Monta o payload completo do processo a partir de `dados` (saída de
// _coletarDadosProcesso em formularios.js). Usado tanto no insert quanto no
// update vindos do formulário, para que nenhum campo se perca ao salvar.
function _payloadProcesso(dados) {
    return {
        proforma_id:            dados.proforma_id || null,
        pedido_id:               dados.pedido_id || null,
        tipo:                    dados.tipo || null,
        proposito:               dados.proposito || null,
        emissor_tipo:            dados.emissor_tipo || 'usuario',
        documento_tipo:          dados.documento_tipo || null,
        documento:               dados.documento || null,
        remetente_parceiro_id:   dados.remetente_parceiro_id || null,
        status:                  dados.status || 'aberto',
        empresa_parceira_id:     dados.empresa_parceira_id || null,
        modal:                   dados.modal || null,
        moeda:                   dados.moeda || 'USD',
        valor_total:             dados.valor_total || null,
        incoterm:                dados.incoterm || null,
        pais_origem:             dados.pais_origem || null,
        origem_pais_codigo:      dados.origem_pais_codigo || null,
        pais_destino:            dados.pais_destino || null,
        destino_pais_codigo:     dados.destino_pais_codigo || null,
        navio:                   dados.navio || null,
        aeronave:                dados.aeronave || null,
        porto_origem:            dados.porto_origem || null,
        porto_destino:           dados.porto_destino || null,
        aeroporto_origem:        dados.aeroporto_origem || null,
        aeroporto_destino:       dados.aeroporto_destino || null,
        fronteira_saida:         dados.fronteira_saida || null,
        fronteira_entrada:       dados.fronteira_entrada || null,
        container_tipo:          dados.container_tipo || null,
        container_numero:        dados.container_numero || null,
        origem_endereco:         dados.origem_endereco || {},
        origem_coleta:           dados.origem_coleta || {},
        destino_endereco:        dados.destino_endereco || {},
        destino_responsavel:     dados.destino_responsavel || {},
        rota_intermediarios:     dados.rota_intermediarios || [],
        data_abertura:           dados.data_abertura || null,
        data_previsao:           dados.data_previsao || null,
        data_embarque:           dados.data_embarque || null,
        data_chegada:            dados.data_chegada || null,
        data_cancelamento:       dados.data_cancelamento || null,
        obs_prazos:              dados.obs_prazos || null,
        observacoes:             dados.observacoes || null,
        etapas:                  dados.etapas || [],
        documentos:              dados.documentos || {},
        transporte:              dados.transporte || {},
    };
}

async function salvarProcesso(dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const numero_processo = await _gerarNumeroProcesso(usuario.empresa_id);

        const { data, error } = await supabaseClient
            .from('processos')
            .insert({
                ..._payloadProcesso(dados),
                numero_processo:         numero_processo,
                empresa_proprietaria_id: usuario.empresa_id,
                data_abertura:           dados.data_abertura || new Date().toISOString().split('T')[0],
            })
            .select()
            .single();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function atualizarProcesso(id, dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        // Atualizações parciais (ex: só o status, vindas do kanban) não devem
        // sobrescrever o resto dos campos com null — o payload completo só é
        // montado quando `dados` vem do formulário (_coletarDadosProcesso
        // sempre inclui a chave `tipo`, mesmo que vazia).
        const payload = ('tipo' in dados) ? _payloadProcesso(dados) : dados;

        const { error } = await supabaseClient
            .from('processos')
            .update({ ...payload, atualizado_em: new Date().toISOString() })
            .eq('id', id)
            .eq('empresa_proprietaria_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function excluirProcesso(id) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('processos')
            .delete()
            .eq('id', id)
            .eq('empresa_proprietaria_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// ========================================
// PRODUTOS
// ========================================

async function buscarProdutos(apenasAtivos = false) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario || !usuario.empresa_id) return { sucesso: false, data: [] };

        let query = supabaseClient
            .from('produtos')
            .select('*')
            .eq('empresa_id', usuario.empresa_id)
            .order('nome', { ascending: true });

        if (apenasAtivos) query = query.eq('status', 'ativo');

        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) {
        return { sucesso: false, mensagem: err.message, data: [] };
    }
}

// Payload compartilhado entre criar/editar — mapeia 1:1 com as colunas reais
// de produtos (ver database/database-produtos-completo.sql). idiomas/embalagens/
// documentos chegam prontos como array (montados em _coletarDadosProduto()).
function _prodMontarPayload(dados) {
    return {
        sku:                     dados.sku,
        nome:                    dados.nome,
        status:                  dados.status || 'ativo',
        ncm:                     dados.ncm || null,
        cest:                    dados.cest || null,
        gtin:                    dados.gtin || null,
        hscode:                  dados.hscode || null,
        naladi_nesh:             dados.naladi_nesh || null,
        dun14:                   dados.dun14 || null,
        ncm_utrib:               dados.ncm_utrib || null,
        ncm_descricao:           dados.ncm_descricao || null,
        ncm_descricao_completa:  dados.ncm_descricao_completa || null,
        imagem_url:              dados.imagem_url || null,
        descricao:               dados.descricao || null,
        categoria:               dados.categoria || null,
        tipo:                    dados.tipo || null,
        marca:                   dados.marca || null,
        unidade_medida:          dados.unidade_medida || null,
        lote:                    dados.lote || null,
        data_fabricacao:         dados.data_fabricacao || null,
        data_validade:           dados.data_validade || null,
        referencia_interna:      dados.referencia_interna || null,
        referencia_fornecedor:   dados.referencia_fornecedor || null,
        referencia_outra:        dados.referencia_outra || null,
        empresa_parceira_id:     dados.empresa_parceira_id || null,
        preco_custo:             dados.preco_custo || null,
        custos_fixos:            dados.custos_fixos || null,
        imposto:                 dados.imposto || null,
        preco_venda:             dados.preco_venda || null,
        margem:                  dados.margem || null,
        lucro_liquido:           dados.lucro_liquido || null,
        moeda:                   dados.moeda || null,
        obs_preco:               dados.obs_preco || null,
        controla_estoque:        dados.controla_estoque !== false,
        venda_sem_estoque:       !!dados.venda_sem_estoque,
        estoque_atual:           dados.estoque_atual || null,
        estoque_minimo:          dados.estoque_minimo || null,
        estoque_maximo:          dados.estoque_maximo || null,
        obs_estoque:             dados.obs_estoque || null,
        obs_logistica:           dados.obs_logistica || null,
        nomes_idiomas:           dados.nomes_idiomas || [],
        precos_alternativos:     dados.precos_alternativos || [],
        embalagens:              dados.embalagens || [],
        documentos:              dados.documentos || [],
    };
}

async function salvarProduto(dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { data, error } = await supabaseClient
            .from('produtos')
            .insert({
                ..._prodMontarPayload(dados),
                empresa_id: usuario.empresa_id,
                criado_por: usuario.id,
            })
            .select()
            .single();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// Upload de Excel/PDF (produtos.js, _prodUploadImportarLote): insere em
// blocos em vez de 1 produto por vez — planilha de 200 linhas virava ~200
// round-trips sequenciais (achado na revisão de performance). Em blocos
// (não tudo de uma vez): se uma linha violar uma constraint (SKU
// duplicado, por ex.), só o bloco dela falha — as outras linhas continuam
// indo normalmente, mais perto do comportamento "linha por linha" de antes
// do que um insert único all-or-nothing pra planilha inteira.
async function salvarProdutosEmLote(produtosArray, tamanhoBloco = 40) {
    const usuario = obterUsuarioLogado();
    if (!usuario) return { sucesso: false, mensagem: 'Não autenticado', totalSucesso: 0, totalFalha: produtosArray.length, falhas: [] };

    let totalSucesso = 0;
    const falhas = [];

    for (let i = 0; i < produtosArray.length; i += tamanhoBloco) {
        const bloco = produtosArray.slice(i, i + tamanhoBloco);
        const rows = bloco.map(p => ({
            ..._prodMontarPayload(p),
            empresa_id: usuario.empresa_id,
            criado_por: usuario.id,
        }));

        const { data, error } = await supabaseClient.from('produtos').insert(rows).select('id, sku');
        if (error) {
            falhas.push({ skus: bloco.map(p => p.sku), mensagem: error.message });
        } else {
            totalSucesso += data?.length || rows.length;
        }
    }

    const totalFalha = produtosArray.length - totalSucesso;
    return { sucesso: totalSucesso > 0, totalSucesso, totalFalha, falhas };
}

// Atualiza só preco_venda ou preco_custo (+ moeda, se informada) de produtos
// JÁ CADASTRADOS, localizados pelo SKU — planilha à parte da de cadastro
// completo (ver produtos.js: processarUploadPreco). SKU é a referência
// porque já é único por empresa; HS Code nessa planilha é só exibição.
async function atualizarPrecosEmLote(campoPreco, linhas) {
    const usuario = obterUsuarioLogado();
    if (!usuario) return { sucesso: false, totalSucesso: 0, totalFalha: linhas.length, skusNaoEncontrados: linhas.map(l => l.sku) };

    const { data: produtos } = await supabaseClient
        .from('produtos')
        .select('id, sku')
        .eq('empresa_id', usuario.empresa_id)
        .in('sku', linhas.map(l => l.sku));

    const idPorSku = {};
    (produtos || []).forEach(p => { idPorSku[p.sku] = p.id; });

    let totalSucesso = 0;
    const skusNaoEncontrados = [];

    for (const linha of linhas) {
        const id = idPorSku[linha.sku];
        if (!id) { skusNaoEncontrados.push(linha.sku); continue; }

        const payload = { [campoPreco]: linha.preco, atualizado_em: new Date().toISOString() };
        if (linha.moeda) payload.moeda = linha.moeda;

        const { error } = await supabaseClient.from('produtos').update(payload).eq('id', id);
        if (error) skusNaoEncontrados.push(linha.sku);
        else totalSucesso++;
    }

    return { sucesso: totalSucesso > 0, totalSucesso, totalFalha: linhas.length - totalSucesso, skusNaoEncontrados };
}

async function editarProduto(id, dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('produtos')
            .update({ ..._prodMontarPayload(dados), atualizado_em: new Date().toISOString() })
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function buscarProdutoPorId(id) {
    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return { sucesso: false, mensagem: error.message, data: null };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message, data: null };
    }
}

async function excluirProduto(id) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('produtos')
            .delete()
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// ========================================
// EMPRESA TENANT — ATUALIZAR DADOS
// ========================================

async function atualizarTenantEmpresa(dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.empresa_id) return { sucesso: false, mensagem: 'Sem empresa vinculada' };

        // Só inclui campos explicitamente presentes em dados (evita sobrescrever com null)
        const campos = ['razao_social','nome_fantasia','cnpj','ie','im','suframa',
                        'cep','estado','cidade','endereco','numero','complemento'];
        const update = {};
        campos.forEach(c => { if (c in dados) update[c] = dados[c] ?? null; });

        const { error } = await supabaseClient
            .from('empresas')
            .update(update)
            .eq('id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// Usada na tela de Perfil por contas sandbox (sem empresa vinculada) pra
// cadastrar a própria empresa nova — acesso total imediato (diferente de
// solicitarEntradaEmpresa, que pede aprovação). A empresa sandbox anterior
// do usuário fica órfã (fora de escopo migrar/limpar).
async function registrarEmpresaPropria({ razaoSocial, cnpj }) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };
        if (!razaoSocial) return { sucesso: false, mensagem: 'Informe a Razão Social.' };

        const chaveGerada = gerarChaveEmpresa();
        const { data: empresaCriada, error: erroEmpresa } = await supabaseClient
            .from('empresas')
            .insert({
                razao_social: razaoSocial,
                nome_fantasia: razaoSocial,
                cnpj: cnpj || null,
                email: usuario.email,
                status: 'ativo',
                plano: 'free',
                chave_empresa: chaveGerada
            })
            .select()
            .single();

        if (erroEmpresa) return { sucesso: false, mensagem: 'Erro ao criar empresa: ' + erroEmpresa.message };

        const { error: erroUsuario } = await supabaseClient
            .from('usuarios')
            .update({ empresa_id: empresaCriada.id })
            .eq('id', usuario.id);

        if (erroUsuario) return { sucesso: false, mensagem: 'Erro ao vincular usuário à empresa: ' + erroUsuario.message };

        return { sucesso: true, chave_gerada: chaveGerada, data: empresaCriada };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function buscarTenantEmpresa() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.empresa_id) return { sucesso: false, mensagem: 'Usuário sem empresa_id na sessão.' };
        // ie/im/suframa/cep/estado/cidade/endereco/numero/complemento exigem
        // database/database-empresas-endereco.sql já rodado (ver project-sql-pendentes)
        // — sem isso essa consulta falha com 400 "column does not exist".
        const { data, error } = await supabaseClient
            .from('empresas')
            .select('id, razao_social, nome_fantasia, cnpj, ie, im, suframa, cep, estado, cidade, endereco, numero, complemento')
            .eq('id', usuario.empresa_id)
            .single();
        if (error) return { sucesso: false, mensagem: error.message, detalhes: error, empresaIdUsada: usuario.empresa_id };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// ========================================
// PROPOSTAS
// ========================================

async function contarPropostas() {
    try {
        const ano = new Date().getFullYear();
        const { count } = await supabaseClient
            .from('proformas')
            .select('*', { count: 'exact', head: true })
            .like('codigo', `PRO${ano}%`);
        return count || 0;
    } catch { return 0; }
}

async function salvarPropostaDB(dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        // Generate codigo server-side to avoid collisions from client-side caching
        const ano  = new Date().getFullYear();
        const cont = await contarPropostas();
        const codigo = `PRO${ano}${String(cont + 1).padStart(6, '0')}`;

        const { data, error } = await supabaseClient
            .from('proformas')
            .insert({
                codigo:              codigo,
                empresa_id:          usuario.empresa_id || null,
                criado_por:          usuario.id,
                idioma:              dados.idioma              || 'pt',
                idioma_outro:        dados.idioma_outro        || null,
                tipo:                dados.tipo                || null,
                proposito:           dados.proposito           || null,
                status:              'pendente',
                emissor_tipo:          dados.emissor_tipo          || 'usuario',
                parceiro_id:           dados.parceiro_id           || null,
                parceiro_razao_social: dados.parceiro_razao_social || null,
                documento:           dados.documento           || null,
                documento_tipo:      dados.documento_tipo      || null,
                modal:               dados.modal               || null,
                incoterm:            dados.incoterm            || null,
                origem_pais:         dados.origem_pais         || null,
                origem_pais_codigo:  dados.origem_pais_codigo  || null,
                destino_pais:        dados.destino_pais        || null,
                destino_pais_codigo: dados.destino_pais_codigo || null,
                porto_origem:        dados.porto_origem        || null,
                porto_destino:       dados.porto_destino       || null,
                aeroporto_origem:    dados.aeroporto_origem    || null,
                aeroporto_destino:   dados.aeroporto_destino   || null,
                fronteira_saida:     dados.fronteira_saida     || null,
                fronteira_entrada:   dados.fronteira_entrada   || null,
                forma_pagamento:     dados.forma_pagamento     || null,
                prazo_pagamento:     dados.prazo_pagamento     || null,
                condicoes_obs:       dados.condicoes_obs       || null,
                observacoes:         dados.observacoes         || null,
                data_emissao:        dados.data_emissao        || null,
                data_validade:       dados.data_validade       || null,
                itens:               dados.itens               || [],
                valor_total:         dados.valor_total         || 0,
                moeda_principal:     dados.moeda_principal     || 'USD',
                destinatario_id:         dados.destinatario_id         || null,
                destinatario_razao_social: dados.destinatario_razao_social || null,
                destinatario_doc:        dados.destinatario_doc         || null,
                destinatario_doc_tipo:   dados.destinatario_doc_tipo    || null,
                validade_dias:           dados.validade_dias            || null,
                obs_status:              dados.obs_status               || null,
                pedido_id:               dados.pedido_id                || null,
            })
            .select('*')
            .single();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function buscarProformaDB(id) {
    try {
        const { data, error } = await supabaseClient
            .from('proformas')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// Proforma→Processo é 1:1 — ao gerar o processo, a proforma sai do kanban de
// "aprovado" e vai pra "encerrado" (etapa "finalizado" foi removida do kanban)
// e não pode gerar outro processo.
async function marcarProformaFinalizadaDB(proformaId, processoId) {
    try {
        const { error } = await supabaseClient
            .from('proformas')
            .update({
                processo_gerado_id:   processoId,
                status:               'encerrado',
                status_atualizado_em: new Date().toISOString(),
            })
            .eq('id', proformaId);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function atualizarProformaDB(id, dados) {
    try {
        const { data, error } = await supabaseClient
            .from('proformas')
            .update({
                idioma:                   dados.idioma                   || 'pt',
                idioma_outro:             dados.idioma_outro             || null,
                tipo:                     dados.tipo                     || null,
                proposito:                dados.proposito                || null,
                emissor_tipo:             dados.emissor_tipo             || 'usuario',
                parceiro_id:              dados.parceiro_id              || null,
                parceiro_razao_social:    dados.parceiro_razao_social    || null,
                documento:                dados.documento                || null,
                documento_tipo:           dados.documento_tipo           || null,
                modal:                    dados.modal                    || null,
                incoterm:                 dados.incoterm                 || null,
                origem_pais:              dados.origem_pais              || null,
                origem_pais_codigo:       dados.origem_pais_codigo       || null,
                destino_pais:             dados.destino_pais             || null,
                destino_pais_codigo:      dados.destino_pais_codigo      || null,
                porto_origem:             dados.porto_origem             || null,
                porto_destino:            dados.porto_destino            || null,
                aeroporto_origem:         dados.aeroporto_origem         || null,
                aeroporto_destino:        dados.aeroporto_destino        || null,
                fronteira_saida:          dados.fronteira_saida          || null,
                fronteira_entrada:        dados.fronteira_entrada        || null,
                forma_pagamento:          dados.forma_pagamento          || null,
                prazo_pagamento:          dados.prazo_pagamento          || null,
                condicoes_obs:            dados.condicoes_obs            || null,
                observacoes:              dados.observacoes              || null,
                data_emissao:             dados.data_emissao             || null,
                data_validade:            dados.data_validade            || null,
                itens:                    dados.itens                    || [],
                valor_total:              dados.valor_total              || 0,
                moeda_principal:          dados.moeda_principal          || 'USD',
                destinatario_id:          dados.destinatario_id          || null,
                destinatario_razao_social: dados.destinatario_razao_social || null,
                destinatario_doc:         dados.destinatario_doc         || null,
                destinatario_doc_tipo:    dados.destinatario_doc_tipo    || null,
                validade_dias:            dados.validade_dias            || null,
                obs_status:               dados.obs_status               || null,
            })
            .eq('id', id)
            .select('*')
            .single();
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

// ========================================
// MÓDULO FINANCEIRO — CONTAS A PAGAR
// ========================================
//
// SQL para criar as tabelas no Supabase (executar uma vez):
//
// CREATE TABLE contas_pagar (
//     id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     empresa_id      UUID REFERENCES empresas(id),
//     descricao       TEXT NOT NULL,
//     parceiro_id     INTEGER REFERENCES parceiros(id),
//     valor           NUMERIC NOT NULL,
//     moeda           TEXT DEFAULT 'BRL',
//     data_vencimento DATE NOT NULL,
//     data_pagamento  DATE,
//     status          TEXT DEFAULT 'pendente'
//                         CHECK (status IN ('pendente','pago','vencido','cancelado')),
//     categoria       TEXT,
//     observacoes     TEXT,
//     criado_por      UUID,
//     criado_em       TIMESTAMPTZ DEFAULT NOW(),
//     atualizado_em   TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE contas_receber (
//     id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     empresa_id       UUID REFERENCES empresas(id),
//     descricao        TEXT NOT NULL,
//     parceiro_id      INTEGER REFERENCES parceiros(id),
//     valor            NUMERIC NOT NULL,
//     moeda            TEXT DEFAULT 'BRL',
//     data_vencimento  DATE NOT NULL,
//     data_recebimento DATE,
//     status           TEXT DEFAULT 'pendente'
//                          CHECK (status IN ('pendente','recebido','vencido','cancelado')),
//     categoria        TEXT,
//     observacoes      TEXT,
//     criado_por       UUID,
//     criado_em        TIMESTAMPTZ DEFAULT NOW(),
//     atualizado_em    TIMESTAMPTZ DEFAULT NOW()
// );

async function buscarContasPagar(filtros = {}) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('contas_pagar')
            .select('*, parceiros(razao_social, nome_fantasia), pedidos(numero), processos(numero_processo)')
            .order('data_vencimento', { ascending: true });
        if (usuario.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        // Filtro de período (revisão de performance) — só se aplica a contas
        // já pagas/canceladas; pendente ou vencida continua sempre visível,
        // mesmo com vencimento antigo (é justamente o que precisa de ação).
        if (filtros.diasAtras) {
            const desde = new Date(Date.now() - filtros.diasAtras * 86400000).toISOString().slice(0, 10);
            query = query.or(`status.not.in.(pago,cancelado),data_vencimento.gte.${desde}`);
        }
        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

async function buscarContasPagarPeriodo(inicio, fim) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('contas_pagar')
            .select('*, parceiros(razao_social, nome_fantasia), pedidos(numero), processos(numero_processo)')
            .gte('data_vencimento', inicio)
            .lte('data_vencimento', fim)
            .order('data_vencimento', { ascending: true });
        if (usuario.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

async function salvarContaPagar(dados, id = null) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };
        const payload = {
            descricao:       dados.descricao,
            parceiro_id:     dados.parceiro_id || null,
            pedido_id:       dados.pedido_id || null,
            processo_id:     dados.processo_id || null,
            valor:           dados.valor,
            moeda:           dados.moeda || 'BRL',
            data_vencimento: dados.data_vencimento,
            // Marcar como "pago" sem preencher a Data de Pagamento deixava
            // essa conta fora do card "Pago este mês" pra sempre (o resumo
            // filtra por mês/ano de data_pagamento — null nunca bate com
            // nada). Garantia aqui, além do auto-preenchimento na UI
            // (contas-pagar.js/cpAoMudarStatus): status "pago" sem data
            // explícita usa hoje.
            data_pagamento:  dados.status === 'pago' ? (dados.data_pagamento || new Date().toISOString().slice(0, 10)) : (dados.data_pagamento || null),
            status:          dados.status || 'pendente',
            categoria:       dados.categoria || null,
            observacoes:     dados.observacoes || null,
            atualizado_em:   new Date().toISOString(),
        };
        let result;
        if (id) {
            result = await supabaseClient.from('contas_pagar').update(payload).eq('id', id).select().single();
        } else {
            payload.empresa_id  = usuario.empresa_id;
            payload.criado_por  = usuario.id;
            result = await supabaseClient.from('contas_pagar').insert(payload).select().single();
        }
        if (result.error) return { sucesso: false, mensagem: result.error.message };
        return { sucesso: true, data: result.data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function atualizarContaPagar(id, dados) {
    try {
        const { error } = await supabaseClient
            .from('contas_pagar')
            .update({ ...dados, atualizado_em: new Date().toISOString() })
            .eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function excluirContaPagar(id) {
    try {
        const { error } = await supabaseClient.from('contas_pagar').delete().eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// ========================================
// MÓDULO FINANCEIRO — CONTAS A RECEBER
// ========================================

async function buscarContasReceber(filtros = {}) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('contas_receber')
            .select('*, parceiros(razao_social, nome_fantasia), pedidos(numero), processos(numero_processo), plano_contas(codigo, subfator_nome, conta_codigo, conta_nome)')
            .order('data_vencimento', { ascending: true });
        if (usuario.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        // Filtro de período (revisão de performance) — mesma lógica de
        // buscarContasPagar: só afeta contas já recebidas/canceladas.
        if (filtros.diasAtras) {
            const desde = new Date(Date.now() - filtros.diasAtras * 86400000).toISOString().slice(0, 10);
            query = query.or(`status.not.in.(recebido,cancelado),data_vencimento.gte.${desde}`);
        }
        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

async function buscarContasReceberPeriodo(inicio, fim) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('contas_receber')
            .select('*, parceiros(razao_social, nome_fantasia), pedidos(numero), processos(numero_processo), plano_contas(codigo, subfator_nome, conta_codigo, conta_nome)')
            .gte('data_vencimento', inicio)
            .lte('data_vencimento', fim)
            .order('data_vencimento', { ascending: true });
        if (usuario.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

async function salvarContaReceber(dados, id = null) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };
        const payload = {
            descricao:        dados.descricao,
            parceiro_id:      dados.parceiro_id || null,
            pedido_id:        dados.pedido_id || null,
            processo_id:      dados.processo_id || null,
            valor:            dados.valor,
            moeda:            dados.moeda || 'BRL',
            data_vencimento:  dados.data_vencimento,
            // Mesma garantia de contas_pagar/data_pagamento acima: status
            // "recebido" sem Data de Recebimento explícita usa hoje, senão
            // a conta nunca aparece em "Recebido este mês".
            data_recebimento: dados.status === 'recebido' ? (dados.data_recebimento || new Date().toISOString().slice(0, 10)) : (dados.data_recebimento || null),
            status:           dados.status || 'pendente',
            categoria:        dados.categoria || null,
            plano_conta_id:   dados.plano_conta_id || null,
            observacoes:      dados.observacoes || null,
            atualizado_em:    new Date().toISOString(),
        };
        let result;
        if (id) {
            result = await supabaseClient.from('contas_receber').update(payload).eq('id', id).select().single();
        } else {
            payload.empresa_id = usuario.empresa_id;
            payload.criado_por = usuario.id;
            result = await supabaseClient.from('contas_receber').insert(payload).select().single();
        }
        if (result.error) return { sucesso: false, mensagem: result.error.message };
        return { sucesso: true, data: result.data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// Plano de Contas — tabela de referência hierárquica (Bloco > Conta >
// Subfator), ver database/database-plano-contas-receitas.sql. Por
// enquanto só o Bloco 1 (Receitas) está populado; `bloco` deixa pronto
// pra filtrar os próximos blocos conforme forem sendo integrados.
async function buscarPlanoContas(bloco = 1) {
    try {
        const { data, error } = await supabaseClient
            .from('plano_contas')
            .select('id, bloco, bloco_nome, conta_codigo, conta_nome, codigo, subfator_nome, descricao, base, ordem')
            .eq('bloco', bloco)
            .eq('ativo', true)
            .order('ordem', { ascending: true });
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

async function atualizarContaReceber(id, dados) {
    try {
        const { error } = await supabaseClient
            .from('contas_receber')
            .update({ ...dados, atualizado_em: new Date().toISOString() })
            .eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function excluirContaReceber(id) {
    try {
        const { error } = await supabaseClient.from('contas_receber').delete().eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// ========================================
// EXPORTAR API
// ========================================

window.supabaseAPI = {
    login: loginSupabase,
    atualizarUsuarioLogado,
    cadastrar: cadastrarContaSupabase,
    salvarEmpresa: salvarEmpresaCadastrada,
    editarEmpresa: editarEmpresaCadastrada,
    excluirEmpresa: excluirEmpresaCadastrada,
    buscarEmpresas: buscarEmpresasCadastradas,
    buscarEmpresaPorId,
    buscarSolicitacoes: buscarSolicitacoesPendentes,
    responderSolicitacao: responderSolicitacao,
    solicitarEntradaEmpresa,
    buscarUsuarios: buscarUsuariosDaEmpresa,
    atualizarPerfil: atualizarPerfilUsuario,
    atualizarPermissoes: atualizarPermissoesUsuario,
    ativarDesativar: ativarDesativarUsuario,
    buscarChaveEmpresa: buscarChaveEmpresa,
    criarSubUsuario,
    atualizarDadosPessoais,
    buscarDadosPlano,
    buscarDadosPerfilCompleto,
    redefinirSenha,
    buscarProcessos,
    buscarProcessoPorId,
    salvarProcesso,
    atualizarProcesso,
    excluirProcesso,
    buscarProdutos,
    buscarProdutoPorId,
    salvarProduto,
    salvarProdutosEmLote,
    atualizarPrecosEmLote,
    editarProduto,
    excluirProduto,
    atualizarTenantEmpresa,
    registrarEmpresaPropria,
    buscarTenantEmpresa,
    salvarProposta: salvarPropostaDB,
    buscarProforma: buscarProformaDB,
    atualizarProforma: atualizarProformaDB,
    marcarProformaFinalizada: marcarProformaFinalizadaDB,
    contarPropostas,
    // Comercial
    buscarOportunidades,
    buscarHistoricoOportunidade,
    salvarOportunidade,
    gerarNumeroSequencial,
    atualizarEtapaOportunidade,
    excluirOportunidade,
    restaurarOportunidade,
    buscarPedidos,
    salvarPedido,
    atualizarStatusPedido,
    avancarStatusPedido,
    excluirPedido,
    vincularProformaAoPedido,
    buscarPedidoIdPorProforma,
    buscarDocumentosPedidos,
    marcarDocumentoAssinado,
    excluirDocumentoPedido,
    // Financeiro
    buscarContasPagar,
    buscarContasPagarPeriodo,
    salvarContaPagar,
    atualizarContaPagar,
    excluirContaPagar,
    buscarContasReceber,
    buscarContasReceberPeriodo,
    salvarContaReceber,
    buscarPlanoContas,
    atualizarContaReceber,
    excluirContaReceber,
};

// ========================================
// MÓDULO COMERCIAL — PIPELINE
// ========================================
//
// SQL para criar as tabelas no Supabase (executar uma vez):
//
// CREATE TABLE oportunidades (
//     id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     empresa_proprietaria_id UUID REFERENCES empresas(id),
//     titulo                  TEXT NOT NULL,
//     cliente_id              INTEGER REFERENCES parceiros(id),
//     valor                   NUMERIC,
//     moeda                   TEXT DEFAULT 'USD',
//     etapa                   TEXT DEFAULT 'proposta'
//                                 CHECK (etapa IN ('lead','proposta','negociacao','fechado','perdido')),
//                                 -- 'lead' não é mais usado pelo app (2026-08-27, ver pipeline.js) —
//                                 -- mantido no CHECK só por compatibilidade com o schema já rodado no banco.
//     probabilidade           INTEGER DEFAULT 50,
//                                 -- campo removido do formulário/card (2026-08-27) — a coluna
//                                 -- e os registros antigos continuam intactos, só não é mais
//                                 -- exibida nem enviada pelo app.
//     responsavel             TEXT,
//     data_prevista           DATE,
//     observacoes             TEXT,
//     proforma_id             UUID,
//     excluido_em             TIMESTAMPTZ,
//                                 -- exclusão suave (2026-08-28, ver proposta.html/js e
//                                 -- database/database-oportunidades-soft-delete.sql) — sinal
//                                 -- independente da etapa, pra restaurar não perder o progresso.
//     excluido_por            TEXT,
//     created_at              TIMESTAMPTZ DEFAULT NOW(),
//     updated_at              TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE pedidos (
//     id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     empresa_proprietaria_id UUID REFERENCES empresas(id),
//     numero                  TEXT,
//     cliente_id              INTEGER REFERENCES parceiros(id),
//     proforma_id             UUID,
//     oportunidade_id         UUID REFERENCES oportunidades(id),
//     status                  TEXT DEFAULT 'aguardando'
//                                 CHECK (status IN ('aguardando','confirmado','em_producao','embarcado','entregue','cancelado')),
//     valor_total             NUMERIC,
//     moeda                   TEXT DEFAULT 'USD',
//     data_pedido             DATE,
//     data_entrega_prevista   DATE,
//     observacoes             TEXT,
//     created_at              TIMESTAMPTZ DEFAULT NOW(),
//     updated_at              TIMESTAMPTZ DEFAULT NOW()
// );

async function buscarOportunidades(filtros = {}) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };

        // Filtro de período (revisão de performance) — só se aplica a
        // propostas já fechadas/perdidas; em proposta/negociação continua
        // sempre visível, mesmo com updated_at antigo.
        const desde = filtros.diasAtras ? new Date(Date.now() - filtros.diasAtras * 86400000).toISOString() : null;

        let query = supabaseClient
            .from('oportunidades')
            .select(`*,
                parceiros!oportunidades_cliente_id_fkey(razao_social, nome_fantasia, documento),
                remetente:parceiros!oportunidades_remetente_parceiro_id_fkey(razao_social, nome_fantasia, documento)`)
            .is('excluido_em', null)
            .order('updated_at', { ascending: false });
        if (usuario.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        if (desde) query = query.or(`etapa.not.in.(fechado,perdido),updated_at.gte.${desde}`);
        let { data, error } = await query;

        // Fallback pra antes de database-oportunidades-remetente.sql rodar:
        // sem a coluna/FK remetente_parceiro_id, o join acima falha (400) —
        // volta pra consulta só com o Destinatário até a migração ser aplicada.
        if (error) {
            let queryFallback = supabaseClient
                .from('oportunidades')
                .select('*, parceiros!oportunidades_cliente_id_fkey(razao_social, nome_fantasia, documento)')
                .is('excluido_em', null)
                .order('updated_at', { ascending: false });
            if (usuario.empresa_id) queryFallback = queryFallback.eq('empresa_proprietaria_id', usuario.empresa_id);
            if (desde) queryFallback = queryFallback.or(`etapa.not.in.(fechado,perdido),updated_at.gte.${desde}`);
            ({ data, error } = await queryFallback);
        }

        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

// ========================================
// HISTÓRICO DA OPORTUNIDADE (linha do tempo — criada → etapa → Pedido → status)
// ========================================
// Guarda cada transição relevante de uma Proposta, mesmo quando ela não
// avança (Perdido) ou é excluída — pedido do usuário de ter rastreabilidade
// completa, não só o estado atual. Nunca deixa uma falha aqui quebrar a
// ação principal que a disparou (por isso não usa await nos call sites).
async function _registrarHistoricoOportunidade(oportunidadeId, evento, deValor = null, paraValor = null, pedidoId = null) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.empresa_id || !oportunidadeId) return;
        await supabaseClient.from('oportunidade_historico').insert({
            oportunidade_id: oportunidadeId,
            pedido_id: pedidoId,
            evento,
            de_valor: deValor,
            para_valor: paraValor,
            usuario_nome: usuario.nome || usuario.email || 'Desconhecido',
            empresa_proprietaria_id: usuario.empresa_id,
        });
    } catch (e) {
        console.warn('[Histórico] Falha ao registrar evento:', evento, e);
    }
}

async function buscarHistoricoOportunidade(oportunidadeId) {
    try {
        const { data, error } = await supabaseClient
            .from('oportunidade_historico')
            .select('*, pedidos(numero)')
            .eq('oportunidade_id', oportunidadeId)
            .order('criado_em', { ascending: true });
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

async function salvarOportunidade(dados, id = null) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };
        const payload = {
            titulo: dados.titulo, cliente_id: dados.cliente_id || null,
            remetente_parceiro_id: dados.remetente_parceiro_id || null,
            valor: dados.valor || null, moeda: dados.moeda || 'USD',
            etapa: dados.etapa || 'proposta',
            responsavel: dados.responsavel || null, data_prevista: dados.data_prevista || null,
            observacoes: dados.observacoes || null, proforma_id: dados.proforma_id || null,
            // Só faz sentido quando etapa === 'perdido', mas gravar null nos
            // outros casos também limpa um motivo antigo se a proposta for
            // reaberta depois (etapa mudada de volta pra Proposta/Negociação).
            motivo_perda: dados.etapa === 'perdido' ? (dados.motivo_perda || null) : null,
            updated_at: new Date().toISOString(),
        };
        let result;
        let etapaAnterior = null;
        if (id) {
            const { data: atual } = await supabaseClient.from('oportunidades').select('etapa').eq('id', id).single();
            etapaAnterior = atual?.etapa || null;
            result = await supabaseClient.from('oportunidades').update(payload).eq('id', id).select().single();
        } else {
            payload.empresa_proprietaria_id = usuario.empresa_id;
            result = await supabaseClient.from('oportunidades').insert(payload).select().single();
        }
        if (result.error) return { sucesso: false, mensagem: result.error.message };

        if (!id) {
            _registrarHistoricoOportunidade(result.data.id, 'criada', null, payload.etapa);
        } else if (etapaAnterior && etapaAnterior !== payload.etapa) {
            _registrarHistoricoOportunidade(id, 'etapa_alterada', etapaAnterior, payload.etapa);
        }

        return { sucesso: true, data: result.data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function atualizarEtapaOportunidade(id, etapa) {
    try {
        const { data: atual } = await supabaseClient.from('oportunidades').select('etapa').eq('id', id).single();
        const { error } = await supabaseClient.from('oportunidades')
            .update({ etapa, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        if (atual?.etapa && atual.etapa !== etapa) {
            _registrarHistoricoOportunidade(id, 'etapa_alterada', atual.etapa, etapa);
        }
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// Exclusão suave — ver database/database-oportunidades-soft-delete.sql.
// Só marca excluido_em/excluido_por, nunca toca em `etapa` (diferente de
// excluirPedido, que reaproveita `status`): assim restaurarOportunidade()
// devolve a proposta pra etapa exata em que estava, sem perder progresso.
async function excluirOportunidade(id) {
    try {
        const usuario = obterUsuarioLogado();
        const { error } = await supabaseClient.from('oportunidades')
            .update({
                excluido_em:  new Date().toISOString(),
                excluido_por: usuario?.nome || usuario?.email || 'Desconhecido',
            })
            .eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        _registrarHistoricoOportunidade(id, 'excluida');
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function restaurarOportunidade(id) {
    try {
        const { error } = await supabaseClient.from('oportunidades')
            .update({ excluido_em: null, excluido_por: null })
            .eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        _registrarHistoricoOportunidade(id, 'restaurada');
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function buscarPedidos(filtros = {}) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('pedidos')
            .select(`*,
                parceiros!pedidos_cliente_id_fkey(razao_social, nome_fantasia, documento),
                remetente:parceiros!pedidos_remetente_parceiro_id_fkey(razao_social, nome_fantasia, documento),
                pedido_itens(*, produtos(nome, sku))`)
            .neq('status', 'excluido')
            .order('created_at', { ascending: false });
        if (usuario.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        // Filtro de período (revisão de performance) — só se aplica a pedidos
        // já finalizados; um em andamento continua sempre visível.
        if (filtros.diasAtras) {
            const desde = new Date(Date.now() - filtros.diasAtras * 86400000).toISOString();
            query = query.or(`status.not.in.(entregue,cancelado),created_at.gte.${desde}`);
        }
        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

// Numeração sequencial que nunca repete, mesmo se o registro for excluído
// de verdade depois (diferente do MAX+1 usado em Pedido/Processo abaixo,
// que só funciona porque aqueles nunca são excluídos fisicamente — ver
// database/database-oportunidades-numero-proposta.sql). Usa a RPC
// proximo_numero_sequencial (INSERT...ON CONFLICT...RETURNING atômico),
// então também não tem a brecha de corrida que o MAX+1 local tem.
async function gerarNumeroSequencial(tipo, prefixo) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.empresa_id) return { sucesso: false, mensagem: 'Sem empresa vinculada' };

        const { data, error } = await supabaseClient.rpc('proximo_numero_sequencial', {
            p_empresa_id: usuario.empresa_id,
            p_tipo: tipo,
            p_prefixo: prefixo,
        });
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, numero: data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// Gera o número do pedido no mesmo padrão de Proforma (PRO...) e Processo
// (PROC...): PED{ano}{sequencial de 6 dígitos}, ex. PED2026000001. Busca o
// maior número já usado no ano pra essa empresa e soma 1, em vez de contar
// linhas (evita colisão quando pedidos antigos foram excluídos).
async function _gerarNumeroPedido(empresaId) {
    const ano     = new Date().getFullYear();
    const pattern = `PED${ano}%`;

    const { data } = await supabaseClient
        .from('pedidos')
        .select('numero')
        .eq('empresa_proprietaria_id', empresaId)
        .like('numero', pattern)
        .order('numero', { ascending: false })
        .limit(1);

    let seq = 1;
    if (data && data.length > 0) {
        const ultimo = data[0].numero;
        const num    = parseInt(ultimo?.slice(`PED${ano}`.length), 10);
        if (!isNaN(num)) seq = num + 1;
    }

    return `PED${ano}${String(seq).padStart(6, '0')}`;
}

// itens: [{ produto_id, produto_nome, quantidade, unidade_medida, preco_unitario }]
async function salvarPedido(dados, id = null, itens = []) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        // Número gerado automaticamente só na criação — edição preserva o que já existe.
        const numero = id ? (dados.numero || null) : await _gerarNumeroPedido(usuario.empresa_id);

        const payload = {
            numero, cliente_id: dados.cliente_id || null,
            remetente_parceiro_id: dados.remetente_parceiro_id || null,
            proforma_id: dados.proforma_id || null, oportunidade_id: dados.oportunidade_id || null,
            status: dados.status || 'aguardando', valor_total: dados.valor_total || null,
            moeda: dados.moeda || 'USD', data_pedido: dados.data_pedido || null,
            data_entrega_prevista: dados.data_entrega_prevista || null,
            observacoes: dados.observacoes || null, updated_at: new Date().toISOString(),
        };
        let result;
        if (id) {
            result = await supabaseClient.from('pedidos').update(payload).eq('id', id).select().single();
        } else {
            payload.empresa_proprietaria_id = usuario.empresa_id;
            payload.criado_por = usuario.nome || usuario.email || 'Desconhecido';
            result = await supabaseClient.from('pedidos').insert(payload).select().single();
        }
        if (result.error) return { sucesso: false, mensagem: result.error.message };

        const pedidoId = result.data.id;

        // Substitui os itens sem transação disponível no cliente: insere os novos
        // primeiro e só apaga os antigos (por id) depois do insert ter sucesso, para
        // que uma falha no insert nunca deixe o pedido sem nenhum item.
        const { data: itensAntigos } = await supabaseClient.from('pedido_itens').select('id').eq('pedido_id', pedidoId);
        const idsAntigos = (itensAntigos || []).map(i => i.id);

        const linhasValidas = (itens || []).filter(it => it.produto_nome && Number(it.quantidade) > 0);
        if (linhasValidas.length) {
            const rows = linhasValidas.map(it => ({
                pedido_id: pedidoId,
                produto_id: it.produto_id || null,
                produto_nome: it.produto_nome,
                quantidade: it.quantidade,
                unidade_medida: it.unidade_medida || 'UN',
                preco_unitario: it.preco_unitario || 0,
            }));
            const { error: insErr } = await supabaseClient.from('pedido_itens').insert(rows);
            if (insErr) return { sucesso: false, mensagem: insErr.message };
        }

        if (idsAntigos.length) {
            const { error: delErr } = await supabaseClient.from('pedido_itens').delete().in('id', idsAntigos);
            if (delErr) return { sucesso: false, mensagem: delErr.message };
        }

        // Marca no histórico da Proposta que ela virou Pedido — só na
        // criação (edição de um pedido já existente não é um novo evento).
        if (!id && dados.oportunidade_id) {
            _registrarHistoricoOportunidade(dados.oportunidade_id, 'pedido_gerado', null, numero, pedidoId);
        }

        return { sucesso: true, data: result.data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function atualizarStatusPedido(id, status) {
    try {
        const { data: atual } = await supabaseClient.from('pedidos').select('status, oportunidade_id').eq('id', id).single();
        const { error } = await supabaseClient.from('pedidos')
            .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        if (atual?.oportunidade_id && atual.status !== status) {
            _registrarHistoricoOportunidade(atual.oportunidade_id, 'pedido_status_alterado', atual.status, status, id);
        }
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

const PED_STATUS_ORDEM_AVANCO = ['aguardando', 'confirmado', 'em_producao', 'embarcado', 'entregue'];

// Avança o status do pedido automaticamente ao gerar Proforma/Processo — nunca
// retrocede um status já mais avançado (ex: pedido Embarcado não volta pra
// Confirmado só porque gerou uma 2ª proforma) e nunca mexe num pedido Cancelado.
async function avancarStatusPedido(pedidoId, statusAlvo) {
    try {
        const { data: ped, error: errBusca } = await supabaseClient
            .from('pedidos').select('status').eq('id', pedidoId).single();
        if (errBusca || !ped) return { sucesso: false, mensagem: errBusca?.message };

        const atual = ped.status || 'aguardando';
        if (atual === 'cancelado') return { sucesso: true };

        const iAtual = PED_STATUS_ORDEM_AVANCO.indexOf(atual);
        const iAlvo  = PED_STATUS_ORDEM_AVANCO.indexOf(statusAlvo);
        if (iAlvo <= iAtual) return { sucesso: true };

        return await atualizarStatusPedido(pedidoId, statusAlvo);
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// Marca o pedido como vinculado à proforma gerada a partir dele, e avança o
// status pra "Confirmado" (se ainda não tiver ido além disso).
async function vincularProformaAoPedido(pedidoId, proformaId) {
    try {
        const { error } = await supabaseClient.from('pedidos')
            .update({ proforma_id: proformaId, updated_at: new Date().toISOString() }).eq('id', pedidoId);
        if (error) return { sucesso: false, mensagem: error.message };
        await avancarStatusPedido(pedidoId, 'confirmado');
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// Busca o pedido de origem de uma proforma (proformas.pedido_id, 1:N — um
// pedido pode ter várias proformas, cada proforma sabe de qual pedido nasceu),
// usado para propagar pedido_id ao processo gerado a partir dessa proforma.
async function buscarPedidoIdPorProforma(proformaId) {
    try {
        const { data, error } = await supabaseClient.from('proformas')
            .select('pedido_id')
            .eq('id', proformaId).maybeSingle();
        if (error) return { sucesso: false, mensagem: error.message, data: null };
        if (!data?.pedido_id) return { sucesso: true, data: null };
        return { sucesso: true, data: { id: data.pedido_id } };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: null }; }
}

// Exclusão suave (soft delete) — mesmo padrão de proformas/processos:
// o pedido some da listagem mas fica recuperável por 7 dias no painel Excluídos.
async function excluirPedido(id) {
    try {
        const usuario = obterUsuarioLogado();
        const { data: atual } = await supabaseClient.from('pedidos').select('oportunidade_id').eq('id', id).single();
        const { error } = await supabaseClient
            .from('pedidos')
            .update({
                status:       'excluido',
                excluido_em:  new Date().toISOString(),
                excluido_por: usuario?.nome || usuario?.email || 'Desconhecido',
            })
            .eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        if (atual?.oportunidade_id) {
            _registrarHistoricoOportunidade(atual.oportunidade_id, 'pedido_excluido', null, null, id);
        }
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

// ========================================
// DOCUMENTOS DO PEDIDO (tela Documentos)
// ========================================

async function buscarDocumentosPedidos(pedidoIds) {
    try {
        if (!pedidoIds || !pedidoIds.length) return { sucesso: true, data: [] };
        const { data, error } = await supabaseClient
            .from('pedido_documentos')
            .select('*')
            .in('pedido_id', pedidoIds);
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

// Marca/desmarca assinatura, com o arquivo do documento já assinado
// anexado (upload real via Storage, path/nome gravados aqui). Também serve
// pra criar a linha de um documento customizado (assinado=false, só com
// tipo_label). Não existe e-signature real nesta app: "assinadoPor" é texto
// livre digitado pelo usuário (quem assinou fisicamente, pode ser um
// terceiro); "enviado_por" é sempre o usuário logado que fez o upload,
// capturado automaticamente — pode ser uma pessoa diferente de quem assinou.
// "assinado_em" é a data/hora capturada pelo sistema — nunca digitada.
async function marcarDocumentoAssinado(pedidoId, tipoDocumento, assinado, assinadoPor = null, tipoLabel = null, arquivoPath = null, arquivoNome = null) {
    try {
        const usuario = obterUsuarioLogado();
        const { data, error } = await supabaseClient
            .from('pedido_documentos')
            .upsert({
                pedido_id:      pedidoId,
                tipo_documento: tipoDocumento,
                tipo_label:     tipoLabel,
                assinado:       assinado,
                assinado_por:   assinado ? assinadoPor : null,
                assinado_em:    assinado ? new Date().toISOString() : null,
                arquivo_path:   assinado ? arquivoPath : null,
                arquivo_nome:   assinado ? arquivoNome : null,
                enviado_por:    assinado ? (usuario?.nome || usuario?.email || null) : null,
                atualizado_em:  new Date().toISOString(),
                atualizado_por: usuario?.id || null,
            }, { onConflict: 'pedido_id,tipo_documento' })
            .select()
            .single();
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function excluirDocumentoPedido(id) {
    try {
        const { error } = await supabaseClient.from('pedido_documentos').delete().eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

