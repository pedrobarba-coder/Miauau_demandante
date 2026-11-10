# 5. Testes de conflito, validação e segurança

`npm test` → **24 testes automatizados** (Node test runner, banco em
memória, relógio fixo em 10/11/2026 10:00 para resultados reproduzíveis).

| Área | O que é verificado |
|---|---|
| Conflito | mesmo horário, sobreposição pelo início/fim, encaixe "encostando" permitido, horário some da lista ao reservar e volta ao cancelar |
| Concorrência | 8 pedidos simultâneos ao mesmo horário → exatamente 1 vence, 7 recebem 409 |
| Capacidade | com 2 vagas aceita 2 e bloqueia o 3º; o mesmo pet não duplica |
| Regras de data | domingo, depois do fechamento do sábado, passado, > 30 dias, < 2 h de antecedência, fora do passo de 30 min |
| Duração | soma × porte, arredondamento |
| Validação | campos obrigatórios, tipos (objeto no lugar de texto), tamanhos, telefone, e-mail, datas inexistentes (31/02), caracteres de controle, JSON quebrado, corpo gigante |
| Segurança | SQL injection (nome `'); DROP TABLE…`), HTML/JS no nome, campos extras (`status`, `codigo`), tutor existente não sobrescrito, painel sem token / token errado, arquivos internos (`/server`, `/.git`, `/.env`, `..%2f`) → 404, erros sem stack trace, sem `X-Powered-By` |
| Painel | remarcar respeitando bloqueio, cancelar libera, reativar exige horário livre, status inválido, id inexistente, remoção em cascata |

Também foi feito um **teste de ponta a ponta no navegador** (Chrome headless):
preencher as 3 etapas, erro de telefone vindo do servidor, confirmação,
segundo cliente não ver mais o horário reservado, cancelamento pela tela de
confirmação, login errado no painel, layout mobile (390 px).

Não coberto: teste de carga, leitores de tela reais, navegadores além do Chrome.
