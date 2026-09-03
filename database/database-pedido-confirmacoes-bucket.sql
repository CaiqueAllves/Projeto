-- Bucket público pro PDF de confirmação que vai por e-mail pro cliente quando
-- uma Proposta fechada vira Pedido (ver pedidos.js: _pedEnviarConfirmacaoEmail).
-- Público de propósito: o cliente que recebe o e-mail não é um usuário
-- logado no sistema, precisa conseguir abrir o link sem autenticação.

INSERT INTO storage.buckets (id, name, public)
VALUES ('pedido-confirmacoes', 'pedido-confirmacoes', true)
ON CONFLICT (id) DO NOTHING;

-- Upload só por quem está autenticado no sistema (o cliente nunca escreve
-- aqui, só lê via link público) — mesmo padrão das tabelas normais depois
-- da migração de RLS real (auth.uid(), não mais TO anon).
DROP POLICY IF EXISTS "pedido_confirmacoes_insert_auth" ON storage.objects;
CREATE POLICY "pedido_confirmacoes_insert_auth" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'pedido-confirmacoes');

DROP POLICY IF EXISTS "pedido_confirmacoes_select_auth" ON storage.objects;
CREATE POLICY "pedido_confirmacoes_select_auth" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'pedido-confirmacoes');
