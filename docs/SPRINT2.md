# Sprint 2 — Agendamento online

| # | Atividade | Status | Onde está |
|---|---|---|---|
| 1 | Levantar regras da agenda (serviços, duração, porte, horários) | ✅ feito (valores-modelo, a confirmar com o cliente) | [01-regras-da-agenda.md](01-regras-da-agenda.md), `server/config.js` |
| 2 | Definir layout e fluxo do formulário | ✅ feito | [02-fluxo-do-formulario.md](02-fluxo-do-formulario.md) |
| 3 | Configurar banco de dados e ambiente de desenvolvimento | ✅ feito (SQLite + Node 22) | [04-ambiente-e-api.md](04-ambiente-e-api.md), `package.json`, `.env.example` |
| 4 | Modelar a base (tutor, pet, serviço, agendamento) | ✅ feito | [03-modelagem-do-banco.md](03-modelagem-do-banco.md), `server/schema.sql` |
| 5 | Back-end do CRUD de agendamentos com bloqueio automático de horário | ✅ feito | `server/agendamentos.js`, `server/app.js` |
| 6 | Front-end (calendário, escolha de horário, cadastro tutor/pet) | ✅ feito | `agendar.html`, `js/agendar.js`, `css/agendamento.css` |
| 7 | Confirmação do agendamento (tela e link de WhatsApp) | ✅ feito | `confirmacao.html`, `js/confirmacao.js` |
| 8 | Testes de conflito, validação e segurança | ✅ feito (24 automatizados + E2E no navegador) | [05-testes.md](05-testes.md), `test/` |
| 9 | Homologação com o cliente | ⏳ roteiro e ata prontos; **não realizada** | [06-homologacao.md](06-homologacao.md) |
| 10 | Deploy (no ar) | ⏳ preparado (Dockerfile + guia); **não publicado** | [07-deploy.md](07-deploy.md), `Dockerfile` |

Extra: painel do salão (`admin.html`) para ver a agenda, concluir, marcar
falta, remarcar e cancelar — necessário para o CRUD e para a homologação.
