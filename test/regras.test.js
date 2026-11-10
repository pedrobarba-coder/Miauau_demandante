import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularDuracao, temVaga, gerarHorarios, dataValida, horaParaMin, minParaHora, agoraNoSalao,
} from "../server/rules.js";
import { telefone } from "../server/validacao.js";
import { AGORA, QUARTA, SABADO, DOMINGO } from "./helpers.js";

test("duração: soma dos serviços × fator do porte, arredondada a 30 min", () => {
  assert.equal(calcularDuracao([60], "pequeno"), 60);
  assert.equal(calcularDuracao([60], "medio"), 90);   // 75 → 90
  assert.equal(calcularDuracao([60], "grande"), 90);  // 90
  assert.equal(calcularDuracao([60, 30], "grande"), 150); // 135 → 150
  assert.equal(calcularDuracao([15], "pequeno"), 30);
  assert.throws(() => calcularDuracao([60], "gigante"));
});

test("temVaga: capacidade 1 — sobreposição bloqueia, encostar não", () => {
  const ocupados = [{ inicio: 540, fim: 600 }]; // 09:00–10:00
  assert.equal(temVaga(ocupados, 540, 600, 1), false);
  assert.equal(temVaga(ocupados, 570, 630, 1), false); // começa no meio
  assert.equal(temVaga(ocupados, 510, 570, 1), false); // termina no meio
  assert.equal(temVaga(ocupados, 480, 660, 1), false); // engloba
  assert.equal(temVaga(ocupados, 480, 540, 1), true);  // termina quando o outro começa
  assert.equal(temVaga(ocupados, 600, 660, 1), true);  // começa quando o outro termina
});

test("temVaga: capacidade 2 — só bloqueia quando os dois ficam ocupados ao mesmo tempo", () => {
  const ocupados = [{ inicio: 540, fim: 660 }, { inicio: 600, fim: 720 }];
  assert.equal(temVaga(ocupados, 540, 600, 2), true);   // só 1 ocupado em 09:00–10:00
  assert.equal(temVaga(ocupados, 600, 660, 2), false);  // 2 ocupados em 10:00–11:00
  assert.equal(temVaga(ocupados, 570, 630, 2), false);  // pega o trecho cheio
});

test("horários: respeita expediente, antecedência e ocupação", () => {
  const h = (data, duracao, ocupados = [], agora = AGORA) =>
    gerarHorarios({ data, duracao, ocupados, agora }).map((x) => x.hora);

  const quarta = h(QUARTA, 60);
  assert.equal(quarta[0], "08:00");
  assert.equal(quarta.at(-1), "17:00"); // 17:00 + 60 = 18:00 (fecha)
  assert.ok(!quarta.includes("17:30"));

  assert.deepEqual(h(DOMINGO, 60), []);                     // fechado
  assert.equal(h(SABADO, 60).at(-1), "13:00");              // sábado fecha 14h
  assert.equal(h(AGORA.data, 60)[0], "12:00");              // agora 10:00 + 2h
  assert.deepEqual(h("2026-11-09", 60), []);                // passado
  assert.deepEqual(h("2026-12-20", 60), []);                // além de 30 dias
  assert.ok(!h(QUARTA, 60, [{ inicio: 540, fim: 600 }]).includes("09:00"));
  assert.ok(h(QUARTA, 60, [{ inicio: 540, fim: 600 }]).includes("10:00"));
});

test("datas e horas", () => {
  assert.equal(dataValida("2026-02-28"), true);
  assert.equal(dataValida("2026-02-31"), false);
  assert.equal(dataValida("2026-13-01"), false);
  assert.equal(dataValida("12/11/2026"), false);
  assert.equal(horaParaMin("09:30"), 570);
  assert.equal(horaParaMin("24:00"), null);
  assert.equal(horaParaMin("9:30"), null);
  assert.equal(minParaHora(570), "09:30");
  assert.match(agoraNoSalao().data, /^\d{4}-\d{2}-\d{2}$/);
});

test("telefone: normaliza e rejeita inválidos", () => {
  const t = (v) => { const e = {}; const r = telefone(v, "t", e); return e.t ? null : r; };
  assert.equal(t("(11) 99437-5673"), "11994375673");
  assert.equal(t("+55 11 99437-5673"), "11994375673");
  assert.equal(t("1133334444"), "1133334444");
  assert.equal(t("12345"), null);
  assert.equal(t("(11) 89437-5673"), null);  // celular sem 9
  assert.equal(t("(05) 99437-5673"), null);  // DDD inexistente
  assert.equal(t("abc"), null);
  assert.equal(t({}), null);
});
