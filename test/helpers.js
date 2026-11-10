import { abrirBanco } from "../server/db.js";
import { criarApp } from "../server/app.js";

// "Hoje" fixo nos testes: terça-feira, 10/11/2026, 10:00 (horário de São Paulo).
export const AGORA = { data: "2026-11-10", min: 10 * 60 };
export const QUARTA = "2026-11-11";
export const SABADO = "2026-11-14";
export const DOMINGO = "2026-11-15";

export async function iniciar() {
  const db = abrirBanco(":memory:");
  const app = criarApp({ db, agora: () => AGORA, limites: false });
  const servidor = await new Promise((ok) => { const s = app.listen(0, "127.0.0.1", () => ok(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function req(metodo, caminho, corpo, cabecalhos = {}) {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: { "content-type": "application/json", ...cabecalhos },
      body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
    const texto = await r.text();
    let json; try { json = JSON.parse(texto); } catch { json = undefined; }
    return { status: r.status, json, texto, headers: r.headers };
  }
  return { db, base, req, fechar: () => new Promise((ok) => servidor.close(ok)) };
}

/** Corpo válido de agendamento; `sobre` sobrescreve campos. */
export function pedido(sobre = {}) {
  return {
    servicos: ["banho"],
    data: QUARTA,
    hora: "09:00",
    pet: { nome: "Thor", porte: "pequeno", raca: "Poodle" },
    tutor: { nome: "Maria Souza", telefone: "(11) 98888-1111" },
    ...sobre,
  };
}

export const ADMIN = { authorization: "Bearer dev-admin-token" };
