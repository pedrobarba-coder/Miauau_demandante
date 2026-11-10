// Painel do salão: lista a agenda do dia e permite concluir, marcar falta,
// cancelar e remarcar. A senha fica só na memória da aba (sessionStorage).
(() => {
  const login = document.getElementById("admin-login");
  if (!login) return;

  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...filhos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
    }
    e.append(...filhos);
    return e;
  };

  let token = sessionStorage.getItem("peludinho_admin") || "";
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  $("admin-data").value = hoje;

  async function chamar(caminho, opcoes = {}) {
    const r = await fetch(caminho, {
      ...opcoes,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { sair(); throw new Error("Senha incorreta."); }
    if (!r.ok) throw new Error(j.erro || "Erro inesperado.");
    return j;
  }

  function aviso(msg) { const a = $("admin-aviso"); a.textContent = msg; a.hidden = !msg; }

  async function carregar() {
    aviso("");
    const data = $("admin-data").value;
    const { agendamentos } = await chamar(`/api/admin/agendamentos?data=${encodeURIComponent(data)}`);
    const lista = $("admin-lista");
    if (!agendamentos.length) { lista.replaceChildren(el("p", { class: "carregando", text: "Nenhum agendamento neste dia." })); return; }

    lista.replaceChildren(...agendamentos.map((a) => {
      const acao = (rotulo, fn, classe = "btn-secondary") => {
        const b = el("button", { type: "button", class: `btn ${classe} btn-sm`, text: rotulo });
        b.addEventListener("click", async () => { try { await fn(); await carregar(); } catch (e) { aviso(e.message); } });
        return b;
      };
      const patch = (corpo) => chamar(`/api/admin/agendamentos/${a.id}`, { method: "PATCH", body: JSON.stringify(corpo) });

      const botoes = [];
      if (a.status === "confirmado") {
        botoes.push(acao("Concluir", () => patch({ status: "concluido" })),
                    acao("Faltou", () => patch({ status: "faltou" })),
                    acao("Remarcar", () => {
                      const h = prompt("Novo horário (HH:MM) no mesmo dia, ou AAAA-MM-DD HH:MM:", a.inicio);
                      if (!h) return Promise.resolve();
                      const [d, hh] = h.includes(" ") ? h.split(" ") : [a.data, h];
                      return patch({ data: d, hora: hh });
                    }),
                    acao("Cancelar", () => confirm("Cancelar este agendamento?") ? patch({ status: "cancelado" }) : Promise.resolve()));
      } else if (a.status === "cancelado") {
        botoes.push(acao("Reativar", () => patch({ status: "confirmado" })));
      }

      const zap = `https://wa.me/55${a.tutor.telefone}`;
      return el("article", { class: `admin-item status-${a.status}` },
        el("div", { class: "admin-hora", text: `${a.inicio}–${a.fim}` }),
        el("div", { class: "admin-info" },
          el("strong", { text: `${a.pet.nome} (${a.pet.porte})${a.pet.raca ? " · " + a.pet.raca : ""}` }),
          el("span", { text: a.servicos.map((s) => s.nome).join(" + ") }),
          el("span", {}, document.createTextNode(`${a.tutor.nome} · `),
             el("a", { href: zap, target: "_blank", rel: "noopener", text: a.tutor.telefone })),
          a.observacoes ? el("em", { text: `Obs.: ${a.observacoes}` }) : document.createTextNode(""),
          el("small", { text: `código ${a.codigo}` })),
        el("div", { class: "admin-status", text: a.status }),
        el("div", { class: "admin-acoes" }, ...botoes));
    }));
  }

  function entrar() { login.hidden = true; $("admin-painel").hidden = false; carregar().catch((e) => aviso(e.message)); }
  function sair() { sessionStorage.removeItem("peludinho_admin"); token = ""; login.hidden = false; $("admin-painel").hidden = true; }

  login.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    token = $("admin-token").value;
    $("admin-erro").textContent = "";
    try {
      await chamar(`/api/admin/agendamentos?data=${hoje}`);
      sessionStorage.setItem("peludinho_admin", token);
      $("admin-token").value = "";
      entrar();
    } catch (e) { $("admin-erro").textContent = e.message; }
  });

  const mudaDia = (n) => {
    const [a, m, d] = $("admin-data").value.split("-").map(Number);
    $("admin-data").value = new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
    carregar().catch((e) => aviso(e.message));
  };
  $("dia-ant").addEventListener("click", () => mudaDia(-1));
  $("dia-prox").addEventListener("click", () => mudaDia(1));
  $("admin-data").addEventListener("change", () => carregar().catch((e) => aviso(e.message)));
  $("admin-sair").addEventListener("click", sair);

  if (token) entrar();
})();
