// Validação e limpeza das entradas. Nada que chega da internet é confiado:
// tipos são checados, textos são limpos e tamanhos são limitados.

import { PORTES, dataValida, horaParaMin } from "./rules.js";

export class ErroApi extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

// Caracteres de controle (exceto quebra de linha/tab nas observações).
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Texto obrigatório/opcional, aparado, com espaços internos normalizados. */
export function texto(valor, { campo, min = 0, max, obrigatorio = false, multilinha = false }, erros) {
  if (valor === undefined || valor === null || valor === "") {
    if (obrigatorio) erros[campo] = "Campo obrigatório.";
    return null;
  }
  if (typeof valor !== "string") { erros[campo] = "Formato inválido."; return null; }
  let v = valor.normalize("NFC").trim();
  v = multilinha ? v.replace(/[ \t]+/g, " ") : v.replace(/\s+/g, " ");
  if (CONTROLE.test(v)) { erros[campo] = "Contém caracteres inválidos."; return null; }
  if (v.length < min) { erros[campo] = `Mínimo de ${min} caracteres.`; return null; }
  if (v.length > max) { erros[campo] = `Máximo de ${max} caracteres.`; return null; }
  return v || null;
}

/** Telefone brasileiro: aceita (11) 99437-5673, +55 11 99437-5673 etc. → "11994375673" */
export function telefone(valor, campo, erros) {
  if (typeof valor !== "string" && typeof valor !== "number") { erros[campo] = "Informe o telefone com DDD."; return null; }
  let d = String(valor).replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  const ddd = Number(d.slice(0, 2));
  const celularOk = d.length === 11 && d[2] === "9";
  const fixoOk = d.length === 10 && /[2-5]/.test(d[2]);
  if (!(celularOk || fixoOk) || ddd < 11 || ddd > 99) {
    erros[campo] = "Telefone inválido. Use DDD + número, ex.: (11) 99437-5673.";
    return null;
  }
  return d;
}

export function email(valor, campo, erros) {
  const v = texto(valor, { campo, max: 120 }, erros);
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { erros[campo] = "E-mail inválido."; return null; }
  return v;
}

export function validarDataHora(body, erros) {
  if (typeof body.data !== "string" || !dataValida(body.data)) erros.data = "Data inválida (use AAAA-MM-DD).";
  const min = horaParaMin(body.hora);
  if (min === null) erros.hora = "Horário inválido (use HH:MM).";
  return { data: body.data, inicio: min };
}

export function validarServicos(codigos, erros) {
  if (!Array.isArray(codigos) || codigos.length < 1 || codigos.length > 6 ||
      codigos.some((c) => typeof c !== "string" || !/^[a-z-]{1,30}$/.test(c))) {
    erros.servicos = "Escolha de 1 a 6 serviços.";
    return null;
  }
  if (new Set(codigos).size !== codigos.length) { erros.servicos = "Serviço repetido."; return null; }
  return codigos;
}

export function validarPet(pet, erros) {
  if (!pet || typeof pet !== "object" || Array.isArray(pet)) { erros.pet = "Dados do pet são obrigatórios."; return null; }
  const e = {};
  const out = {
    nome: texto(pet.nome, { campo: "nome", min: 1, max: 60, obrigatorio: true }, e),
    especie: pet.especie ?? "cao",
    raca: texto(pet.raca, { campo: "raca", max: 60 }, e),
    porte: pet.porte,
    observacoes: texto(pet.observacoes, { campo: "observacoes", max: 300, multilinha: true }, e),
  };
  if (!["cao", "gato"].includes(out.especie)) e.especie = "Espécie inválida.";
  if (!PORTES.includes(out.porte)) e.porte = "Escolha o porte: pequeno, médio ou grande.";
  for (const [k, v] of Object.entries(e)) erros[`pet.${k}`] = v;
  return Object.keys(e).length ? null : out;
}

export function validarTutor(tutor, erros) {
  if (!tutor || typeof tutor !== "object" || Array.isArray(tutor)) { erros.tutor = "Dados do tutor são obrigatórios."; return null; }
  const e = {};
  const out = {
    nome: texto(tutor.nome, { campo: "nome", min: 2, max: 80, obrigatorio: true }, e),
    telefone: telefone(tutor.telefone, "telefone", e),
    email: email(tutor.email, "email", e),
  };
  for (const [k, v] of Object.entries(e)) erros[`tutor.${k}`] = v;
  return Object.keys(e).length ? null : out;
}

export function validarCodigo(codigo) {
  return typeof codigo === "string" && /^[A-HJ-NP-Z2-9]{8}$/.test(codigo.toUpperCase());
}
