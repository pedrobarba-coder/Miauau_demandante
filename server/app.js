import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { timingSafeEqual, createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { ErroApi } from "./validacao.js";
import {
  listarServicos, disponibilidade, disponibilidadeDoMes, criarAgendamento, buscarPorCodigo,
  visaoPublica, cancelarPorCodigo, listarAgendamentos, atualizarAgendamento, removerAgendamento,
} from "./agendamentos.js";
import { agoraNoSalao } from "./rules.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

function tokenConfere(recebido) {
  if (!config.adminToken) return false;
  // Compara hashes para tempo constante mesmo com tamanhos diferentes.
  const h = (s) => createHash("sha256").update(String(s)).digest();
  return timingSafeEqual(h(recebido), h(config.adminToken));
}

function exigirAdmin(req, res, next) {
  if (!config.adminToken) return next(new ErroApi(503, "Painel desativado (ADMIN_TOKEN não definido)."));
  const m = /^Bearer (.+)$/.exec(req.get("authorization") || "");
  if (!m || !tokenConfere(m[1])) return next(new ErroApi(401, "Não autorizado."));
  next();
}

/**
 * Monta a aplicação. `db` e `agora` são injetados para facilitar os testes
 * (banco em memória e relógio fixo). `limites: false` desliga o rate limit.
 */
export function criarApp({ db, agora = agoraNoSalao, limites = true } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Sprint 1 usa style="" inline
        fontSrc: ["https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        frameSrc: ["https://www.google.com"],  // mapa em sobre.html
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  }));
  app.use(express.json({ limit: "20kb" }));

  // ---------- API ----------
  const api = express.Router();
  api.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  if (limites) {
    api.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false,
      message: { erro: "Muitas requisições. Tente novamente em alguns minutos." } }));
  }
  const limiteCriacao = limites
    ? rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
        message: { erro: "Muitos agendamentos seguidos. Fale com a gente pelo WhatsApp." } })
    : (req, res, next) => next();
  const limiteAdmin = limites
    ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
        message: { erro: "Muitas tentativas." } })
    : (req, res, next) => next();

  api.get("/servicos", (req, res) => res.json({ servicos: listarServicos(db) }));
  api.get("/disponibilidade", (req, res) => res.json(disponibilidade(db, req.query, agora())));
  api.get("/disponibilidade/mes", (req, res) => res.json(disponibilidadeDoMes(db, req.query, agora())));

  api.post("/agendamentos", limiteCriacao, (req, res) => {
    const ag = criarAgendamento(db, req.body, agora());
    res.status(201).json(visaoPublica(ag));
  });

  api.get("/agendamentos/:codigo", (req, res) => {
    const ag = buscarPorCodigo(db, req.params.codigo);
    if (!ag) throw new ErroApi(404, "Agendamento não encontrado.");
    res.json(visaoPublica(ag));
  });

  api.delete("/agendamentos/:codigo", limiteCriacao, (req, res) => {
    res.json(visaoPublica(cancelarPorCodigo(db, req.params.codigo)));
  });

  // Painel do salão
  const admin = express.Router();
  admin.use(limiteAdmin, exigirAdmin);
  admin.get("/agendamentos", (req, res) => res.json({ agendamentos: listarAgendamentos(db, req.query) }));
  admin.patch("/agendamentos/:id", (req, res) => {
    res.json(atualizarAgendamento(db, idNumerico(req.params.id), req.body, agora()));
  });
  admin.delete("/agendamentos/:id", (req, res) => {
    removerAgendamento(db, idNumerico(req.params.id));
    res.status(204).end();
  });
  api.use("/admin", admin);

  api.use((req, res, next) => next(new ErroApi(404, "Rota não encontrada.")));
  app.use("/api", api);

  // ---------- Site (só o que é público; nunca server/, data/ ou .git) ----------
  const so = (arquivo) => (req, res) => res.sendFile(join(raiz, arquivo));
  app.get(["/", "/index.html"], so("index.html"));
  for (const p of ["sobre", "agendar", "confirmacao", "admin"]) app.get(`/${p}.html`, so(`${p}.html`));
  const estatico = { dotfiles: "ignore", index: false, maxAge: "1h" };
  for (const pasta of ["css", "js", "images"]) app.use(`/${pasta}`, express.static(join(raiz, pasta), estatico));

  app.use((req, res) => res.status(404).type("text").send("Página não encontrada."));

  // ---------- Erros ----------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ErroApi) return res.status(err.status).json({ erro: err.message, campos: err.campos });
    if (err.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido." });
    if (err.type === "entity.too.large") return res.status(413).json({ erro: "Requisição grande demais." });
    console.error(err); // detalhes só no log do servidor
    res.status(500).json({ erro: "Erro interno. Tente novamente ou fale com a gente pelo WhatsApp." });
  });

  return app;
}

function idNumerico(valor) {
  if (!/^\d{1,9}$/.test(valor)) throw new ErroApi(400, "Identificador inválido.");
  return Number(valor);
}
