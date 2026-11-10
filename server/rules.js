// Regras de negócio da agenda — funções puras (sem banco, sem HTTP),
// por isso são fáceis de testar. Horários são "minutos desde 00:00".

import { config } from "./config.js";

export const PORTES = Object.keys(config.fatorPorte);

/** 540 -> "09:00" */
export function minParaHora(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** "09:00" -> 540 (ou null se inválido) */
export function horaParaMin(hora) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hora));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Confere "YYYY-MM-DD" de verdade (rejeita 2026-02-31). */
export function dataValida(data) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function diaDaSemana(data) {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function somarDias(data, dias) {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Data e hora "de agora" no fuso do salão: { data: "YYYY-MM-DD", min: 725 } */
export function agoraNoSalao(data = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.fusoHorario,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(data).map((p) => [p.type, p.value])
  );
  return {
    data: `${partes.year}-${partes.month}-${partes.day}`,
    min: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

/**
 * Duração total do atendimento: soma dos serviços × fator do porte,
 * arredondada para cima ao próximo múltiplo do passo (30 min).
 */
export function calcularDuracao(duracoesDosServicos, porte) {
  const fator = config.fatorPorte[porte];
  if (!fator) throw new Error("Porte inválido");
  const total = duracoesDosServicos.reduce((a, b) => a + b, 0) * fator;
  return Math.ceil(total / config.passoMin) * config.passoMin;
}

/** Janela [abre, fecha] do dia, ou null se o salão estiver fechado. */
export function janelaDoDia(data) {
  return config.funcionamento[diaDaSemana(data)] ?? null;
}

/**
 * Há vaga para [inicio, fim) dado o que já está marcado?
 * `ocupados` = [{inicio, fim}, ...]. Verifica a capacidade em cada ponto
 * onde a ocupação pode mudar dentro do intervalo (início do novo
 * atendimento e início de cada atendimento existente).
 */
export function temVaga(ocupados, inicio, fim, capacidade = config.capacidade) {
  const pontos = [inicio, ...ocupados.map((o) => o.inicio).filter((i) => i > inicio && i < fim)];
  return pontos.every((p) => ocupados.filter((o) => o.inicio <= p && p < o.fim).length < capacidade);
}

/**
 * Horários de início possíveis em `data` para um atendimento de `duracao`
 * minutos: dentro do expediente, respeitando antecedência mínima,
 * limite de dias e vagas. Retorna [{ hora: "09:00", min: 540 }, ...].
 */
export function gerarHorarios({ data, duracao, ocupados, agora }) {
  const janela = janelaDoDia(data);
  if (!janela) return [];
  if (data < agora.data) return [];
  if (data > somarDias(agora.data, config.diasMaximos)) return [];

  const [abre, fecha] = janela;
  const livres = [];
  for (let ini = abre; ini + duracao <= fecha; ini += config.passoMin) {
    if (data === agora.data && ini < agora.min + config.antecedenciaMin) continue;
    if (!temVaga(ocupados, ini, ini + duracao)) continue;
    livres.push({ hora: minParaHora(ini), min: ini });
  }
  return livres;
}
