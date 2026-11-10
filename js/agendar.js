// =========================================================
// Agendamento online — formulário em 3 etapas
// Toda a regra de horários vive no servidor; aqui só mostramos
// o que a API devolve. Nenhum texto do usuário vai para innerHTML.
// =========================================================
(() => {
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

  const form = $("#form-agendamento");
  if (!form) return;

  const estado = {
    etapa: 1,
    servicos: [],        // [{codigo, nome, duracao_min}] do servidor
    mes: mesAtual(),     // "AAAA-MM"
    limite: null,        // última data agendável
    diasDoMes: {},       // { "AAAA-MM-DD": nº de horários livres }
    dia: null,
    hora: null,
    duracao: null,
    assinatura: "",      // serviços+porte da última consulta
  };

  // ---------- utilidades ----------
  function el(tag, props = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const f of filhos) e.append(f);
    return e;
  }

  function mesAtual() {
    // Data de hoje no fuso de São Paulo (é o fuso do salão)
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    return p.slice(0, 7);
  }

  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  function dataBonita(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    const semana = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
    return `${semana}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  }

  function somaHora(hora, minutos) {
    const [h, m] = hora.split(":").map(Number);
    const t = h * 60 + m + minutos;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  const textoDuracao = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return h && m ? `${h}h${String(m).padStart(2, "0")}` : h ? `${h}h` : `${m} min`;
  };

  async function api(caminho, opcoes) {
    let resp;
    try {
      resp = await fetch(caminho, { headers: { "Content-Type": "application/json" }, ...opcoes });
    } catch {
      throw { status: 0, erro: "Sem conexão. Verifique a internet e tente de novo." };
    }
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw { status: resp.status, erro: json.erro || "Algo deu errado.", campos: json.campos };
    return json;
  }

  const porteEscolhido = () => ($('input[name="pet.porte"]:checked') || {}).value;
  const codigosEscolhidos = () => $$('input[name="servicos"]:checked').map((i) => i.value);

  // ---------- erros ----------
  function limparErros() {
    $$(".erro", form).forEach((e) => (e.textContent = ""));
    $$(".invalid", form).forEach((e) => e.classList.remove("invalid"));
    alerta("");
  }

  function erroCampo(chave, msg) {
    const alvo = $(`.erro[data-for="${CSS.escape(chave)}"]`, form);
    if (!alvo) return false;
    alvo.textContent = msg;
    const input = $(`[name="${CSS.escape(chave)}"]`, form);
    if (input) input.classList.add("invalid");
    return true;
  }

  function alerta(msg) {
    const a = $("#alerta");
    a.textContent = msg;
    a.hidden = !msg;
    if (msg) a.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const etapaDoCampo = (k) => (k.startsWith("tutor") || k === "observacoes" ? 3 : k === "data" || k === "hora" ? 2 : 1);

  // ---------- etapas ----------
  function irParaEtapa(n) {
    estado.etapa = n;
    $$(".step", form).forEach((s) => s.classList.toggle("is-active", Number(s.dataset.step) === n));
    $$(".stepper li", form).forEach((li) => {
      const i = Number(li.dataset.stepInd);
      li.classList.toggle("is-current", i === n);
      li.classList.toggle("is-done", i < n);
    });
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    if (n === 2) prepararEtapa2();
    if (n === 3) montarResumo();
  }

  function validarEtapa1() {
    limparErros();
    let ok = true;
    if (!$("#pet-nome").value.trim()) { erroCampo("pet.nome", "Informe o nome do pet."); ok = false; }
    if (!porteEscolhido()) { erroCampo("pet.porte", "Escolha o porte do pet."); ok = false; }
    if (!codigosEscolhidos().length) { erroCampo("servicos", "Escolha pelo menos um serviço."); ok = false; }
    return ok;
  }

  function validarEtapa2() {
    limparErros();
    if (!estado.dia) { erroCampo("data", "Escolha um dia no calendário."); return false; }
    if (!estado.hora) { erroCampo("hora", "Escolha um horário."); return false; }
    return true;
  }

  form.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-next]")) {
      if (estado.etapa === 1 && validarEtapa1()) irParaEtapa(2);
      else if (estado.etapa === 2 && validarEtapa2()) irParaEtapa(3);
    } else if (ev.target.closest("[data-prev]")) {
      irParaEtapa(estado.etapa - 1);
    }
  });

  // ---------- etapa 1: serviços ----------
  async function carregarServicos() {
    const lista = $("#lista-servicos");
    try {
      const { servicos } = await api("/api/servicos");
      estado.servicos = servicos;
      lista.replaceChildren(...servicos.map((s) => {
        const input = el("input", { type: "checkbox", name: "servicos", value: s.codigo });
        const info = el("span", {}, el("strong", { text: s.nome }), el("em", { text: s.descricao || "" }));
        return el("label", { class: "servico-op" }, input, info);
      }));
    } catch (e) {
      lista.replaceChildren(el("p", { class: "erro", text: e.erro }));
    }
  }

  // ---------- etapa 2: calendário e horários ----------
  async function prepararEtapa2() {
    const assinatura = `${codigosEscolhidos().join(",")}|${porteEscolhido()}`;
    if (assinatura !== estado.assinatura) {
      estado.assinatura = assinatura;
      estado.dia = null;
      estado.hora = null;
      $("#horarios-bloco").hidden = true;
    }
    await carregarMes();
  }

  async function carregarMes() {
    const grade = $("#cal-grid");
    grade.setAttribute("aria-busy", "true");
    const q = new URLSearchParams({ mes: estado.mes, servicos: codigosEscolhidos().join(","), porte: porteEscolhido() });
    try {
      const r = await api(`/api/disponibilidade/mes?${q}`);
      estado.diasDoMes = r.dias;
      estado.limite = r.limite;
      estado.duracao = r.duracao_min;
      $("#duracao-info").textContent = `Tempo estimado de atendimento: ${textoDuracao(r.duracao_min)}.`;
    } catch (e) {
      estado.diasDoMes = {};
      alerta(e.erro);
    }
    grade.removeAttribute("aria-busy");
    desenharCalendario();
  }

  function desenharCalendario() {
    const [a, m] = estado.mes.split("-").map(Number);
    $("#cal-titulo").textContent = `${MESES[m - 1]} de ${a}`;
    $("#cal-prev").disabled = estado.mes <= mesAtual();
    $("#cal-next").disabled = !estado.limite || estado.mes >= estado.limite.slice(0, 7);

    const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const celulas = [];
    for (let i = 0; i < primeiro; i++) celulas.push(el("span", { class: "cal-vazio", "aria-hidden": "true" }));
    for (let d = 1; d <= total; d++) {
      const iso = `${estado.mes}-${String(d).padStart(2, "0")}`;
      const livres = estado.diasDoMes[iso] || 0;
      const b = el("button", { type: "button", class: "cal-dia", text: String(d), "data-data": iso });
      if (livres > 0) b.classList.add("tem-vaga");
      else b.disabled = true;
      if (iso === estado.dia) b.classList.add("is-selected");
      b.setAttribute("aria-label", `${dataBonita(iso)}${livres ? `, ${livres} horários livres` : ", indisponível"}`);
      celulas.push(b);
    }
    $("#cal-grid").replaceChildren(...celulas);
  }

  $("#cal-prev").addEventListener("click", () => mudarMes(-1));
  $("#cal-next").addEventListener("click", () => mudarMes(1));
  function mudarMes(delta) {
    const [a, m] = estado.mes.split("-").map(Number);
    const d = new Date(Date.UTC(a, m - 1 + delta, 1));
    estado.mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    carregarMes();
  }

  $("#cal-grid").addEventListener("click", (ev) => {
    const b = ev.target.closest(".cal-dia");
    if (!b || b.disabled) return;
    estado.dia = b.dataset.data;
    estado.hora = null;
    limparErros();
    desenharCalendario();
    carregarHorarios();
  });

  async function carregarHorarios() {
    const bloco = $("#horarios-bloco"), grade = $("#horarios"), vazio = $("#horarios-vazio");
    bloco.hidden = false;
    $("#horarios-titulo").textContent = `Horários em ${dataBonita(estado.dia)}`;
    grade.replaceChildren(el("p", { class: "carregando", text: "Buscando horários…" }));
    vazio.hidden = true;
    const q = new URLSearchParams({ data: estado.dia, servicos: codigosEscolhidos().join(","), porte: porteEscolhido() });
    try {
      const r = await api(`/api/disponibilidade?${q}`);
      if (!r.horarios.length) { grade.replaceChildren(); vazio.hidden = false; return; }
      grade.replaceChildren(...r.horarios.map((h) => {
        const b = el("button", { type: "button", class: "hora", text: h, role: "radio", "aria-checked": "false", "data-hora": h });
        b.title = `${h} às ${somaHora(h, r.duracao_min)}`;
        return b;
      }));
    } catch (e) {
      grade.replaceChildren(el("p", { class: "erro", text: e.erro }));
    }
  }

  $("#horarios").addEventListener("click", (ev) => {
    const b = ev.target.closest(".hora");
    if (!b) return;
    estado.hora = b.dataset.hora;
    limparErros();
    $$(".hora", form).forEach((x) => {
      const sel = x === b;
      x.classList.toggle("is-selected", sel);
      x.setAttribute("aria-checked", String(sel));
    });
  });

  // ---------- etapa 3: resumo e envio ----------
  function montarResumo() {
    const nomes = codigosEscolhidos().map((c) => (estado.servicos.find((s) => s.codigo === c) || {}).nome || c);
    const linha = (rotulo, valor) => el("div", {}, el("dt", { text: rotulo }), el("dd", { text: valor }));
    $("#resumo").replaceChildren(
      el("h3", { text: "Resumo do agendamento" }),
      el("dl", {},
        linha("Pet", `${$("#pet-nome").value.trim()} (${({ pequeno: "porte pequeno", medio: "porte médio", grande: "porte grande" })[porteEscolhido()]})`),
        linha("Serviços", nomes.join(" + ")),
        linha("Quando", `${dataBonita(estado.dia)}, das ${estado.hora} às ${somaHora(estado.hora, estado.duracao)}`),
      ));
  }

  const tel = $("#tutor-telefone");
  tel.addEventListener("input", () => {
    const d = tel.value.replace(/\D/g, "").slice(0, 11);
    tel.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`
      : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (estado.etapa !== 3) return;
    limparErros();
    const btn = $("#btn-enviar");
    btn.disabled = true;
    btn.textContent = "Enviando…";

    const corpo = {
      servicos: codigosEscolhidos(),
      data: estado.dia,
      hora: estado.hora,
      observacoes: $("#obs").value,
      pet: {
        nome: $("#pet-nome").value,
        raca: $("#pet-raca").value,
        especie: ($('input[name="pet.especie"]:checked') || {}).value,
        porte: porteEscolhido(),
      },
      tutor: { nome: $("#tutor-nome").value, telefone: tel.value, email: $("#tutor-email").value },
    };

    try {
      const r = await api("/api/agendamentos", { method: "POST", body: JSON.stringify(corpo) });
      location.href = `confirmacao.html?codigo=${encodeURIComponent(r.codigo)}`;
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Confirmar agendamento";
      if (e.status === 409) {
        // Horário tomado por outra pessoa (ou regra de data): volta e atualiza os horários.
        estado.hora = null;
        irParaEtapa(2);
        alerta(e.erro);
        await carregarMes();
        if (estado.dia) carregarHorarios();
      } else if (e.campos) {
        const extras = [];
        let menor = 3;
        for (const [k, msg] of Object.entries(e.campos)) {
          if (!erroCampo(k, msg)) extras.push(msg);
          menor = Math.min(menor, etapaDoCampo(k));
        }
        if (menor !== estado.etapa) irParaEtapa(menor);
        alerta(extras.length ? extras.join(" ") : e.erro);
      } else {
        alerta(e.erro);
      }
    }
  });

  carregarServicos();
})();
