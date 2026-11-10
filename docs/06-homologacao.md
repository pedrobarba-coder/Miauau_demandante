# 6. Homologação com o cliente

> **Status: não realizada.** Este documento é o roteiro para fazê-la com a
> Selma (Banho e Tosa Pet Peludinho). Preencha a ata ao final.

## Preparação
1. Rodar `npm run seed` e `npm start` (ou usar a versão publicada, se houver).
2. Ter em mãos o celular da cliente e o computador do salão.

## Roteiro (marcar ✔ / ✘ e anotar)
| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Agendar banho para um cão pequeno, amanhã às 9h | Confirmação com código e botão WhatsApp |
| 2 | Mesmo cenário para um cão **grande** | Tempo estimado maior; horário final correto |
| 3 | Tentar agendar o mesmo horário já ocupado | Horário não aparece / mensagem clara |
| 4 | Tentar domingo | Dia indisponível no calendário |
| 5 | Cadastrar telefone errado | Mensagem de erro no campo |
| 6 | Tocar em "Enviar confirmação no WhatsApp" | Abre conversa com mensagem pronta |
| 7 | Cancelar pelo código | Horário volta a ficar livre |
| 8 | Entrar no painel `/admin.html` | Vê agenda do dia; concluir, faltou, remarcar, cancelar funcionam |
| 9 | Usar tudo pelo celular | Fácil de usar |

## Perguntas ao cliente
- As regras em `docs/01-regras-da-agenda.md` refletem o salão? (tempos, porte, horários, capacidade)
- O texto da confirmação e a mensagem do WhatsApp estão bons?
- Falta alguma informação do pet (vacina, temperamento, alergia)?
- Quer preços no formulário? Quer lembrete automático?

## Ata de homologação
- Data: ____/____/______  Participantes: _______________________
- Ajustes solicitados: _____________________________________________
- Aprovado?  ( ) sim  ( ) sim, com ajustes  ( ) não
- Assinatura/aceite (pode ser por mensagem): _______________________
