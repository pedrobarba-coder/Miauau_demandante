import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { iniciar, pedido, ADMIN, QUARTA, SABADO, DOMINGO, AGORA } from "./helpers.js";
import { config } from "../server/config.js";

let s;
before(async () => { s = await iniciar(); });
after(async () => { await s.fechar(); s.db.close(); });

let n = 0; // telefones/pets únicos para isolar os testes entre si
const unico = (sobre = {}) => {
  n++;
  const tel = `119${String(80000000 + n)}`;
  return pedido({ tutor: { nome: "Tutor Teste", telefone: tel }, pet: { nome: `Pet${n}`, porte: "pequeno" }, ...sobre });
};
const dia = (i) => `2026-11-${String(16 + i).padStart(2, "0")}`; // 16..20 = seg–sex, sem conflito entre testes

// ---------------------------------------------------------------- fluxo feliz
test("cria agendamento e devolve confirmação com link do WhatsApp", async () => {
  const r = await s.req("POST", "/api/agendamentos", unico({ data: dia(0), hora: "08:00" }));
  assert.equal(r.status, 201);
  assert.match(r.json.codigo, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(r.json.inicio, "08:00");
  assert.equal(r.json.fim, "09:00");
  assert.ok(r.json.whatsapp_url.startsWith("https://wa.me/5511994375673?text="));
  assert.ok(decodeURIComponent(r.json.whatsapp_url).includes(r.json.codigo));
  assert.equal(r.json.tutor, "Tutor");          // só o primeiro nome
  assert.ok(!("telefone" in r.json) && !JSON.stringify(r.json).includes("98888"));

  const g = await s.req("GET", `/api/agendamentos/${r.json.codigo.toLowerCase()}`);
  assert.equal(g.status, 200);
  assert.equal(g.json.codigo, r.json.codigo);
});

test("duração depende do porte: grande + banho = 90 min", async () => {
  const r = await s.req("POST", "/api/agendamentos",
    unico({ data: dia(0), hora: "10:00", pet: { nome: "Gigante", porte: "grande" } }));
  assert.equal(r.status, 201);
  assert.equal(r.json.fim, "11:30");
});

// ---------------------------------------------------- bloqueio de horário
test("bloqueio: mesmo horário, sobreposição e encaixe", async () => {
  const d = dia(1);
  assert.equal((await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "09:00" }))).status, 201); // 09–10

  const igual = await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "09:00" }));
  assert.equal(igual.status, 409);
  assert.match(igual.json.erro, /ocupado/i);

  assert.equal((await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "09:30" }))).status, 409);
  assert.equal((await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "08:30" }))).status, 409); // 08:30–09:30
  assert.equal((await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "08:00" }))).status, 201); // 08–09 encosta
  assert.equal((await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "10:00" }))).status, 201); // 10–11 encosta
});

test("o horário ocupado some da disponibilidade e volta ao cancelar", async () => {
  const d = dia(2);
  const q = `/api/disponibilidade?data=${d}&servicos=banho&porte=pequeno`;
  assert.ok((await s.req("GET", q)).json.horarios.includes("14:00"));

  const ag = await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "14:00" }));
  const depois = (await s.req("GET", q)).json.horarios;
  assert.ok(!depois.includes("14:00") && !depois.includes("14:30") && !depois.includes("13:30"));
  assert.ok(depois.includes("15:00") && depois.includes("13:00"));

  const c = await s.req("DELETE", `/api/agendamentos/${ag.json.codigo}`);
  assert.equal(c.status, 200);
  assert.equal(c.json.status, "cancelado");
  assert.ok((await s.req("GET", q)).json.horarios.includes("14:00"));
  assert.equal((await s.req("DELETE", `/api/agendamentos/${ag.json.codigo}`)).status, 409); // já cancelado
});

test("concorrência: 8 pedidos simultâneos para o mesmo horário → 1 vence", async () => {
  const d = dia(3);
  const rs = await Promise.all(Array.from({ length: 8 }, () =>
    s.req("POST", "/api/agendamentos", unico({ data: d, hora: "16:00" }))));
  const codigos = rs.map((r) => r.status).sort();
  assert.deepEqual(codigos, [201, 409, 409, 409, 409, 409, 409, 409]);
  const noBanco = s.db.prepare("SELECT COUNT(*) c FROM agendamento WHERE data = ? AND inicio_min = 960 AND status='confirmado'").get(d);
  assert.equal(noBanco.c, 1);
});

