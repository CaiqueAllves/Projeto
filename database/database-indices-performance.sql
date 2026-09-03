-- Fase 0 do plano de performance: índice no campo de tenant (empresa) das
-- tabelas de listagem principais. Toda tela do sistema (Pedidos, Processos,
-- Proposta/Pipeline, Contas a Pagar/Receber, Produtos, Parceiros) faz um
-- WHERE empresa_(proprietaria_)id = ... em praticamente todo carregamento
-- de página — sem índice nessa coluna, o Postgres faz sequential scan na
-- tabela inteira a cada consulta, e isso piora conforme o volume de dados
-- cresce (o efeito não aparece com poucos registros de teste, só em uso
-- real depois de meses).
--
-- pedidos e oportunidades são as 2 que realmente faltavam (nenhum arquivo
-- database-*.sql versionado tinha índice nelas). As outras 5 já tinham
-- índice no arquivo original — CREATE INDEX IF NOT EXISTS aqui é só
-- reforço/seguro, não deve fazer nada se já existirem.

CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_proprietaria       ON pedidos(empresa_proprietaria_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_empresa_proprietaria ON oportunidades(empresa_proprietaria_id);
CREATE INDEX IF NOT EXISTS idx_processos_empresa_proprietaria     ON processos(empresa_proprietaria_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa               ON contas_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa             ON contas_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa                   ON produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_parceiros_empresa                  ON parceiros(empresa_id);
