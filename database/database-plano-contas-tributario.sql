-- ============================================================
-- MARPEX — Plano de Contas: Bloco 6 (Tributário / Fiscal)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Versão 3 do PDF "MARPEX - PLANO DE CONTAS". Decidido com o usuário (2026-11-03),
-- com as recomendações da análise de 2026-10-20. `natureza` das 64 contas:
--   tributo  — tributos na aquisição (06.01–06.03): no lançamento, "Recuperável?"
--              Sim = crédito a recuperar (só controle) · Não = custo tributário
--   custo    — custo tributário efetivo (IE, outros tributos na exportação,
--              retenções no exterior, 06.09 não recuperáveis, ajuste negativo, perda de crédito)
--   ganho    — crédito/benefício realizado, lançado em Contas a Receber
--   controle — só registro (tratamento fiscal, saldos e créditos pendentes, regimes): fora do DRE
--   ambos    — 6.90.05 Outros efeitos tributários (pode ir para os dois lados)
-- DRE: Resultado antes dos tributos ± Resultado Tributário = Resultado Líquido.
-- Idempotente.
-- ============================================================

INSERT INTO plano_contas (bloco, bloco_nome, conta_codigo, conta_nome, codigo, subfator_nome, descricao, base, ordem, natureza) VALUES
(6,'TRIBUTÁRIO / FISCAL','06.01','TRIBUTOS NA AQUISIÇÃO DE BENS / MERCADORIAS','06.01.01','ICMS na Aquisição','Tributo destacado/embutido na aquisição','Base ICMS',1,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.01','TRIBUTOS NA AQUISIÇÃO DE BENS / MERCADORIAS','06.01.02','IPI na Aquisição','Quando existente na cadeia','Base IPI',2,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.01','TRIBUTOS NA AQUISIÇÃO DE BENS / MERCADORIAS','06.01.03','PIS na Aquisição','Crédito/custo conforme regime','Base aplicável',3,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.01','TRIBUTOS NA AQUISIÇÃO DE BENS / MERCADORIAS','06.01.04','COFINS na Aquisição','Crédito/custo conforme regime','Base aplicável',4,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.01','TRIBUTOS NA AQUISIÇÃO DE BENS / MERCADORIAS','06.01.05','ICMS-ST','Quando existente','Base aplicável',5,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.01','TRIBUTOS NA AQUISIÇÃO DE BENS / MERCADORIAS','06.01.06','DIFAL','Quando aplicável à operação de aquisição','Base aplicável',6,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.01','TRIBUTOS NA AQUISIÇÃO DE BENS / MERCADORIAS','06.01.07','Outros Tributos sobre Aquisição','Demais tributos diretamente vinculados','Base específica',7,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.02','TRIBUTOS NA AQUISIÇÃO DE SERVIÇOS NO BRASIL','06.02.01','ISS','Serviço adquirido','Valor serviço',8,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.02','TRIBUTOS NA AQUISIÇÃO DE SERVIÇOS NO BRASIL','06.02.02','IRRF / Retenções','Quando houver retenção vinculada','Base aplicável',9,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.02','TRIBUTOS NA AQUISIÇÃO DE SERVIÇOS NO BRASIL','06.02.03','PIS Retido','Quando aplicável','Base aplicável',10,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.02','TRIBUTOS NA AQUISIÇÃO DE SERVIÇOS NO BRASIL','06.02.04','COFINS Retida','Quando aplicável','Base aplicável',11,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.02','TRIBUTOS NA AQUISIÇÃO DE SERVIÇOS NO BRASIL','06.02.05','CSLL Retida','Quando aplicável','Base aplicável',12,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.02','TRIBUTOS NA AQUISIÇÃO DE SERVIÇOS NO BRASIL','06.02.06','INSS Retido','Quando aplicável ao serviço contratado','Base aplicável',13,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.02','TRIBUTOS NA AQUISIÇÃO DE SERVIÇOS NO BRASIL','06.02.07','Outros Tributos/Retenções','Conforme contratação','Base específica',14,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.03','AQUISIÇÃO / IMPORTAÇÃO DE SERVIÇOS DO EXTERIOR','06.03.01','IRRF','Remessa ao prestador estrangeiro','Base aplicável',15,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.03','AQUISIÇÃO / IMPORTAÇÃO DE SERVIÇOS DO EXTERIOR','06.03.02','CIDE','Quando incidente','Base aplicável',16,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.03','AQUISIÇÃO / IMPORTAÇÃO DE SERVIÇOS DO EXTERIOR','06.03.03','PIS-Importação','Importação de serviço','Base aplicável',17,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.03','AQUISIÇÃO / IMPORTAÇÃO DE SERVIÇOS DO EXTERIOR','06.03.04','COFINS-Importação','Importação de serviço','Base aplicável',18,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.03','AQUISIÇÃO / IMPORTAÇÃO DE SERVIÇOS DO EXTERIOR','06.03.05','ISS-Importação','Conforme legislação aplicável','Base aplicável',19,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.03','AQUISIÇÃO / IMPORTAÇÃO DE SERVIÇOS DO EXTERIOR','06.03.06','IOF-Câmbio','Operação cambial relacionada','Valor câmbio',20,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.03','AQUISIÇÃO / IMPORTAÇÃO DE SERVIÇOS DO EXTERIOR','06.03.07','Outros Tributos na Importação de Serviços','Conforme natureza','Base específica',21,'tributo'),
(6,'TRIBUTÁRIO / FISCAL','06.04','EXPORTAÇÃO DE BENS / MERCADORIAS','06.04.01','ICMS – Tratamento na Exportação','Identificação do tratamento fiscal','Valor operação',22,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.04','EXPORTAÇÃO DE BENS / MERCADORIAS','06.04.02','IPI – Tratamento na Exportação','Identificação do tratamento fiscal','Valor operação',23,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.04','EXPORTAÇÃO DE BENS / MERCADORIAS','06.04.03','PIS – Tratamento na Exportação','Identificação do tratamento fiscal','Receita',24,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.04','EXPORTAÇÃO DE BENS / MERCADORIAS','06.04.04','COFINS – Tratamento na Exportação','Identificação do tratamento fiscal','Receita',25,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.04','EXPORTAÇÃO DE BENS / MERCADORIAS','06.04.05','Imposto de Exportação – IE','Para produtos/operações sujeitos','Base legal',26,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.04','EXPORTAÇÃO DE BENS / MERCADORIAS','06.04.06','Outros Tributos sobre Exportação','Quando existentes','Base específica',27,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.05','EXPORTAÇÃO DE SERVIÇOS','06.05.01','ISS – Tratamento da Exportação','Conforme caracterização da exportação do serviço','Valor serviço',28,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.05','EXPORTAÇÃO DE SERVIÇOS','06.05.02','PIS – Tratamento da Exportação','Conforme enquadramento','Receita',29,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.05','EXPORTAÇÃO DE SERVIÇOS','06.05.03','COFINS – Tratamento da Exportação','Conforme enquadramento','Receita',30,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.05','EXPORTAÇÃO DE SERVIÇOS','06.05.04','Outros Tributos sobre Exportação de Serviços','Conforme natureza da operação','Base específica',31,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.06','TRIBUTOS / RETENÇÕES NO EXTERIOR','06.06.01','Withholding Tax – Serviços','Retenção efetuada no país do cliente','% faturamento',32,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.06','TRIBUTOS / RETENÇÕES NO EXTERIOR','06.06.02','Withholding Tax – Royalties / Licenças','Quando houver','% faturamento',33,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.06','TRIBUTOS / RETENÇÕES NO EXTERIOR','06.06.03','Retenção sobre Comissão','Quando existente no destino','%',34,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.06','TRIBUTOS / RETENÇÕES NO EXTERIOR','06.06.04','Outros Tributos Retidos no Exterior','Conforme país/operação','Base específica',35,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.06','TRIBUTOS / RETENÇÕES NO EXTERIOR','06.06.05','Crédito/Compensação de Tributo Pago no Exterior','Quando juridicamente permitido','Valor',36,'ganho'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.01','Crédito de ICMS','Crédito relacionado às aquisições/exportação','Valor',37,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.02','Crédito de IPI','Crédito relacionado','Valor',38,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.03','Crédito de PIS','Crédito relacionado','Valor',39,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.04','Crédito de COFINS','Crédito relacionado','Valor',40,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.05','Saldo Credor Vinculado à Exportação','Controle gerencial','Valor',41,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.06','Crédito Utilizado / Compensado','Efetivamente aproveitado','Valor',42,'ganho'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.07','Crédito Pendente de Aproveitamento','Ainda não realizado financeiramente','Valor',43,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.07','CRÉDITOS TRIBUTÁRIOS VINCULADOS À EXPORTAÇÃO','06.07.08','Outros Créditos Tributários','Conforme operação','Valor',44,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.08','BENEFÍCIOS / REGIMES ADUANEIROS E FISCAIS','06.08.01','Drawback Suspensão','Tributos suspensos','Valor',45,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.08','BENEFÍCIOS / REGIMES ADUANEIROS E FISCAIS','06.08.02','Drawback Isenção','Benefício apurado','Valor',46,'ganho'),
(6,'TRIBUTÁRIO / FISCAL','06.08','BENEFÍCIOS / REGIMES ADUANEIROS E FISCAIS','06.08.03','Drawback Restituição','Quando utilizado','Valor',47,'ganho'),
(6,'TRIBUTÁRIO / FISCAL','06.08','BENEFÍCIOS / REGIMES ADUANEIROS E FISCAIS','06.08.04','RECOF / Regime Especial','Quando aplicável','Valor',48,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.08','BENEFÍCIOS / REGIMES ADUANEIROS E FISCAIS','06.08.05','Entreposto Aduaneiro / Regime Especial','Quando aplicável','Valor',49,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.08','BENEFÍCIOS / REGIMES ADUANEIROS E FISCAIS','06.08.06','Incentivo Fiscal à Exportação','Benefício diretamente relacionado','Valor',50,'ganho'),
(6,'TRIBUTÁRIO / FISCAL','06.08','BENEFÍCIOS / REGIMES ADUANEIROS E FISCAIS','06.08.07','Outros Regimes Especiais','Conforme operação','Valor',51,'controle'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.01','ICMS Não Recuperável','Parcela efetivamente incorporada ao custo','Valor',52,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.02','IPI Não Recuperável','Parcela efetivamente incorporada','Valor',53,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.03','PIS Não Recuperável','Custo efetivo','Valor',54,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.04','COFINS Não Recuperável','Custo efetivo','Valor',55,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.05','ISS Não Recuperável','Custo efetivo','Valor',56,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.06','IOF Não Recuperável','Custo efetivo','Valor',57,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.07','Tributo no Exterior Não Compensável','Retenção que efetivamente reduz o resultado','Valor',58,'custo'),
(6,'TRIBUTÁRIO / FISCAL','06.09','TRIBUTOS NÃO RECUPERÁVEIS / CUSTO TRIBUTÁRIO EFETIVO','06.09.08','Outros Tributos Não Recuperáveis','Custo fiscal efetivo','Valor',59,'custo'),
(6,'TRIBUTÁRIO / FISCAL','6.90','AJUSTES / OUTROS EFEITOS FISCAIS','6.90.01','Ajuste Fiscal Positivo','Ajuste da operação','Valor',60,'ganho'),
(6,'TRIBUTÁRIO / FISCAL','6.90','AJUSTES / OUTROS EFEITOS FISCAIS','6.90.02','Ajuste Fiscal Negativo','Ajuste da operação','Valor',61,'custo'),
(6,'TRIBUTÁRIO / FISCAL','6.90','AJUSTES / OUTROS EFEITOS FISCAIS','6.90.03','Recuperação Tributária','Valor posteriormente recuperado','Valor',62,'ganho'),
(6,'TRIBUTÁRIO / FISCAL','6.90','AJUSTES / OUTROS EFEITOS FISCAIS','6.90.04','Perda de Crédito Tributário','Crédito que não poderá ser aproveitado','Valor',63,'custo'),
(6,'TRIBUTÁRIO / FISCAL','6.90','AJUSTES / OUTROS EFEITOS FISCAIS','6.90.05','Outros Efeitos Tributários','Não classificados anteriormente','Valor',64,'ambos')
ON CONFLICT (codigo) DO UPDATE SET natureza = EXCLUDED.natureza;

-- "Recuperável?" do tributo na aquisição (só contas de natureza 'tributo')
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS tributo_recuperavel BOOLEAN;
COMMENT ON COLUMN contas_pagar.tributo_recuperavel IS 'Tributo na aquisição (Bloco 6): true = crédito a recuperar (fora do DRE), false = custo tributário';

-- Verificação: Bloco 6 = 64 contas (21 tributo, 18 controle, 17 custo, 7 ganho, 1 ambos)
SELECT natureza, count(*) AS contas FROM plano_contas WHERE bloco = 6 GROUP BY natureza ORDER BY natureza;