test("com 2 vagas simultâneas, aceita 2 e bloqueia o 3º; o mesmo pet não duplica", async () => {
  const antes = config.capacidade;
  config.capacidade = 2;
  try {
    const d = dia(4);
    const p = unico({ data: d, hora: "09:00" });
    assert.equal((await s.req("POST", "/api/agendamentos", p)).status, 201);
    const dup = await s.req("POST", "/api/agendamentos", { ...p, hora: "09:30" }); // mesmo tutor+pet
    assert.equal(dup.status, 409);
    assert.match(dup.json.erro, /já tem um agendamento/);
    assert.equal((await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "09:00" }))).status, 201);
    assert.equal((await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "09:00" }))).status, 409);
  } finally { config.capacidade = antes; }
});

// ------------------------------------------------------------ regras de data
test("rejeita domingo, depois do fechamento de sábado, passado, >30 dias e pouca antecedência", async () => {
  const tenta = (sobre) => s.req("POST", "/api/agendamentos", unico(sobre));
  assert.equal((await tenta({ data: DOMINGO, hora: "09:00" })).status, 409);
  assert.equal((await tenta({ data: SABADO, hora: "13:30" })).status, 409);   // 13:30 + 60 > 14:00
  assert.equal((await tenta({ data: SABADO, hora: "13:00" })).status, 201);   // cabe
  assert.equal((await tenta({ data: "2026-11-09", hora: "09:00" })).status, 409);
  assert.equal((await tenta({ data: "2026-12-11", hora: "09:00" })).status, 409);
  assert.equal((await tenta({ data: AGORA.data, hora: "11:00" })).status, 409); // 10:00 + 2h = 12:00
  assert.equal((await tenta({ data: dia(0), hora: "07:30" })).status, 409);     // antes de abrir
  assert.equal((await tenta({ data: dia(0), hora: "09:15" })).status, 409);     // fora do passo de 30 min
});

// ---------------------------------------------------------------- validação
test("validação: campos obrigatórios, tipos e formatos", async () => {
  const ruim = async (sobre, campo) => {
    const r = await s.req("POST", "/api/agendamentos", unico({ data: dia(0), hora: "12:00", ...sobre }));
    assert.equal(r.status, 400, JSON.stringify(sobre));
    if (campo) assert.ok(r.json.campos?.[campo], `esperava erro em ${campo}: ${r.texto}`);
  };
  await ruim({ servicos: [] }, "servicos");
  await ruim({ servicos: "banho" }, "servicos");
  await ruim({ servicos: ["banho", "banho"] }, "servicos");
  await ruim({ servicos: ["inexistente"] }, "servicos");
  await ruim({ servicos: [{ $ne: 1 }] }, "servicos");
  await ruim({ data: "2026-02-31" }, "data");
  await ruim({ data: 20261112 }, "data");
  await ruim({ hora: "25:00" }, "hora");
  await ruim({ pet: { nome: "", porte: "pequeno" } }, "pet.nome");
  await ruim({ pet: { nome: "Rex", porte: "gigante" } }, "pet.porte");
  await ruim({ pet: { nome: "Rex", porte: "pequeno", especie: "dragao" } }, "pet.especie");
  await ruim({ pet: { nome: "x".repeat(61), porte: "pequeno" } }, "pet.nome");
  await ruim({ pet: { nome: { a: 1 }, porte: "pequeno" } }, "pet.nome");
  await ruim({ pet: null }, "pet");
  await ruim({ tutor: { nome: "A", telefone: "11988881111" } }, "tutor.nome");
  await ruim({ tutor: { nome: "Maria", telefone: "123" } }, "tutor.telefone");
  await ruim({ tutor: { nome: "Maria", telefone: "11988881111", email: "nao-e-email" } }, "tutor.email");
  await ruim({ observacoes: "x".repeat(301) }, "observacoes");
  await ruim({ observacoes: "oi\u0000tchau" }, "observacoes");
  const arr = await s.req("POST", "/api/agendamentos", []);
  assert.equal(arr.status, 400);
});

