// Regras de agendamento + acesso ao banco. O "bloqueio automático de
// horário" acontece em criarAgendamento/atualizarAgendamento: a checagem de
// vaga e a gravação ocorrem na MESMA transação (BEGIN IMMEDIATE), então duas
// pessoas tentando o mesmo horário nunca conseguem reservar os dois.

import { randomInt } from "node:crypto";
import { config } from "./config.js";
import { transacao } from "./db.js";
import {
  calcularDuracao, gerarHorarios, janelaDoDia, temVaga, minParaHora, agoraNoSalao, somarDias,
} from "./rules.js";
import {
  ErroApi, validarDataHora, validarServicos, validarPet, validarTutor, texto, validarCodigo,
} from "./validacao.js";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para evitar confusão

function novoCodigo() {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return c;
}

// ---------- consultas ----------

export function listarServicos(db) {
  return db.prepare(
    "SELECT codigo, nome, descricao, duracao_min FROM servico WHERE ativo = 1 ORDER BY id"
  ).all();
}

function buscarServicos(db, codigos, erros) {
  const marcas = codigos.map(() => "?").join(",");
  const linhas = db.prepare(
    `SELECT id, codigo, nome, duracao_min FROM servico WHERE ativo = 1 AND codigo IN (${marcas})`
  ).all(...codigos);
  if (linhas.length !== codigos.length) erros.servicos = "Serviço indisponível.";
  return linhas;
}

function ocupadosDoDia(db, data, ignorarId = 0) {
  return db.prepare(
    `SELECT inicio_min AS inicio, fim_min AS fim FROM agendamento
     WHERE data = ? AND status IN ('confirmado', 'concluido') AND id != ?`
  ).all(data, ignorarId);
}

export function disponibilidade(db, query, agora = agoraNoSalao()) {
  const erros = {};
  const data = query.data;
  const dv = validarDataHora({ data, hora: "00:00" }, erros);
  const codigos = validarServicos(
    typeof query.servicos === "string" ? query.servicos.split(",") : query.servicos, erros);
  const porte = query.porte;
  if (!config.fatorPorte[porte]) erros.porte = "Porte inválido.";
  if (Object.keys(erros).length) throw new ErroApi(400, "Parâmetros inválidos.", erros);

  const servicos = buscarServicos(db, codigos, erros);
  if (Object.keys(erros).length) throw new ErroApi(400, "Parâmetros inválidos.", erros);

  const duracao = calcularDuracao(servicos.map((s) => s.duracao_min), porte);
  const janela = janelaDoDia(dv.data);
  const horarios = gerarHorarios({ data: dv.data, duracao, ocupados: ocupadosDoDia(db, dv.data), agora });
  return {
    data: dv.data,
    fechado: !janela,
    duracao_min: duracao,
    horarios: horarios.map((h) => h.hora),
  };
}

/** Quais dias do mês têm ao menos um horário — alimenta o calendário. */
export function disponibilidadeDoMes(db, query, agora = agoraNoSalao()) {
  const erros = {};
  if (typeof query.mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(query.mes)) erros.mes = "Use AAAA-MM.";
  const codigos = validarServicos(
    typeof query.servicos === "string" ? query.servicos.split(",") : query.servicos, erros);
  if (!config.fatorPorte[query.porte]) erros.porte = "Porte inválido.";
  if (Object.keys(erros).length) throw new ErroApi(400, "Parâmetros inválidos.", erros);
  const servicos = buscarServicos(db, codigos, erros);
  if (Object.keys(erros).length) throw new ErroApi(400, "Parâmetros inválidos.", erros);

  const duracao = calcularDuracao(servicos.map((s) => s.duracao_min), query.porte);
  const dias = {};
  const [a, m] = query.mes.split("-").map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  for (let d = 1; d <= total; d++) {
    const data = `${query.mes}-${String(d).padStart(2, "0")}`;
    dias[data] = gerarHorarios({ data, duracao, ocupados: ocupadosDoDia(db, data), agora }).length;
  }
  return { mes: query.mes, duracao_min: duracao, dias, limite: somarDias(agora.data, config.diasMaximos) };
}

// ---------- criação ----------

