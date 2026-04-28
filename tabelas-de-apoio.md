# Tabelas de Apoio — Marpex

Documentação das 8 tabelas de referência disponíveis no módulo **Apoio**.
Todas são carregadas dinamicamente em `apoio.html` via parâmetro `?tab=<chave>`.

---

## Arquitetura

| Arquivo       | Função |
|---------------|--------|
| `apoio.html`  | Shell único — estrutura de layout, sidebar, topbar, card dinâmico |
| `apoio.js`    | Loader dinâmico — lê `?tab=`, busca no Supabase, renderiza tabela |
| `style-apoio.css` | Estilos do módulo |

### Como adicionar uma nova tabela

1. Criar a tabela no Supabase (SQL abaixo).
2. Adicionar o objeto de configuração em `TABELAS_CONFIG` dentro de `apoio.js`.
3. Remover a flag `em_breve: true` da entrada correspondente.
4. Atualizar o link no sidebar de `apoio.html` (já aponta para `apoio.html?tab=<chave>`).

---

## 1. Países e Regiões (`?tab=paises`)

**Status:** Implementada
**Tabela Supabase:** `paises`

### SQL — Criação da tabela

```sql
-- =============================================
-- TABELA: paises
-- Países e regiões geográficas do mundo
-- =============================================
CREATE TABLE IF NOT EXISTS paises (
    id          SERIAL        PRIMARY KEY,
    codigo_iso2 CHAR(2)       NOT NULL UNIQUE,   -- Ex: BR, US, DE
    codigo_iso3 CHAR(3)       UNIQUE,             -- Ex: BRA, USA, DEU
    codigo_num  CHAR(3),                          -- Código numérico ONU (Ex: 076)
    nome_pt     VARCHAR(120)  NOT NULL,           -- Nome em português
    nome_en     VARCHAR(120),                     -- Nome em inglês
    regiao      VARCHAR(80),                      -- Américas, Europa, Ásia, África, Oceania
    sub_regiao  VARCHAR(100),                     -- América do Sul, Europa Ocidental...
    ativo       BOOLEAN       DEFAULT TRUE,
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_paises_codigo_iso2 ON paises(codigo_iso2);
CREATE INDEX IF NOT EXISTS idx_paises_codigo_iso3 ON paises(codigo_iso3);
CREATE INDEX IF NOT EXISTS idx_paises_nome_pt     ON paises(nome_pt);
CREATE INDEX IF NOT EXISTS idx_paises_regiao      ON paises(regiao);

-- RLS: leitura pública (os dados são de referência)
ALTER TABLE paises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de paises"
    ON paises FOR SELECT USING (true);
```

### SQL — Dados de exemplo

