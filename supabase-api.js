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
// LOGIN
// ========================================

async function loginSupabase(cpf, senha) {
    try {
        const { data: usuario, error } = await supabaseClient
            .from('usuarios')
            .select('id, cpf, nome_completo, email, perfil, ativo, bloqueado_ate, tentativas_login, senha_hash, empresa_id, avatar_url, empresas(razao_social)')
            .eq('cpf', cpf)
            .single();

        if (error || !usuario) {
            return { sucesso: false, mensagem: 'CPF ou senha incorretos' };
        }

        if (!usuario.ativo) {
            return { sucesso: false, mensagem: 'Usuário inativo. Contate o administrador.' };
        }

        if (usuario.bloqueado_ate && new Date() < new Date(usuario.bloqueado_ate)) {
            const minutos = Math.ceil((new Date(usuario.bloqueado_ate) - new Date()) / 60000);
            return { sucesso: false, mensagem: `Usuário bloqueado. Tente novamente em ${minutos} minutos.` };
        }

        if (usuario.senha_hash !== senha) {
            await supabaseClient
                .from('usuarios')
                .update({ tentativas_login: (usuario.tentativas_login || 0) + 1 })
                .eq('cpf', cpf);
            return { sucesso: false, mensagem: 'CPF ou senha incorretos' };
        }

        await supabaseClient
            .from('usuarios')
            .update({ tentativas_login: 0, bloqueado_ate: null, ultimo_login: new Date().toISOString() })
            .eq('id', usuario.id);

        return {
            sucesso: true,
            mensagem: 'Login realizado com sucesso!',
            usuario: {
                id: usuario.id,
                cpf: usuario.cpf,
                nome: usuario.nome_completo,
                email: usuario.email,
                perfil: usuario.perfil,
                empresa: usuario.empresas?.razao_social || '',
                empresa_id: usuario.empresa_id,
                avatar_url: usuario.avatar_url || null
            }
        };

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

async function cadastrarContaSupabase(dados) {
    try {
        const { nome, cpf, email, senha, empresa, cnpjEmpresa, chaveEmpresa, aceitouTermos } = dados;

        if (!aceitouTermos) {
            return { sucesso: false, mensagem: 'Você deve aceitar os termos de uso!' };
        }

        // Verificar se CPF já existe
        const { data: cpfExistente, error: erroCpf } = await supabaseClient
            .from('usuarios')
            .select('cpf')
            .eq('cpf', cpf)
            .maybeSingle();

        if (erroCpf) {
            console.error('[Supabase] Erro ao verificar CPF:', erroCpf);
            return { sucesso: false, mensagem: 'Erro ao verificar CPF: ' + erroCpf.message };
        }

        if (cpfExistente) {
            return { sucesso: false, mensagem: 'Este CPF já está cadastrado!' };
        }

        let empresaId = null;
        let chaveGerada = null;
        let perfil = 'admin';
        let empresaSolicitadaId = null;
        let aviso = null;

        if (chaveEmpresa) {
            // Tentar entrar em empresa existente via chave
            const { data: empresaEncontrada } = await supabaseClient
                .from('empresas')
                .select('id, razao_social')
                .eq('chave_empresa', chaveEmpresa.toUpperCase())
                .maybeSingle();

            if (empresaEncontrada) {
                // Chave válida: conta criada sem vínculo, solicitação fica pendente até admin aprovar
                empresaSolicitadaId = empresaEncontrada.id;
                aviso = `Solicitação enviada para "${empresaEncontrada.razao_social}". Aguarde a aprovação do responsável.`;
            } else {
                // Chave inválida: conta criada normalmente sem empresa, sem bloquear o cadastro
                aviso = 'Chave não encontrada. Conta criada sem vínculo com empresa.';
            }

        } else if (empresa) {
            // Criar nova empresa e gerar chave
            chaveGerada = gerarChaveEmpresa();

            const { data: empresaCriada, error: erroEmpresa } = await supabaseClient
                .from('empresas')
                .insert({ razao_social: empresa, nome_fantasia: empresa, cnpj: cnpjEmpresa || null, email, status: 'trial', plano: 'free', chave_empresa: chaveGerada })
                .select()
                .single();

            if (erroEmpresa) {
                console.error('[Supabase] Erro ao criar empresa:', erroEmpresa);
                return { sucesso: false, mensagem: 'Erro ao criar empresa: ' + erroEmpresa.message };
            }

            empresaId = empresaCriada.id;
        }

        // Criar usuário sem empresa_id primeiro (evita FK timing issue)
        const { data: novoUsuario, error: erroUsuario } = await supabaseClient
            .from('usuarios')
            .insert({ nome_completo: nome, cpf, email, senha_hash: senha, perfil, ativo: true })
            .select()
            .single();

        if (erroUsuario) {
            console.error('[Supabase] Erro ao criar usuário:', erroUsuario);
            return { sucesso: false, mensagem: 'Erro ao criar conta: ' + erroUsuario.message };
        }

        // Vincular empresa se criou uma nova
        if (empresaId) {
            await supabaseClient
                .from('usuarios')
                .update({ empresa_id: empresaId })
                .eq('id', novoUsuario.id);
        }

        // Criar solicitação de entrada na empresa (chave válida)
        if (empresaSolicitadaId) {
            const { error: erroSol } = await supabaseClient
                .from('solicitacoes_empresa')
                .insert({
                    usuario_id: novoUsuario.id,
                    empresa_id: empresaSolicitadaId,
                    nome_usuario: nome,
                    email_usuario: email
                });

            if (!erroSol) {
                // Tenta notificar admin por email (silencia se função não estiver configurada)
                await supabaseClient.rpc('notificar_admin_email', {
                    p_empresa_id: empresaSolicitadaId,
                    p_nome_usuario: nome,
                    p_email_usuario: email
                }).catch(() => {});
            }
        }

        return { sucesso: true, mensagem: 'Conta criada com sucesso!', usuario: novoUsuario, chave_gerada: chaveGerada, aviso };

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

async function responderSolicitacao(solicitacaoId, aprovado) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { data: sol, error: errSol } = await supabaseClient
            .from('solicitacoes_empresa')
            .select('usuario_id, empresa_id')
            .eq('id', solicitacaoId)
            .single();

        if (errSol || !sol) return { sucesso: false, mensagem: 'Solicitação não encontrada' };

        const { error: errUpd } = await supabaseClient
            .from('solicitacoes_empresa')
            .update({
                status: aprovado ? 'aprovado' : 'rejeitado',
                respondido_em: new Date().toISOString(),
                respondido_por: usuario.id
            })
            .eq('id', solicitacaoId);

        if (errUpd) return { sucesso: false, mensagem: 'Erro ao responder solicitação' };

        if (aprovado) {
            const { error: errUser } = await supabaseClient
                .from('usuarios')
                .update({ empresa_id: sol.empresa_id })
                .eq('id', sol.usuario_id);

            if (errUser) return { sucesso: false, mensagem: 'Erro ao vincular usuário à empresa' };
        }

        return { sucesso: true };
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
            .update({ senha_hash: novaSenha })
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function atualizarSenha(id, senhaAtual, novaSenha) {
    try {
        const { data: usuario, error } = await supabaseClient
            .from('usuarios')
            .select('senha_hash')
            .eq('id', id)
            .single();

        if (error || !usuario) return { sucesso: false, mensagem: 'Usuário não encontrado.' };
        if (usuario.senha_hash !== senhaAtual) return { sucesso: false, mensagem: 'Senha atual incorreta.' };

        const { error: errUpdate } = await supabaseClient
            .from('usuarios')
            .update({ senha_hash: novaSenha })
            .eq('id', id);

        if (errUpdate) return { sucesso: false, mensagem: errUpdate.message };
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
            .select('id, cpf, nome_completo, email, perfil, ativo, cargo, telefone, avatar_url, ultimo_login, criado_em, empresa_id, empresas(id, razao_social, nome_fantasia, cnpj, ie, im, suframa, cep, estado, cidade, endereco, numero, complemento)')
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
            senha_hash: dados.senha,
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

async function salvarProduto(dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { data, error } = await supabaseClient
            .from('produtos')
            .insert({
                codigo_interno:          dados.codigo_interno || null,
                descricao:               dados.descricao,
                descricao_complementar:  dados.descricao_complementar || null,
                ncm:                     dados.ncm || null,
                unidade_medida:          dados.unidade_medida || 'UN',
                peso_bruto:              dados.peso_bruto || null,
                peso_liquido:            dados.peso_liquido || null,
                pais_origem:             dados.pais_origem || null,
                fabricante:              dados.fabricante || null,
                marca:                   dados.marca || null,
                empresa_id:              usuario.empresa_id,
                criado_por:              usuario.id
            })
            .select()
            .single();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
}

async function editarProduto(id, dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('produtos')
            .update({ ...dados, atualizado_em: new Date().toISOString() })
            .eq('id', id)
            .eq('empresa_id', usuario.empresa_id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
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

async function buscarTenantEmpresa() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.empresa_id) return { sucesso: false };
        const { data, error } = await supabaseClient
            .from('empresas')
            .select('id, razao_social, nome_fantasia, cnpj, ie, im, suframa, cep, estado, cidade, endereco, numero, complemento')
            .eq('id', usuario.empresa_id)
            .single();
        if (error) return { sucesso: false };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false };
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
                tipo:                dados.tipo                || null,
                proposito:           dados.proposito           || null,
                status:              'pendente',
                emissor_tipo:        dados.emissor_tipo        || 'usuario',
                parceiro_id:         dados.parceiro_id         || null,
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
            .select('id, codigo')
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
// "aprovado" (vira finalizado) e não pode gerar outro processo.
async function marcarProformaFinalizadaDB(proformaId, processoId) {
    try {
        const { error } = await supabaseClient
            .from('proformas')
            .update({
                processo_gerado_id:   processoId,
                status:               'finalizado',
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
                tipo:                     dados.tipo                     || null,
                proposito:                dados.proposito                || null,
                emissor_tipo:             dados.emissor_tipo             || 'usuario',
                parceiro_id:              dados.parceiro_id              || null,
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
            .select('id, codigo')
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

async function buscarContasPagar() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('contas_pagar')
            .select('*, parceiros(razao_social, nome_fantasia), pedidos(numero), processos(numero_processo)')
            .order('data_vencimento', { ascending: true });
        if (usuario.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
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
            data_pagamento:  dados.data_pagamento || null,
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

async function buscarContasReceber() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('contas_receber')
            .select('*, parceiros(razao_social, nome_fantasia), pedidos(numero), processos(numero_processo)')
            .order('data_vencimento', { ascending: true });
        if (usuario.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
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
            data_recebimento: dados.data_recebimento || null,
            status:           dados.status || 'pendente',
            categoria:        dados.categoria || null,
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
    cadastrar: cadastrarContaSupabase,
    salvarEmpresa: salvarEmpresaCadastrada,
    editarEmpresa: editarEmpresaCadastrada,
    excluirEmpresa: excluirEmpresaCadastrada,
    buscarEmpresas: buscarEmpresasCadastradas,
    buscarEmpresaPorId,
    buscarSolicitacoes: buscarSolicitacoesPendentes,
    responderSolicitacao: responderSolicitacao,
    buscarUsuarios: buscarUsuariosDaEmpresa,
    atualizarPerfil: atualizarPerfilUsuario,
    atualizarPermissoes: atualizarPermissoesUsuario,
    ativarDesativar: ativarDesativarUsuario,
    buscarChaveEmpresa: buscarChaveEmpresa,
    criarSubUsuario,
    atualizarDadosPessoais,
    atualizarSenha,
    buscarDadosPlano,
    buscarDadosPerfilCompleto,
    redefinirSenha,
    buscarProcessos,
    buscarProcessoPorId,
    salvarProcesso,
    atualizarProcesso,
    excluirProcesso,
    buscarProdutos,
    salvarProduto,
    editarProduto,
    excluirProduto,
    atualizarTenantEmpresa,
    buscarTenantEmpresa,
    salvarProposta: salvarPropostaDB,
    buscarProforma: buscarProformaDB,
    atualizarProforma: atualizarProformaDB,
    marcarProformaFinalizada: marcarProformaFinalizadaDB,
    contarPropostas,
    // Comercial
    buscarOportunidades,
    salvarOportunidade,
    atualizarEtapaOportunidade,
    excluirOportunidade,
    buscarPedidos,
    salvarPedido,
    atualizarStatusPedido,
    avancarStatusPedido,
    excluirPedido,
    vincularProformaAoPedido,
    buscarPedidoIdPorProforma,
    // Financeiro
    buscarContasPagar,
    buscarContasPagarPeriodo,
    salvarContaPagar,
    atualizarContaPagar,
    excluirContaPagar,
    buscarContasReceber,
    buscarContasReceberPeriodo,
    salvarContaReceber,
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
//     etapa                   TEXT DEFAULT 'lead'
//                                 CHECK (etapa IN ('lead','proposta','negociacao','fechado','perdido')),
//     probabilidade           INTEGER DEFAULT 50,
//     responsavel             TEXT,
//     data_prevista           DATE,
//     observacoes             TEXT,
//     proforma_id             UUID,
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

async function buscarOportunidades() {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, data: [] };
        let query = supabaseClient
            .from('oportunidades')
            .select('*, parceiros(razao_social, nome_fantasia)')
            .order('updated_at', { ascending: false });
        if (usuario.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        const { data, error } = await query;
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
            valor: dados.valor || null, moeda: dados.moeda || 'USD',
            etapa: dados.etapa || 'lead', probabilidade: dados.probabilidade ?? 50,
            responsavel: dados.responsavel || null, data_prevista: dados.data_prevista || null,
            observacoes: dados.observacoes || null, proforma_id: dados.proforma_id || null,
            updated_at: new Date().toISOString(),
        };
        let result;
        if (id) {
            result = await supabaseClient.from('oportunidades').update(payload).eq('id', id).select().single();
        } else {
            payload.empresa_proprietaria_id = usuario.empresa_id;
            result = await supabaseClient.from('oportunidades').insert(payload).select().single();
        }
        if (result.error) return { sucesso: false, mensagem: result.error.message };
        return { sucesso: true, data: result.data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function atualizarEtapaOportunidade(id, etapa) {
    try {
        const { error } = await supabaseClient.from('oportunidades')
            .update({ etapa, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function excluirOportunidade(id) {
    try {
        const { error } = await supabaseClient.from('oportunidades').delete().eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function buscarPedidos() {
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
        const { data, error } = await query;
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) { return { sucesso: false, mensagem: err.message, data: [] }; }
}

// itens: [{ produto_id, produto_nome, quantidade, unidade_medida, preco_unitario }]
async function salvarPedido(dados, id = null, itens = []) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };
        const payload = {
            numero: dados.numero || null, cliente_id: dados.cliente_id || null,
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

        return { sucesso: true, data: result.data };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

async function atualizarStatusPedido(id, status) {
    try {
        const { error } = await supabaseClient.from('pedidos')
            .update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
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
        const { error } = await supabaseClient
            .from('pedidos')
            .update({
                status:       'excluido',
                excluido_em:  new Date().toISOString(),
                excluido_por: usuario?.nome || usuario?.email || 'Desconhecido',
            })
            .eq('id', id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
    } catch (err) { return { sucesso: false, mensagem: err.message }; }
}