export function criarAgendamento(db, body, agora = agoraNoSalao()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ErroApi(400, "Corpo inválido.");
  const erros = {};
  const dv = validarDataHora(body, erros);
  const codigos = validarServicos(body.servicos, erros);
  const pet = validarPet(body.pet, erros);
  const tutor = validarTutor(body.tutor, erros);
  const obs = texto(body.observacoes, { campo: "observacoes", max: 300, multilinha: true }, erros);
  if (Object.keys(erros).length) throw new ErroApi(400, "Confira os campos destacados.", erros);

  return transacao(db, () => {
    const servicos = buscarServicos(db, codigos, erros);
    if (Object.keys(erros).length) throw new ErroApi(400, "Confira os campos destacados.", erros);

    const duracao = calcularDuracao(servicos.map((s) => s.duracao_min), pet.porte);
    const fim = dv.inicio + duracao;
    verificarHorario(db, { data: dv.data, inicio: dv.inicio, duracao, agora, petId: null });

    // Tutor: identificado pelo telefone. Um cadastro existente não é
    // sobrescrito por quem apenas conhece o número (evita adulteração).
    let t = db.prepare("SELECT id FROM tutor WHERE telefone = ?").get(tutor.telefone);
    if (!t) {
      const r = db.prepare("INSERT INTO tutor (nome, telefone, email) VALUES (?, ?, ?)")
        .run(tutor.nome, tutor.telefone, tutor.email);
      t = { id: Number(r.lastInsertRowid) };
    } else if (tutor.email) {
      db.prepare("UPDATE tutor SET email = COALESCE(email, ?) WHERE id = ?").run(tutor.email, t.id);
    }

    let p = db.prepare("SELECT id FROM pet WHERE tutor_id = ? AND lower(nome) = lower(?)").get(t.id, pet.nome);
    if (!p) {
      const r = db.prepare(
        "INSERT INTO pet (tutor_id, nome, especie, raca, porte, observacoes) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(t.id, pet.nome, pet.especie, pet.raca, pet.porte, pet.observacoes);
      p = { id: Number(r.lastInsertRowid) };
    } else {
      db.prepare("UPDATE pet SET porte = ?, raca = COALESCE(?, raca), observacoes = COALESCE(?, observacoes) WHERE id = ?")
        .run(pet.porte, pet.raca, pet.observacoes, p.id);
    }

    // O mesmo pet não pode estar em dois lugares ao mesmo tempo.
    const duplo = db.prepare(
      `SELECT 1 FROM agendamento WHERE pet_id = ? AND data = ? AND status IN ('confirmado','concluido')
       AND inicio_min < ? AND fim_min > ?`
    ).get(p.id, dv.data, fim, dv.inicio);
    if (duplo) throw new ErroApi(409, "Este pet já tem um agendamento nesse horário.");

    let codigo = novoCodigo();
    while (db.prepare("SELECT 1 FROM agendamento WHERE codigo = ?").get(codigo)) codigo = novoCodigo();

    const r = db.prepare(
      `INSERT INTO agendamento (codigo, tutor_id, pet_id, data, inicio_min, fim_min, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(codigo, t.id, p.id, dv.data, dv.inicio, fim, obs);
    const id = Number(r.lastInsertRowid);
    const liga = db.prepare("INSERT INTO agendamento_servico (agendamento_id, servico_id) VALUES (?, ?)");
    for (const s of servicos) liga.run(id, s.id);

    return detalhar(db, id);
  });
}

/** Lança 409/400 se o horário não puder ser usado. Chamar dentro da transação. */
function verificarHorario(db, { data, inicio, duracao, agora, ignorarId = 0 }) {
  const janela = janelaDoDia(data);
  if (!janela) throw new ErroApi(409, "O salão não abre nesse dia.");
  if (data < agora.data) throw new ErroApi(409, "Essa data já passou.");
  if (data > somarDias(agora.data, config.diasMaximos))
    throw new ErroApi(409, `Só é possível agendar até ${config.diasMaximos} dias à frente.`);
  if (data === agora.data && inicio < agora.min + config.antecedenciaMin)
    throw new ErroApi(409, "Esse horário está muito próximo. Agende com pelo menos 2 horas de antecedência.");
  if ((inicio - janela[0]) % config.passoMin !== 0 || inicio < janela[0] || inicio + duracao > janela[1])
    throw new ErroApi(409, "Horário fora do expediente.");
  if (!temVaga(ocupadosDoDia(db, data, ignorarId), inicio, inicio + duracao))
    throw new ErroApi(409, "Esse horário acabou de ser ocupado. Escolha outro, por favor.");
}

// ---------- leitura ----------

const SQL_DETALHE = `
  SELECT a.id, a.codigo, a.data, a.inicio_min, a.fim_min, a.status, a.observacoes, a.criado_em,
         t.nome AS tutor_nome, t.telefone AS tutor_telefone, t.email AS tutor_email,
         p.nome AS pet_nome, p.especie, p.raca, p.porte
  FROM agendamento a JOIN tutor t ON t.id = a.tutor_id JOIN pet p ON p.id = a.pet_id`;

function montar(db, a) {
  const servicos = db.prepare(
    `SELECT s.codigo, s.nome FROM agendamento_servico x JOIN servico s ON s.id = x.servico_id
     WHERE x.agendamento_id = ? ORDER BY s.id`
  ).all(a.id);
  return {
    id: a.id, codigo: a.codigo, data: a.data,
    inicio: minParaHora(a.inicio_min), fim: minParaHora(a.fim_min), status: a.status,
    observacoes: a.observacoes, criado_em: a.criado_em,
    tutor: { nome: a.tutor_nome, telefone: a.tutor_telefone, email: a.tutor_email },
    pet: { nome: a.pet_nome, especie: a.especie, raca: a.raca, porte: a.porte },
    servicos,
  };
}

export function detalhar(db, id) {
  const a = db.prepare(`${SQL_DETALHE} WHERE a.id = ?`).get(id);
  return a ? montar(db, a) : null;
}

export function buscarPorCodigo(db, codigo) {
  if (!validarCodigo(codigo)) return null;
  const a = db.prepare(`${SQL_DETALHE} WHERE a.codigo = ?`).get(codigo.toUpperCase());
  return a ? montar(db, a) : null;
}

/** Visão pública: sem telefone/e-mail, só o primeiro nome do tutor. */
export function visaoPublica(ag) {
  return {
    codigo: ag.codigo, data: ag.data, inicio: ag.inicio, fim: ag.fim, status: ag.status,
    tutor: ag.tutor.nome.split(" ")[0],
    pet: { nome: ag.pet.nome, porte: ag.pet.porte },
    servicos: ag.servicos,
    whatsapp_url: linkWhatsapp(ag),
  };
}

export function linkWhatsapp(ag) {
  const [a, m, d] = ag.data.split("-");
  const servicos = ag.servicos.map((s) => s.nome).join(" + ");
  const msg =
    `Olá! Acabei de agendar pelo site.\n` +
    `Pet: ${ag.pet.nome}\nServiço: ${servicos}\n` +
    `Dia: ${d}/${m}/${a} às ${ag.inicio}\nCódigo: ${ag.codigo}`;
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;
}

// ---------- administração (painel do salão) ----------

export function listarAgendamentos(db, { data, de, ate }) {
  const erros = {};
  let ini = de ?? data, fim = ate ?? data;
  for (const [k, v] of [["data", ini], ["ate", fim]]) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) erros[k] = "Use AAAA-MM-DD.";
  }
  if (Object.keys(erros).length) throw new ErroApi(400, "Informe a data.", erros);
  const linhas = db.prepare(
    `${SQL_DETALHE} WHERE a.data BETWEEN ? AND ? ORDER BY a.data, a.inicio_min LIMIT 500`
  ).all(ini, fim);
  return linhas.map((a) => montar(db, a));
}

const STATUS = ["confirmado", "cancelado", "concluido", "faltou"];

export function atualizarAgendamento(db, id, body, agora = agoraNoSalao()) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ErroApi(400, "Corpo inválido.");
  const erros = {};
  if (body.status !== undefined && !STATUS.includes(body.status)) erros.status = "Status inválido.";
  const remarcar = body.data !== undefined || body.hora !== undefined;
  let dv;
  if (remarcar) dv = validarDataHora(body, erros);
  const obs = body.observacoes !== undefined
    ? texto(body.observacoes, { campo: "observacoes", max: 300, multilinha: true }, erros) : undefined;
  if (Object.keys(erros).length) throw new ErroApi(400, "Dados inválidos.", erros);

  return transacao(db, () => {
    const atual = db.prepare(
      "SELECT a.*, p.porte FROM agendamento a JOIN pet p ON p.id = a.pet_id WHERE a.id = ?").get(id);
    if (!atual) throw new ErroApi(404, "Agendamento não encontrado.");

    let { data, inicio_min: ini, fim_min: fim } = atual;
    const novoStatus = body.status ?? atual.status;
    const ocupaHorario = ["confirmado", "concluido"].includes(novoStatus);

    if (remarcar) {
      const durs = db.prepare(
        `SELECT s.duracao_min FROM agendamento_servico x JOIN servico s ON s.id = x.servico_id
         WHERE x.agendamento_id = ?`).all(id).map((r) => r.duracao_min);
      const duracao = calcularDuracao(durs, atual.porte);
      data = dv.data; ini = dv.inicio; fim = ini + duracao;
      if (ocupaHorario) verificarHorario(db, { data, inicio: ini, duracao, agora, ignorarId: id });
    } else if (ocupaHorario && !["confirmado", "concluido"].includes(atual.status)) {
      // Reativar um agendamento cancelado: o horário precisa ainda estar livre.
      if (!temVaga(ocupadosDoDia(db, data, id), ini, fim))
        throw new ErroApi(409, "Esse horário já foi ocupado por outro agendamento.");
    }

    db.prepare(
      `UPDATE agendamento SET data = ?, inicio_min = ?, fim_min = ?, status = ?,
       observacoes = ?, atualizado_em = datetime('now') WHERE id = ?`
    ).run(data, ini, fim, novoStatus, obs === undefined ? atual.observacoes : obs, id);
    return detalhar(db, id);
  });
}

/** Cancelamento feito pelo próprio cliente, usando o código da confirmação. */
export function cancelarPorCodigo(db, codigo) {
  const ag = buscarPorCodigo(db, codigo);
  if (!ag) throw new ErroApi(404, "Agendamento não encontrado.");
  if (ag.status !== "confirmado") throw new ErroApi(409, "Este agendamento não pode mais ser cancelado.");
  db.prepare("UPDATE agendamento SET status = 'cancelado', atualizado_em = datetime('now') WHERE id = ?").run(ag.id);
  return buscarPorCodigo(db, codigo);
}

export function removerAgendamento(db, id) {
  const r = db.prepare("DELETE FROM agendamento WHERE id = ?").run(id);
  if (!r.changes) throw new ErroApi(404, "Agendamento não encontrado.");
}