```sql
INSERT INTO paises (codigo_iso2, codigo_iso3, codigo_num, nome_pt, nome_en, regiao, sub_regiao) VALUES
('AF', 'AFG', '004', 'Afeganistão',         'Afghanistan',          'Ásia',    'Ásia Meridional'),
('AL', 'ALB', '008', 'Albânia',             'Albania',              'Europa',  'Europa do Sul'),
('DE', 'DEU', '276', 'Alemanha',            'Germany',              'Europa',  'Europa Ocidental'),
('SA', 'SAU', '682', 'Arábia Saudita',      'Saudi Arabia',         'Ásia',    'Ásia Ocidental'),
('AR', 'ARG', '032', 'Argentina',           'Argentina',            'Américas','América do Sul'),
('AU', 'AUS', '036', 'Austrália',           'Australia',            'Oceania', 'Austrália e Nova Zelândia'),
('AT', 'AUT', '040', 'Áustria',             'Austria',              'Europa',  'Europa Ocidental'),
('BE', 'BEL', '056', 'Bélgica',             'Belgium',              'Europa',  'Europa Ocidental'),
('BO', 'BOL', '068', 'Bolívia',             'Bolivia',              'Américas','América do Sul'),
('BR', 'BRA', '076', 'Brasil',              'Brazil',               'Américas','América do Sul'),
('CA', 'CAN', '124', 'Canadá',              'Canada',               'Américas','América do Norte'),
('CL', 'CHL', '152', 'Chile',              'Chile',                'Américas','América do Sul'),
('CN', 'CHN', '156', 'China',              'China',                'Ásia',    'Ásia Oriental'),
('CO', 'COL', '170', 'Colômbia',           'Colombia',             'Américas','América do Sul'),
('KR', 'KOR', '410', 'Coreia do Sul',      'South Korea',          'Ásia',    'Ásia Oriental'),
('HR', 'HRV', '191', 'Croácia',            'Croatia',              'Europa',  'Europa do Sul'),
('CU', 'CUB', '192', 'Cuba',              'Cuba',                 'Américas','Caribe'),
('DK', 'DNK', '208', 'Dinamarca',          'Denmark',              'Europa',  'Europa do Norte'),
('EG', 'EGY', '818', 'Egito',             'Egypt',                'África',  'África do Norte'),
('AE', 'ARE', '784', 'Emirados Árabes Unidos','United Arab Emirates','Ásia', 'Ásia Ocidental'),
('ES', 'ESP', '724', 'Espanha',            'Spain',                'Europa',  'Europa do Sul'),
('US', 'USA', '840', 'Estados Unidos',     'United States',        'Américas','América do Norte'),
('FR', 'FRA', '250', 'França',             'France',               'Europa',  'Europa Ocidental'),
('GR', 'GRC', '300', 'Grécia',             'Greece',               'Europa',  'Europa do Sul'),
('IN', 'IND', '356', 'Índia',              'India',                'Ásia',    'Ásia Meridional'),
('ID', 'IDN', '360', 'Indonésia',          'Indonesia',            'Ásia',    'Sudeste Asiático'),
('IE', 'IRL', '372', 'Irlanda',            'Ireland',              'Europa',  'Europa do Norte'),
('IL', 'ISR', '376', 'Israel',             'Israel',               'Ásia',    'Ásia Ocidental'),
('IT', 'ITA', '380', 'Itália',             'Italy',                'Europa',  'Europa do Sul'),
('JP', 'JPN', '392', 'Japão',              'Japan',                'Ásia',    'Ásia Oriental'),
('MX', 'MEX', '484', 'México',             'Mexico',               'Américas','América do Norte'),
('NO', 'NOR', '578', 'Noruega',            'Norway',               'Europa',  'Europa do Norte'),
('NL', 'NLD', '528', 'Países Baixos',      'Netherlands',          'Europa',  'Europa Ocidental'),
('PK', 'PAK', '586', 'Paquistão',          'Pakistan',             'Ásia',    'Ásia Meridional'),
('PE', 'PER', '604', 'Peru',               'Peru',                 'Américas','América do Sul'),
('PL', 'POL', '616', 'Polônia',            'Poland',               'Europa',  'Europa Oriental'),
('PT', 'PRT', '620', 'Portugal',           'Portugal',             'Europa',  'Europa do Sul'),
('GB', 'GBR', '826', 'Reino Unido',        'United Kingdom',       'Europa',  'Europa do Norte'),
('RU', 'RUS', '643', 'Rússia',             'Russia',               'Europa',  'Europa Oriental'),
('SE', 'SWE', '752', 'Suécia',             'Sweden',               'Europa',  'Europa do Norte'),
('CH', 'CHE', '756', 'Suíça',              'Switzerland',          'Europa',  'Europa Ocidental'),
('TR', 'TUR', '792', 'Turquia',            'Turkey',               'Ásia',    'Ásia Ocidental'),
('UA', 'UKR', '804', 'Ucrânia',            'Ukraine',              'Europa',  'Europa Oriental'),
('UY', 'URY', '858', 'Uruguai',            'Uruguay',              'Américas','América do Sul'),
('VE', 'VEN', '862', 'Venezuela',          'Venezuela',            'Américas','América do Sul'),
('ZA', 'ZAF', '710', 'África do Sul',      'South Africa',         'África',  'África Austral')
ON CONFLICT (codigo_iso2) DO NOTHING;
```

---

## 2. Portos e Armadores (`?tab=portos`)

**Status:** Em breve
**Tabela Supabase:** `portos`

```sql
CREATE TABLE IF NOT EXISTS portos (
    id          SERIAL        PRIMARY KEY,
    codigo_unlo VARCHAR(10)   NOT NULL UNIQUE, -- Código UN/LOCODE (Ex: BRSSZ, CNSHA)
    nome        VARCHAR(150)  NOT NULL,
    cidade      VARCHAR(100),
    pais_iso2   CHAR(2),                       -- FK para paises.codigo_iso2
    tipo        VARCHAR(20)   DEFAULT 'porto', -- porto | terminal | armador
    ativo       BOOLEAN       DEFAULT TRUE,
    created_at  TIMESTAMPTZ   DEFAULT NOW(),
    FOREIGN KEY (pais_iso2) REFERENCES paises(codigo_iso2)
);
CREATE INDEX IF NOT EXISTS idx_portos_codigo  ON portos(codigo_unlo);
CREATE INDEX IF NOT EXISTS idx_portos_pais    ON portos(pais_iso2);
ALTER TABLE portos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de portos" ON portos FOR SELECT USING (true);
```

---

## 3. Aeroportos e Cias Aéreas (`?tab=aeroportos`)

**Status:** Em breve
**Tabela Supabase:** `aeroportos`

