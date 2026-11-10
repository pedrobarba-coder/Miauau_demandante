# 7. Deploy

> **Status: não publicado** (decisão do projeto: o repositório é a entrega).
> Este guia deixa tudo pronto para colocar no ar quando/se for preciso.

**Importante:** diferente da Sprint 1, o site agora tem back-end, então
**GitHub Pages não serve** para a parte de agendamento (ele só hospeda
arquivos estáticos). Opções: Render, Railway, Fly.io ou uma VPS.

## Checklist antes de publicar
- [ ] Definir `ADMIN_TOKEN` forte (≥ 16 caracteres) e **NODE_ENV=production**
- [ ] Definir `WHATSAPP_NUMBER` e confirmar as regras com o cliente
- [ ] Usar **disco persistente** para `DB_PATH` (ex.: `/data/peludinho.db`) e fazer backup periódico do arquivo
- [ ] Servir por **HTTPS** e definir `TRUST_PROXY=1` atrás de proxy
- [ ] Revisar aviso de privacidade (dados pessoais de tutores — LGPD)

## Com Docker
```bash
docker build -t peludinho .
docker run -d -p 3000:3000 -v peludinho-data:/app/data \
  -e NODE_ENV=production -e ADMIN_TOKEN=<senha-longa> -e TRUST_PROXY=1 peludinho
```

## Sem Docker (Render/Railway/VPS)
- Build: `npm ci --omit=dev`  •  Start: `npm start`  •  Node 22.13+
- Variáveis de ambiente conforme `docs/04-ambiente-e-api.md`.

## Pós-deploy (smoke test)
`GET /api/servicos` responde; fazer um agendamento de teste e cancelá-lo;
conferir que `/server/db.js` e `/.env` retornam 404; entrar no painel.
