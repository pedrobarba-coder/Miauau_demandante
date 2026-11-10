// Tela de confirmação: mostra o agendamento e o botão do WhatsApp.
(() => {
  const card = document.getElementById("conf-card");
  const titulo = document.getElementById("conf-titulo");
  if (!card) return;

  const el = (tag, props = {}, ...filhos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
    }
    e.append(...filhos);
    return e;
  };

  const codigo = (new URLSearchParams(location.search).get("codigo") || "").trim();

  function dataBonita(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    const semana = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
    return `${semana}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  }

  function naoEncontrado() {
    titulo.textContent = "Agendamento não encontrado";
    card.replaceChildren(
      el("p", { text: "Confira o código ou fale com a gente pelo WhatsApp." }),
      el("a", { class: "btn btn-primary", href: "agendar.html", text: "Fazer um novo agendamento" }));
  }

  function mostrar(ag) {
    const cancelado = ag.status === "cancelado";
    titulo.textContent = cancelado ? "Agendamento cancelado" : "Agendamento confirmado! 🐾";

    const linha = (r, v) => el("div", {}, el("dt", { text: r }), el("dd", { text: v }));
    const filhos = [
      el("div", { class: "conf-codigo" },
        el("span", { text: "Seu código" }), el("strong", { text: ag.codigo })),
      el("dl", { class: "conf-dados" },
        linha("Pet", ag.pet.nome),
        linha("Serviços", ag.servicos.map((s) => s.nome).join(" + ")),
        linha("Quando", `${dataBonita(ag.data)}, das ${ag.inicio} às ${ag.fim}`),
        linha("Local", "Rua Francisco Coimbra, 610 — Penha, São Paulo")),
    ];

    if (!cancelado) {
      filhos.push(
        el("p", { class: "conf-aviso", text: `Olá, ${ag.tutor}! Seu horário está reservado. Guarde o código acima — com ele você consulta ou cancela o agendamento.` }),
        el("div", { class: "conf-acoes" },
          el("a", { class: "btn btn-primary", href: ag.whatsapp_url, target: "_blank", rel: "noopener", text: "Enviar confirmação no WhatsApp" }),
          el("button", { class: "btn btn-secondary", type: "button", id: "btn-cancelar", text: "Cancelar agendamento" })),
        el("p", { class: "erro", id: "conf-erro", role: "alert" }));
    } else {
      filhos.push(el("div", { class: "conf-acoes" },
        el("a", { class: "btn btn-primary", href: "agendar.html", text: "Agendar outro horário" })));
    }
    card.replaceChildren(...filhos);

    const bt = document.getElementById("btn-cancelar");
    if (bt) bt.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
      bt.disabled = true;
      try {
        const r = await fetch(`/api/agendamentos/${encodeURIComponent(ag.codigo)}`, { method: "DELETE" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.erro || "Não foi possível cancelar.");
        mostrar(j);
      } catch (e) {
        bt.disabled = false;
        document.getElementById("conf-erro").textContent = e.message;
      }
    });
  }

  if (!/^[A-Za-z0-9]{8}$/.test(codigo)) { naoEncontrado(); return; }
  fetch(`/api/agendamentos/${encodeURIComponent(codigo)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(mostrar)
    .catch(naoEncontrado);
})();