```sql
CREATE TABLE IF NOT EXISTS aeroportos (
    id          SERIAL       PRIMARY KEY,
    codigo_iata CHAR(3)      UNIQUE,           -- Ex: GRU, JFK, FRA
    codigo_icao CHAR(4)      UNIQUE,           -- Ex: SBGR, KJFK, EDDF
    nome        VARCHAR(150) NOT NULL,
    cidade      VARCHAR(100),
    pais_iso2   CHAR(2),
    tipo        VARCHAR(20)  DEFAULT 'aeroporto', -- aeroporto | cia_aerea
    ativo       BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    FOREIGN KEY (pais_iso2) REFERENCES paises(codigo_iso2)
);
ALTER TABLE aeroportos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de aeroportos" ON aeroportos FOR SELECT USING (true);
```

---

## 4. Moedas (`?tab=moedas`)

**Status:** Em breve
**Tabela Supabase:** `moedas`

```sql
CREATE TABLE IF NOT EXISTS moedas (
    id          SERIAL       PRIMARY KEY,
    codigo_iso  CHAR(3)      NOT NULL UNIQUE,  -- Ex: BRL, USD, EUR
    simbolo     VARCHAR(5),                     -- Ex: R$, $, €
    nome_pt     VARCHAR(100) NOT NULL,
    nome_en     VARCHAR(100),
    pais_iso2   CHAR(2),                        -- País principal de uso
    ativo       BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE moedas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de moedas" ON moedas FOR SELECT USING (true);
```

---

## 5. Embalagens (`?tab=embalagens`)

**Status:** Em breve
**Tabela Supabase:** `embalagens`

```sql
CREATE TABLE IF NOT EXISTS embalagens (
    id          SERIAL       PRIMARY KEY,
    codigo      VARCHAR(10)  NOT NULL UNIQUE,
    descricao   VARCHAR(200) NOT NULL,
    unidade     VARCHAR(20),                    -- UN, CX, PCT, KG...
    ativo       BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE embalagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de embalagens" ON embalagens FOR SELECT USING (true);
```

---

## 6. Termos de Pagamentos (`?tab=termos-pagamento`)

**Status:** Em breve
**Tabela Supabase:** `termos_pagamento`

```sql
CREATE TABLE IF NOT EXISTS termos_pagamento (
    id          SERIAL       PRIMARY KEY,
    codigo      VARCHAR(20)  NOT NULL UNIQUE,   -- Ex: CAD, DA, LC, TT
    descricao   VARCHAR(200) NOT NULL,
    ativo       BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE termos_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de termos_pagamento" ON termos_pagamento FOR SELECT USING (true);
```

---

## 7. Acondicionamento e Container (`?tab=acondicionamento`)

**Status:** Configurada — aguardando dados no Supabase
**Tabela Supabase:** `acondicionamento`
**Fonte:** Planilha interna (110 registros)

Colunas da planilha:
- **Nº** — número sequencial (1–110)
- **Identificação** — sigla do container (ex: `22B1`)
- **Descrição** — descrição completa (ex: `BULK, NON-PRESSURIZED, HOPPER, AIRTIGHT`)
- **Capacidade** — ex: `20 pés`, `40 pés`

```sql
CREATE TABLE IF NOT EXISTS acondicionamento (
    id            SERIAL        PRIMARY KEY,
    numero        SMALLINT      NOT NULL UNIQUE,  -- Nº 1 ao 110
    identificacao VARCHAR(20)   NOT NULL,          -- Sigla ex: 22B1
    descricao     VARCHAR(300)  NOT NULL,          -- Ex: BULK, NON-PRESSURIZED...
    capacidade    VARCHAR(50),                     -- Ex: 20 pés, 40 pés
    ativo         BOOLEAN       DEFAULT TRUE,
    created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acond_numero        ON acondicionamento(numero);
CREATE INDEX IF NOT EXISTS idx_acond_identificacao ON acondicionamento(identificacao);

ALTER TABLE acondicionamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de acondicionamento"
    ON acondicionamento FOR SELECT USING (true);
```

---

## 8. NCM (`?tab=ncm`)

**Status:** Em breve
**Tabela Supabase:** `ncm`

```sql
CREATE TABLE IF NOT EXISTS ncm (
    id          SERIAL       PRIMARY KEY,
    codigo      VARCHAR(10)  NOT NULL UNIQUE,   -- Ex: 8471.30.19
    descricao   VARCHAR(500) NOT NULL,
    capitulo    VARCHAR(5),                     -- Primeiros 2 dígitos
    unidade_med VARCHAR(10),                    -- KG, UN, L...
    ii          NUMERIC(5,2),                   -- Alíquota Imp. Importação (%)
    ipi         NUMERIC(5,2),
    ativo       BOOLEAN      DEFAULT TRUE,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ncm_codigo   ON ncm(codigo);
CREATE INDEX IF NOT EXISTS idx_ncm_capitulo ON ncm(capitulo);
ALTER TABLE ncm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de NCM" ON ncm FOR SELECT USING (true);
```
