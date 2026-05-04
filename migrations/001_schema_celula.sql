-- =============================================================================
-- Visão Célula — Schema PostgreSQL
-- Migração 001 · inicial
-- =============================================================================

-- Enum de níveis de acesso
DO $$ BEGIN
    CREATE TYPE nivel_acesso AS ENUM (
        'administrador',
        'pastor_presidente',
        'lider_macro',
        'lider_celula',
        'secretario',
        'observer'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Usuários do portal (login)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(100) NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    senha_hash    VARCHAR(255) NOT NULL,       -- SHA-256 hex da senha
    nivel         nivel_acesso NOT NULL DEFAULT 'observer',
    foto_url      VARCHAR(255),
    ativo         BOOLEAN DEFAULT TRUE,
    criado_em     TIMESTAMP DEFAULT NOW(),
    ultimo_acesso TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Igrejas (tenant principal do sistema)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS igrejas (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL,
    razao_social    VARCHAR(100),
    cnpj            VARCHAR(18),
    endereco        VARCHAR(100),
    numero          VARCHAR(10),
    bairro          VARCHAR(50),
    cidade          VARCHAR(60),
    uf              CHAR(2),
    cep             VARCHAR(10),
    telefone        VARCHAR(20),
    email           VARCHAR(60),
    foto_url        VARCHAR(255),
    data_fundacao   DATE,
    latitude        VARCHAR(20),
    longitude       VARCHAR(20),
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Vínculos usuário ↔ Igreja
-- Um usuário pode ter acesso a várias igrejas com níveis distintos.
-- O campo `nivel` aqui sobrescreve o `nivel` padrão do usuário para esta igreja.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vinculos_usuario_igreja (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    igreja_id   INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    nivel       nivel_acesso,
    ativo       BOOLEAN DEFAULT TRUE,
    criado_em   TIMESTAMP DEFAULT NOW(),
    UNIQUE(usuario_id, igreja_id)
);

-- -----------------------------------------------------------------------------
-- Grupos de pastor
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grupos_pastor (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    igreja_id   INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    criado_em   TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Pastores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pastores (
    id              SERIAL PRIMARY KEY,
    grupo_pastor_id INTEGER REFERENCES grupos_pastor(id),
    nome            VARCHAR(100) NOT NULL,
    email           VARCHAR(60),
    telefone        VARCHAR(20),
    celular         VARCHAR(20),
    cpf             VARCHAR(14),
    data_nascimento DATE,
    sexo            VARCHAR(10),
    estado_civil    VARCHAR(20),
    endereco        VARCHAR(100),
    numero          VARCHAR(10),
    bairro          VARCHAR(50),
    cidade          VARCHAR(60),
    uf              CHAR(2),
    cep             VARCHAR(10),
    foto_url        VARCHAR(255),
    titular         BOOLEAN DEFAULT FALSE,
    ativo           BOOLEAN DEFAULT TRUE,
    igreja_id       INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    criado_em       TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Macrocélulas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS macrocelulas (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    tipo        VARCHAR(30),
    lider_id    INTEGER REFERENCES usuarios(id),
    igreja_id   INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    ativo       BOOLEAN DEFAULT TRUE,
    criado_em   TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Tipos de célula
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_celula (
    id               SERIAL PRIMARY KEY,
    nome             VARCHAR(80) NOT NULL,
    reuniao_governo  BOOLEAN DEFAULT FALSE,
    igreja_id        INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    criado_em        TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Células
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS celulas (
    id                  SERIAL PRIMARY KEY,
    nome                VARCHAR(100) NOT NULL,
    macrocelula_id      INTEGER REFERENCES macrocelulas(id),
    tipo_celula_id      INTEGER REFERENCES tipos_celula(id),
    lider_id            INTEGER REFERENCES usuarios(id),
    timoteo_id          INTEGER REFERENCES usuarios(id),
    anfitriao_id        INTEGER REFERENCES usuarios(id),
    secretario_id       INTEGER REFERENCES usuarios(id),
    endereco            VARCHAR(100),
    numero              VARCHAR(10),
    bairro              VARCHAR(50),
    cidade              VARCHAR(60),
    uf                  CHAR(2),
    cep                 VARCHAR(10),
    telefone            VARCHAR(20),
    dia_semana          VARCHAR(15),
    hora                VARCHAR(5),
    tipo                VARCHAR(20),
    status              VARCHAR(25) DEFAULT 'Ativa',
    tipo_lancamento     VARCHAR(12) DEFAULT 'Secretaria',
    latitude            VARCHAR(20),
    longitude           VARCHAR(20),
    ativo               BOOLEAN DEFAULT TRUE,
    data_desativacao    TIMESTAMP,
    motivo_desativacao  TEXT,
    igreja_id           INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    criado_em           TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Membros / Discípulos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS membros (
    id                   SERIAL PRIMARY KEY,
    nome                 VARCHAR(100) NOT NULL,
    email                VARCHAR(60),
    telefone             VARCHAR(20),
    celular              VARCHAR(20),
    cpf                  VARCHAR(14),
    data_nascimento      DATE,
    sexo                 VARCHAR(10),
    estado_civil         VARCHAR(20),
    endereco             VARCHAR(100),
    numero               VARCHAR(10),
    bairro               VARCHAR(50),
    cidade               VARCHAR(60),
    uf                   CHAR(2),
    cep                  VARCHAR(10),
    foto_url             VARCHAR(255),
    -- vínculos hierárquicos
    celula_id            INTEGER REFERENCES celulas(id),
    macrocelula_id       INTEGER REFERENCES macrocelulas(id),
    igreja_id            INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    lider_id             INTEGER REFERENCES membros(id),
    -- dados espirituais
    batizado             BOOLEAN DEFAULT FALSE,
    data_batismo         DATE,
    libertacao           BOOLEAN DEFAULT FALSE,
    encontro             BOOLEAN DEFAULT FALSE,
    reencontro           BOOLEAN DEFAULT FALSE,
    consolidado          BOOLEAN DEFAULT FALSE,
    data_consolidacao    DATE,
    data_libertacao      DATE,
    data_encontro        DATE,
    data_reencontro      DATE,
    escola_lider         VARCHAR(20),
    nivel_escola_lider   VARCHAR(10),
    profissao            VARCHAR(100),
    situacao_celular     VARCHAR(15),
    transferido          BOOLEAN DEFAULT FALSE,
    data_transferencia   DATE,
    motivo_transferencia TEXT,
    obs                  TEXT,
    ativo                BOOLEAN DEFAULT TRUE,
    criado_em            TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Lançamentos de célula
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lancamentos_celula (
    id              SERIAL PRIMARY KEY,
    celula_id       INTEGER REFERENCES celulas(id),
    macrocelula_id  INTEGER REFERENCES macrocelulas(id),
    lider_id        INTEGER REFERENCES membros(id),
    data_lancamento TIMESTAMP DEFAULT NOW(),
    data_da_celula  TIMESTAMP,
    num_presentes   NUMERIC(9,2) DEFAULT 0,
    num_ausentes    NUMERIC(9,2) DEFAULT 0,
    num_visitantes  NUMERIC(9,2) DEFAULT 0,
    num_membros     NUMERIC(9,2) DEFAULT 0,
    total_na_celula NUMERIC(9,2) DEFAULT 0,
    valor_oferta    NUMERIC(9,2) DEFAULT 0,
    tema_estudado   VARCHAR(150),
    hora            VARCHAR(5),
    mes             INTEGER,
    ano             INTEGER,
    tipo            VARCHAR(25),
    situacao        VARCHAR(25) DEFAULT 'Pendente',
    pre_lancamento  BOOLEAN DEFAULT FALSE,
    confirmado      BOOLEAN DEFAULT FALSE,
    tipo_lancamento VARCHAR(12) DEFAULT 'Secretaria',
    obs             TEXT,
    celula_em_dia   BOOLEAN,
    celula_atraso   BOOLEAN,
    igreja_id       INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    criado_em       TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Tipos de evento
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_evento (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    igreja_id   INTEGER REFERENCES igrejas(id) ON DELETE CASCADE,
    criado_em   TIMESTAMP DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Eventos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(120) NOT NULL,
    tipo_evento_id  INTEGER REFERENCES tipos_evento(id),
    data            TIMESTAMP,
    data_final      TIMESTAMP,
    hora            VARCHAR(10),
    local           VARCHAR(100),
    investimento    NUMERIC(9,2) DEFAULT 0,
    cor             VARCHAR(10),
    obs             TEXT,
    igreja_id       INTEGER REFERENCES igrejas(id) ON DELETE CASCADE,
    criado_em       TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- Índices (performance + isolamento multi-tenant)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_vinculos_usuario     ON vinculos_usuario_igreja(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_igreja      ON vinculos_usuario_igreja(igreja_id);
CREATE INDEX IF NOT EXISTS idx_macrocelulas_igreja  ON macrocelulas(igreja_id);
CREATE INDEX IF NOT EXISTS idx_celulas_macro        ON celulas(macrocelula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_igreja       ON celulas(igreja_id);
CREATE INDEX IF NOT EXISTS idx_membros_celula       ON membros(celula_id);
CREATE INDEX IF NOT EXISTS idx_membros_macro        ON membros(macrocelula_id);
CREATE INDEX IF NOT EXISTS idx_membros_igreja       ON membros(igreja_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_celula   ON lancamentos_celula(celula_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_mes_ano  ON lancamentos_celula(mes, ano);
CREATE INDEX IF NOT EXISTS idx_lancamentos_igreja   ON lancamentos_celula(igreja_id);
CREATE INDEX IF NOT EXISTS idx_pastores_igreja      ON pastores(igreja_id);
CREATE INDEX IF NOT EXISTS idx_grupos_pastor_igreja ON grupos_pastor(igreja_id);

-- =============================================================================
-- Usuário administrador inicial (senha: admin123 → sha256)
-- Troque a senha ANTES de colocar em produção.
-- =============================================================================
INSERT INTO usuarios (nome, email, senha_hash, nivel, ativo)
VALUES (
    'Administrador',
    'admin@visao.local',
    'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- '123'
    'administrador',
    TRUE
) ON CONFLICT (email) DO NOTHING;
