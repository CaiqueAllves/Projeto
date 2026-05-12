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
                bairro:               dadosEmpresa.bairro      || null,
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

async function editarEmpresaCadastrada(id, dadosEmpresa) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        // 1. Atualizar tabela principal
        const { error: errParceiro } = await supabaseClient
            .from('parceiros')
            .update({
                is_fabricante:        dadosEmpresa.tipos.includes('fabricante'),
                is_cliente:           dadosEmpresa.tipos.includes('cliente'),
                is_fornecedor:        dadosEmpresa.tipos.includes('fornecedor'),
                is_transportadora:    dadosEmpresa.tipos.includes('transportadora'),
                is_remetente:         dadosEmpresa.tipos.includes('remetente'),
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
                bairro:               dadosEmpresa.bairro      || null,
                endereco:             dadosEmpresa.endereco    || null,
                numero:               dadosEmpresa.numero      || null,
                complemento:          dadosEmpresa.complemento || null,
                site:                 dadosEmpresa.site                || null,
                horario_atendimento:  dadosEmpresa.horario_atendimento || null,
                tags:                 dadosEmpresa.tags || [],
            })
            .eq('id', id)
            .eq('created_by', usuario.id);

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

        const { error } = await supabaseClient
            .from('parceiros')
            .delete()
            .eq('id', id)
            .eq('created_by', usuario.id);

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
            .select('id, nome_completo, cpf, email, perfil, ativo, ultimo_login, criado_em')
            .eq('empresa_id', usuario.empresa_id)
            .order('criado_em', { ascending: true });
        if (error) return { sucesso: false, mensagem: error.message, data: [] };
        return { sucesso: true, data: data || [] };
    } catch (err) {
        return { sucesso: false, mensagem: err.message, data: [] };
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
            .select('id, cpf, nome_completo, email, perfil, ativo, cargo, telefone, avatar_url, ultimo_login, criado_em, empresa_id, empresas(razao_social, nome_fantasia, cnpj, ie, im, suframa, cep, estado, cidade, bairro, endereco, numero, complemento, plano, chave_empresa)')
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
            .select('*, empresas_cadastradas(nome_empresa, nome_fantasia), usuarios!responsavel_id(nome_completo)')
            .eq('empresa_proprietaria_id', usuario.empresa_id)
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

async function salvarProcesso(dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { data, error } = await supabaseClient
            .from('processos')
            .insert({
                tipo:                    dados.tipo,
                status:                  dados.status || 'aberto',
                empresa_proprietaria_id: usuario.empresa_id,
                empresa_parceira_id:     dados.empresa_parceira_id || null,
                responsavel_id:          dados.responsavel_id || usuario.id,
                moeda:                   dados.moeda || 'USD',
                valor_total:             dados.valor_total || null,
                incoterm:                dados.incoterm || null,
                porto_origem:            dados.porto_origem || null,
                porto_destino:           dados.porto_destino || null,
                data_abertura:           dados.data_abertura || new Date().toISOString().split('T')[0],
                data_previsao:           dados.data_previsao || null,
                observacoes:             dados.observacoes || null,
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

async function atualizarProcesso(id, dados) {
    try {
        const usuario = obterUsuarioLogado();
        if (!usuario) return { sucesso: false, mensagem: 'Não autenticado' };

        const { error } = await supabaseClient
            .from('processos')
            .update({ ...dados, atualizado_em: new Date().toISOString() })
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
            .eq('empresa_proprietaria_id', usuario.empresa_id)
            .order('descricao', { ascending: true });

        if (apenasAtivos) query = query.eq('ativo', true);

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
                empresa_proprietaria_id: usuario.empresa_id,
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
            .eq('empresa_proprietaria_id', usuario.empresa_id);
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
            .eq('empresa_proprietaria_id', usuario.empresa_id);
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
        const { error } = await supabaseClient
            .from('empresas')
            .update({
                razao_social:  dados.razao_social  ?? null,
                nome_fantasia: dados.nome_fantasia ?? null,
                cnpj:          dados.cnpj          ?? null,
                nome:          dados.nome          ?? null,
                ie:            dados.ie            ?? null,
                im:            dados.im            ?? null,
                suframa:       dados.suframa       ?? null,
                cep:           dados.cep           ?? null,
                estado:        dados.estado        ?? null,
                cidade:        dados.cidade        ?? null,
                bairro:        dados.bairro        ?? null,
                endereco:      dados.endereco      ?? null,
                numero:        dados.numero        ?? null,
                complemento:   dados.complemento   ?? null,
            })
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
            .select('id, razao_social, nome_fantasia, nome, cnpj, ie, im, suframa, email, cep, estado, cidade, bairro, endereco, numero, complemento, plano, chave_empresa')
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
            .from('propostas')
            .select('*', { count: 'exact', head: true })
            .like('codigo', `PROPO${ano}%`);
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
        const codigo = `PROPO${ano}${String(cont + 1).padStart(4, '0')}`;

        const { data, error } = await supabaseClient
            .from('propostas')
            .insert({
                codigo:              codigo,
                empresa_id:          usuario.empresa_id || null,
                criado_por:          usuario.id,
                tipo:                dados.tipo                || null,
                proposito:           dados.proposito           || null,
                status:              'ativo',
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
            })
            .select('id, codigo')
            .single();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, data };
    } catch (err) {
        return { sucesso: false, mensagem: err.message };
    }
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
    buscarSolicitacoes: buscarSolicitacoesPendentes,
    responderSolicitacao: responderSolicitacao,
    buscarUsuarios: buscarUsuariosDaEmpresa,
    atualizarPerfil: atualizarPerfilUsuario,
    ativarDesativar: ativarDesativarUsuario,
    buscarChaveEmpresa: buscarChaveEmpresa,
    criarSubUsuario,
    atualizarDadosPessoais,
    atualizarSenha,
    buscarDadosPlano,
    buscarDadosPerfilCompleto,
    redefinirSenha,
    buscarProcessos,
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
    contarPropostas,
};

