import { config, validarConfigDeProducao } from "./config.js";
import { abrirBanco } from "./db.js";
import { criarApp } from "./app.js";

validarConfigDeProducao();
const db = abrirBanco(config.dbPath);
const app = criarApp({ db });

const servidor = app.listen(config.port, () => {
  console.log(`Peludinho rodando em http://localhost:${config.port}`);
  if (!process.env.ADMIN_TOKEN) console.log("Painel do salão: token de desenvolvimento 'dev-admin-token'.");
});

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => servidor.close(() => { db.close(); process.exit(0); }));
}