test("validação: JSON quebrado e corpo gigante", async () => {
  assert.equal((await s.req("POST", "/api/agendamentos", "{quebrado")).status, 400);
  assert.equal((await s.req("POST", "/api/agendamentos", { lixo: "x".repeat(30000) })).status, 413);
});

test("disponibilidade valida os parâmetros", async () => {
  assert.equal((await s.req("GET", "/api/disponibilidade?data=ontem&servicos=banho&porte=pequeno")).status, 400);
  assert.equal((await s.req("GET", "/api/disponibilidade?data=2026-11-12&servicos=banho&porte=x")).status, 400);
  assert.equal((await s.req("GET", "/api/disponibilidade?data=2026-11-12&servicos=nao-existe&porte=pequeno")).status, 400);
  assert.equal((await s.req("GET", "/api/disponibilidade?data=2026-11-12&servicos[a]=banho&porte=pequeno")).status, 400); // objeto, não lista
  const dom = await s.req("GET", `/api/disponibilidade?data=${DOMINGO}&servicos=banho&porte=pequeno`);
  assert.deepEqual([dom.json.fechado, dom.json.horarios], [true, []]);
  const mes = await s.req("GET", "/api/disponibilidade/mes?mes=2026-11&servicos=banho&porte=pequeno");
  assert.equal(mes.status, 200);
  assert.equal(mes.json.dias[DOMINGO], 0);
  assert.ok(mes.json.dias[QUARTA] > 0);
});

// ---------------------------------------------------------------- segurança
test("segurança: SQL injection vira texto comum e as tabelas continuam intactas", async () => {
  const nome = "Robert'); DROP TABLE agendamento;--";
  const r = await s.req("POST", "/api/agendamentos",
    unico({ data: dia(0), hora: "15:00", tutor: { nome, telefone: "11977776666" }, pet: { nome: "' OR 1=1 --", porte: "medio" } }));
  assert.equal(r.status, 201);
  const t = s.db.prepare("SELECT nome FROM tutor WHERE telefone = '11977776666'").get();
  assert.equal(t.nome, nome);
  assert.ok(s.db.prepare("SELECT COUNT(*) c FROM agendamento").get().c > 0);
  assert.equal((await s.req("GET", "/api/agendamentos/' OR '1'='1")).status, 404);
  assert.equal((await s.req("GET", "/api/disponibilidade?data=2026-11-12' OR 1=1--&servicos=banho&porte=pequeno")).status, 400);
});

test("segurança: HTML/JS no nome é guardado como texto (o front usa textContent)", async () => {
  const xss = '<img src=x onerror=alert(1)>';
  const r = await s.req("POST", "/api/agendamentos",
    unico({ data: dia(1), hora: "12:00", pet: { nome: xss, porte: "pequeno" } }));
  assert.equal(r.status, 201);
  assert.equal(r.json.pet.nome, xss);
  assert.match(r.headers.get("content-type"), /application\/json/); // nunca renderizado como HTML
  assert.match(r.headers.get("content-security-policy"), /script-src 'self'/);
});

test("segurança: campos extras (status, id, codigo) não são aceitos do cliente", async () => {
  const r = await s.req("POST", "/api/agendamentos",
    unico({ data: dia(2), hora: "10:00", status: "concluido", id: 1, codigo: "AAAAAAAA", tutor_id: 1 }));
  assert.equal(r.status, 201);
  assert.notEqual(r.json.codigo, "AAAAAAAA");
  assert.equal(r.json.status, "confirmado");
});

test("segurança: tutor existente não é sobrescrito por quem só sabe o telefone", async () => {
  const tel = "11955554444";
  await s.req("POST", "/api/agendamentos", unico({ data: dia(3), hora: "08:00", tutor: { nome: "Dona Original", telefone: tel } }));
  await s.req("POST", "/api/agendamentos", unico({ data: dia(3), hora: "09:00", tutor: { nome: "Invasor", telefone: tel } }));
  assert.equal(s.db.prepare("SELECT nome FROM tutor WHERE telefone = ?").get(tel).nome, "Dona Original");
});

