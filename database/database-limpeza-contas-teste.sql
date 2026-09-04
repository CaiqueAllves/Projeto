-- Limpeza única (não é migração de schema) — remove as contas/empresas
-- sandbox de teste criadas ao longo desta sessão pra validar a auditoria
-- de segurança e as features novas. anon/authenticated não têm DELETE em
-- usuarios/empresas (de propósito, pós-RLS real), por isso precisa rodar
-- no SQL Editor.
--
-- CPFs de teste: 111.444.777-35, 222.555.888-46, 333.666.999-57,
-- 444.777.222-14, 202.702.899-41 — todas contas "Canário"/"Teste"/
-- "Sub Usuario Teste RLS", nenhuma é conta real de cliente.
--
-- v3: ordem de dependência revisada por completo depois que a v2 ainda
-- violou pedidos_cliente_id_fkey. Ordem final (de dentro pra fora):
--   pedido_itens/pedido_documentos/oportunidade_historico (netos)
--   → contas_pagar/contas_receber (referenciam pedidos E processos)
--   → pedidos (referencia parceiros, proformas, oportunidades)
--   → processos (referencia parceiros, proformas)
--   → oportunidades (referencia parceiros)
--   → proformas (referencia parceiros; só fica livre depois de pedidos
--     E processos saírem, já que os dois referenciam proformas)
--   → produtos (referencia parceiros)
--   → parceiro_contatos → parceiros
--   → usuarios → empresas → auth.users
--
-- Se mesmo assim outra FK travar em algum DELETE, o Postgres avisa qual
-- tabela é — me diga o nome que eu ajusto de novo.
--
-- Rode dentro de uma transação — dá pra conferir o que seria afetado
-- antes de confirmar (troque COMMIT por ROLLBACK pra só simular, ou rode
-- só até o SELECT de conferência e pare aí).

BEGIN;

CREATE TEMP TABLE _teste_ids AS
    SELECT id AS usuario_id, auth_id, empresa_id
    FROM usuarios
    WHERE cpf IN ('111.444.777-35', '222.555.888-46', '333.666.999-57', '444.777.222-14', '202.702.899-41');

-- Conferência antes de apagar — SELECT puro, não muda nada. Rode só até
-- aqui primeiro se quiser ver exatamente quem vai ser afetado.
SELECT * FROM _teste_ids;

-- ── Netos (filhos de pedidos/oportunidades) ─────────────────────────────
DELETE FROM oportunidade_historico WHERE oportunidade_id IN (SELECT id FROM oportunidades WHERE empresa_proprietaria_id IN (SELECT empresa_id FROM _teste_ids));
DELETE FROM pedido_itens      WHERE pedido_id IN (SELECT id FROM pedidos WHERE empresa_proprietaria_id IN (SELECT empresa_id FROM _teste_ids));
DELETE FROM pedido_documentos WHERE pedido_id IN (SELECT id FROM pedidos WHERE empresa_proprietaria_id IN (SELECT empresa_id FROM _teste_ids));

-- ── Contas referenciam pedidos E processos — saem antes dos dois ───────
DELETE FROM contas_pagar   WHERE empresa_id IN (SELECT empresa_id FROM _teste_ids);
DELETE FROM contas_receber WHERE empresa_id IN (SELECT empresa_id FROM _teste_ids);

-- ── Pedidos (referencia parceiros, proformas, oportunidades) ───────────
DELETE FROM pedidos WHERE empresa_proprietaria_id IN (SELECT empresa_id FROM _teste_ids);

-- ── Processos (referencia parceiros, proformas) ────────────────────────
DELETE FROM processos WHERE empresa_proprietaria_id IN (SELECT empresa_id FROM _teste_ids);

-- ── Oportunidades (referencia parceiros) — depois de pedidos ───────────
DELETE FROM oportunidades WHERE empresa_proprietaria_id IN (SELECT empresa_id FROM _teste_ids);

-- ── Proformas (referencia parceiros) — só depois de pedidos e processos ─
DELETE FROM proformas WHERE empresa_id IN (SELECT empresa_id FROM _teste_ids); -- única exceção de nome de coluna, conferida ao vivo

-- ── Produtos (referencia parceiros via empresa_parceira_id) ────────────
DELETE FROM produtos WHERE empresa_id IN (SELECT empresa_id FROM _teste_ids);

-- ── Sem uso conhecido de parceiros — posição não é crítica, deixados aqui ─
DELETE FROM chamados WHERE empresa_proprietaria_id IN (SELECT empresa_id FROM _teste_ids);
DELETE FROM solicitacoes_empresa WHERE empresa_id IN (SELECT empresa_id FROM _teste_ids);

-- ── Agora sim, ninguém mais referencia esses parceiros ─────────────────
DELETE FROM parceiro_contatos WHERE parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id IN (SELECT empresa_id FROM _teste_ids));
DELETE FROM parceiros WHERE empresa_id IN (SELECT empresa_id FROM _teste_ids);

DELETE FROM usuarios WHERE id IN (SELECT usuario_id FROM _teste_ids);
DELETE FROM empresas WHERE id IN (SELECT empresa_id FROM _teste_ids);

-- Contas reais do Supabase Auth ligadas a essas contas de teste.
DELETE FROM auth.users WHERE id IN (SELECT auth_id FROM _teste_ids WHERE auth_id IS NOT NULL);

COMMIT;
