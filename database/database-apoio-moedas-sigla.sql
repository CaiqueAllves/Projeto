-- ============================================================
-- MARPEX — apoio_moedas.sigla (código ISO 4217 alfa-3)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: apoio_moedas.codigo não é o código ISO 4217 numérico
-- oficial — é um ID interno arbitrário (guardado como texto, por
-- isso a ordenação mistura "149", "15", "150"). Os campos "moeda"
-- espalhados pelo sistema (pedidos, contas_pagar, contas_receber)
-- esperam uma sigla de 3 letras (USD, BRL, EUR...), então esta
-- migração adiciona essa sigla derivada do nome de cada moeda.
--
-- Mapeamento feito a partir da descrição de cada uma das 157
-- moedas cadastradas. Alguns poucos casos são de melhor esforço
-- (moeda descontinuada/ambígua): 134 (Dinar/Sudão -> SDG, moeda
-- atual), 149 (Dobra -> STN, nova), 500 (Leone -> SLE, nova),
-- 670/671 (Uguia Mauritânia, mesmo nome nas duas linhas -> MRU),
-- 796 ("Renminbi Hong Kong", não é código oficial -> CNH, convenção
-- de mercado para o yuan offshore), 998 ("Dolar Ouro" -> XAU, ouro).
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE apoio_moedas ADD COLUMN IF NOT EXISTS sigla CHAR(3);

UPDATE apoio_moedas AS m
SET sigla = v.sigla
FROM (VALUES
    ('100','KWD'), ('105','BHD'), ('115','IQD'), ('125','JOD'), ('130','LYD'),
    ('132','MKD'), ('133','RSD'), ('134','SDG'), ('135','TND'), ('136','SSP'),
    ('138','XDR'), ('139','MAD'), ('145','AED'), ('149','STN'), ('15','THB'),
    ('150','AUD'), ('155','BSD'), ('160','BMD'), ('165','CAD'), ('170','GYD'),
    ('173','NAD'), ('175','BBD'), ('180','BZD'), ('185','BND'), ('190','KYD'),
    ('195','SGD'), ('197','CLF'), ('20','PAB'),  ('200','FJD'), ('205','HKD'),
    ('210','TTD'), ('215','XCD'), ('220','USD'), ('230','JMD'), ('235','LRD'),
    ('245','NZD'), ('250','SBD'), ('255','SRD'), ('260','VND'), ('27','VES'),
    ('275','AMD'), ('295','CVE'), ('30','BOB'),  ('325','ANG'), ('328','AWG'),
    ('345','HUF'), ('35','GHS'),  ('363','CDF'), ('365','BIF'), ('368','KMF'),
    ('370','XAF'), ('372','XOF'), ('380','XPF'), ('390','DJF'), ('398','GNF'),
    ('40','CRC'),  ('406','MGA'), ('420','RWF'), ('425','CHF'), ('440','HTG'),
    ('45','SVC'),  ('450','PYG'), ('460','UAH'), ('470','JPY'), ('482','GEL'),
    ('490','ALL'), ('495','HNL'), ('5','AFN'),   ('500','SLE'), ('503','MDL'),
    ('506','RON'), ('51','NIO'),  ('510','BGN'), ('530','GIP'), ('535','EGP'),
    ('540','GBP'), ('545','FKP'), ('55','DKK'),  ('560','LBP'), ('570','SHP'),
    ('575','SYP'), ('585','SZL'), ('60','ISK'),  ('603','LSL'), ('608','TMT'),
    ('622','MZN'), ('625','ERN'), ('630','NGN'), ('635','AOA'), ('640','TWD'),
    ('642','TRY'), ('65','NOK'),  ('660','PEN'), ('665','BTN'), ('670','MRU'),
    ('671','MRU'), ('680','TOP'), ('685','MOP'), ('70','SEK'),  ('706','ARS'),
    ('715','CLP'), ('720','COP'), ('721','COU'), ('725','CUP'), ('730','DOP'),
    ('735','PHP'), ('741','MXN'), ('745','UYU'), ('75','CZK'),  ('755','BWP'),
    ('760','MWK'), ('766','ZMW'), ('770','GTQ'), ('775','MMK'), ('778','PGK'),
    ('780','LAK'), ('785','ZAR'), ('790','BRL'), ('795','CNY'), ('796','CNH'),
    ('800','QAR'), ('805','OMR'), ('810','YER'), ('815','IRR'), ('820','SAR'),
    ('825','KHR'), ('828','MYR'), ('830','RUB'), ('831','BYN'), ('835','TJS'),
    ('840','MUR'), ('845','NPR'), ('850','SCR'), ('855','LKR'), ('860','INR'),
    ('865','IDR'), ('870','MVR'), ('875','PKR'), ('880','ILS'), ('892','KGS'),
    ('893','UZS'), ('9','ETB'),   ('90','GMD'),  ('905','BDT'), ('912','WST'),
    ('913','KZT'), ('915','MNT'), ('920','VUV'), ('930','KRW'), ('946','TZS'),
    ('95','DZD'),  ('950','KES'), ('955','UGX'), ('960','SOS'), ('975','PLN'),
    ('978','EUR'), ('998','XAU')
) AS v(codigo, sigla)
WHERE m.codigo = v.codigo;
