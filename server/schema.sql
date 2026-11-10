-- Modelo de dados do agendamento (ver docs/03-modelagem-do-banco.md)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tutor (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 80),
  telefone  TEXT NOT NULL UNIQUE CHECK (length(telefone) BETWEEN 10 AND 11), -- só dígitos, com DDD
  email     TEXT CHECK (email IS NULL OR length(email) <= 120),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pet (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tutor_id    INTEGER NOT NULL REFERENCES tutor(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL CHECK (length(nome) BETWEEN 1 AND 60),
  especie     TEXT NOT NULL DEFAULT 'cao' CHECK (especie IN ('cao', 'gato')),
  raca        TEXT CHECK (raca IS NULL OR length(raca) <= 60),
  porte       TEXT NOT NULL CHECK (porte IN ('pequeno', 'medio', 'grande')),
  observacoes TEXT CHECK (observacoes IS NULL OR length(observacoes) <= 300),
  criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tutor_id, nome)
);

CREATE TABLE IF NOT EXISTS servico (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),  -- para pet de porte pequeno
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS agendamento (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo        TEXT NOT NULL UNIQUE,            -- código secreto da confirmação (ex.: K7M2QX9P)
  tutor_id      INTEGER NOT NULL REFERENCES tutor(id),
  pet_id        INTEGER NOT NULL REFERENCES pet(id),
  data          TEXT NOT NULL CHECK (data GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  inicio_min    INTEGER NOT NULL CHECK (inicio_min BETWEEN 0 AND 1439),
  fim_min       INTEGER NOT NULL CHECK (fim_min BETWEEN 1 AND 1440),
  status        TEXT NOT NULL DEFAULT 'confirmado'
                CHECK (status IN ('confirmado', 'cancelado', 'concluido', 'faltou')),
  observacoes   TEXT CHECK (observacoes IS NULL OR length(observacoes) <= 300),
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (fim_min > inicio_min)
);

CREATE INDEX IF NOT EXISTS idx_agendamento_data ON agendamento (data, status);
CREATE INDEX IF NOT EXISTS idx_agendamento_pet  ON agendamento (pet_id, data);

CREATE TABLE IF NOT EXISTS agendamento_servico (
  agendamento_id INTEGER NOT NULL REFERENCES agendamento(id) ON DELETE CASCADE,
  servico_id     INTEGER NOT NULL REFERENCES servico(id),
  PRIMARY KEY (agendamento_id, servico_id)
);
