import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));

// Serviços do salão (os mesmos da página inicial). Duração em minutos
// para um pet de porte pequeno — o porte maior aumenta o tempo.
export const SERVICOS_INICIAIS = [
  { codigo: "banho",            nome: "Banho",              duracao_min: 60, descricao: "Banho completo com produtos adequados à pelagem." },
  { codigo: "tosa-higienica",   nome: "Tosa higiênica",     duracao_min: 30, descricao: "Aparo das áreas íntimas, patinhas e rosto." },
  { codigo: "tosa-tesoura",     nome: "Tosa na tesoura",    duracao_min: 90, descricao: "Modelagem na tesoura respeitando a raça." },
  { codigo: "hidratacao",       nome: "Hidratação",         duracao_min: 30, descricao: "Repõe os nutrientes do pelo." },
  { codigo: "corte-unhas",      nome: "Corte de unhas",     duracao_min: 15, descricao: "Corte seguro das unhas." },
  { codigo: "limpeza-ouvidos",  nome: "Limpeza de ouvidos", duracao_min: 15, descricao: "Higienização cuidadosa dos ouvidos." },
];

/** Abre (e cria, se preciso) o banco. Use ":memory:" nos testes. */
export function abrirBanco(caminho) {
  if (caminho !== ":memory:") mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(readFileSync(`${aqui}/schema.sql`, "utf8"));
  semearServicos(db);
  return db;
}

function semearServicos(db) {
  const ins = db.prepare(
    `INSERT INTO servico (codigo, nome, descricao, duracao_min) VALUES (?, ?, ?, ?)
     ON CONFLICT(codigo) DO NOTHING`
  );
  for (const s of SERVICOS_INICIAIS) ins.run(s.codigo, s.nome, s.descricao, s.duracao_min);
}

/** Executa `fn` numa transação que já "reserva" o banco para escrita. */
export function transacao(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