test("segurança: painel exige token", async () => {
  const url = `/api/admin/agendamentos?data=${dia(0)}`;
  assert.equal((await s.req("GET", url)).status, 401);
  assert.equal((await s.req("GET", url, undefined, { authorization: "Bearer errado" })).status, 401);
  assert.equal((await s.req("GET", url, undefined, { authorization: "dev-admin-token" })).status, 401);
  assert.equal((await s.req("PATCH", "/api/admin/agendamentos/1", { status: "faltou" })).status, 401);
  assert.equal((await s.req("DELETE", "/api/admin/agendamentos/1")).status, 401);
  const ok = await s.req("GET", url, undefined, ADMIN);
  assert.equal(ok.status, 200);
  assert.ok(ok.json.agendamentos.length > 0);
  assert.ok(ok.json.agendamentos[0].tutor.telefone); // o salão enxerga o telefone
});

test("segurança: arquivos internos não são servidos; erros não vazam detalhes", async () => {
  for (const p of ["/server/db.js", "/data/peludinho.db", "/package.json", "/.git/config", "/.env", "/node_modules/express/package.json", "/..%2fpackage.json", "/css/../package.json"]) {
    const r = await s.req("GET", p);
    assert.equal(r.status, 404, p);
  }
  assert.equal((await s.req("GET", "/index.html")).status, 200);
  assert.equal((await s.req("GET", "/css/style.css")).status, 200);
  const e = await s.req("GET", "/api/inexistente");
  assert.equal(e.status, 404);
  assert.ok(!/at .*\.js|node_modules/.test(e.texto));
  assert.equal((await s.req("GET", "/api/servicos")).headers.get("x-powered-by"), null);
});

// --------------------------------------------------------- painel: CRUD completo
test("painel: remarcar respeita o bloqueio; cancelar libera; reativar exige horário livre", async () => {
  const d = dia(4); // dia sem outros agendamentos à tarde
  const a = await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "13:00" }));  // 13–14
  const b = await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "14:00" }));  // 14–15
  const idA = s.db.prepare("SELECT id FROM agendamento WHERE codigo = ?").get(a.json.codigo).id;
  const idB = s.db.prepare("SELECT id FROM agendamento WHERE codigo = ?").get(b.json.codigo).id;
  const patch = (id, corpo) => s.req("PATCH", `/api/admin/agendamentos/${id}`, corpo, ADMIN);

  assert.equal((await patch(idA, { data: d, hora: "14:00" })).status, 409);       // bate no B
  const ok = await patch(idA, { data: d, hora: "16:00" });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.inicio, "16:00");
  assert.equal((await patch(idA, { data: d, hora: "16:30" })).status, 200);       // ignora a si mesmo

  assert.equal((await patch(idB, { status: "cancelado" })).json.status, "cancelado");
  const c = await s.req("POST", "/api/agendamentos", unico({ data: d, hora: "14:00" })); // horário liberado
  assert.equal(c.status, 201);
  assert.equal((await patch(idB, { status: "confirmado" })).status, 409);          // não dá pra reativar por cima

  assert.equal((await patch(idA, { status: "invalido" })).status, 400);
  assert.equal((await patch(999999, { status: "faltou" })).status, 404);
  assert.equal((await s.req("PATCH", "/api/admin/agendamentos/abc", {}, ADMIN)).status, 400);
  assert.equal((await s.req("DELETE", `/api/admin/agendamentos/${idA}`, undefined, ADMIN)).status, 204);
  assert.equal((await s.req("DELETE", `/api/admin/agendamentos/${idA}`, undefined, ADMIN)).status, 404);
  assert.equal(s.db.prepare("SELECT COUNT(*) c FROM agendamento_servico WHERE agendamento_id = ?").get(idA).c, 0); // cascata
});

test("código de confirmação inválido ou inexistente → 404", async () => {
  for (const c of ["AAAAAAAA", "curto", "00000000", "%00", "A".repeat(200)]) {
    assert.equal((await s.req("GET", `/api/agendamentos/${encodeURIComponent(c)}`)).status, 404, c);
    assert.equal((await s.req("DELETE", `/api/agendamentos/${encodeURIComponent(c)}`)).status, 404, c);
  }
});
