# 4. Ambiente de desenvolvimento e API

## Requisitos
- **Node.js 22.13 ou superior** (usa o SQLite embutido do Node — não há
  banco para instalar).

## Rodando
```bash
npm install
npm run seed     # opcional: cria 3 agendamentos de exemplo
npm start        # http://localhost:3000
npm test         # roda os testes automatizados
```
Em desenvolvimento a senha do painel (`/admin.html`) é `dev-admin-token`.
Para configurar de outra forma, copie `.env.example` para `.env` e rode
`node --env-file=.env server/index.js`.

| Variável | Para quê | Padrão |
|---|---|---|
| `PORT` | porta do servidor | 3000 |
| `DB_PATH` | arquivo do banco | `./data/peludinho.db` |
| `ADMIN_TOKEN` | senha do painel (**obrigatória** em produção, ≥ 16 caracteres) | só em dev |
| `WHATSAPP_NUMBER` | número do salão (DDI+DDD+número) | 5511994375673 |
| `CAPACIDADE` | pets atendidos ao mesmo tempo | 1 |
| `TRUST_PROXY` | nº de proxies à frente (para o limite por IP) | — |

## Estrutura
```
server/   config.js  rules.js (regras puras)  validacao.js
          agendamentos.js (regras + banco)  db.js  schema.sql  app.js  index.js  seed.js
test/     regras.test.js  api.test.js  helpers.js
docs/     documentação da sprint
index.html sobre.html agendar.html confirmacao.html admin.html   css/ js/ images/
```

## API
Públicas:
| Método e rota | O que faz |
|---|---|
| `GET /api/servicos` | lista os serviços |
| `GET /api/disponibilidade?data=&servicos=banho,unhas&porte=` | horários livres do dia |
| `GET /api/disponibilidade/mes?mes=AAAA-MM&servicos=&porte=` | nº de horários livres por dia |
| `POST /api/agendamentos` | cria (valida e **bloqueia** o horário) → 201 / 409 se ocupado |
| `GET /api/agendamentos/:codigo` | consulta pelo código (sem telefone/e-mail) |
| `DELETE /api/agendamentos/:codigo` | cancela pelo código |

Painel (`Authorization: Bearer <ADMIN_TOKEN>`):
| Método e rota | O que faz |
|---|---|
| `GET /api/admin/agendamentos?data=` (ou `de=&ate=`) | agenda, com dados do tutor |
| `PATCH /api/admin/agendamentos/:id` | muda `status`, `data`/`hora` (remarcar), `observacoes` |
| `DELETE /api/admin/agendamentos/:id` | remove definitivamente |

Exemplo de criação:
```json
POST /api/agendamentos
{ "servicos": ["banho"], "data": "2026-11-11", "hora": "09:00",
  "pet": { "nome": "Thor", "porte": "grande", "raca": "Golden" },
  "tutor": { "nome": "Maria Souza", "telefone": "(11) 98888-1111" } }
```

## Segurança implementada
- Consultas SQL **parametrizadas** (sem concatenar entrada do usuário).
- Validação de tipo, formato e tamanho de **todos** os campos; campos
  desconhecidos (ex.: `status`, `id`) são ignorados.
- Front-end escreve dados com `textContent` (sem `innerHTML`) → sem XSS;
  CSP via Helmet bloqueia scripts de outras origens.
- Painel com token comparado em tempo constante; rate limit por IP
  (300 req/15 min geral, 10 agendamentos/hora, 60 req/15 min no painel).
- Servidor só entrega as páginas e as pastas `css/`, `js/`, `images/` —
  `server/`, `data/`, `.git`, `.env` retornam 404.
- Erros internos não expõem detalhes; corpo limitado a 20 KB.
- Página pública de confirmação não mostra telefone/e-mail.

## Limitações conhecidas (aceitas para um projeto de extensão)
- Painel com senha única (sem contas de usuário).
- Sem envio automático de WhatsApp/e-mail: o cliente toca no botão.
- SQLite: adequado para um único servidor; não para múltiplas réplicas.
- Sem política de privacidade/LGPD formal (há apenas o aviso de uso dos dados).
