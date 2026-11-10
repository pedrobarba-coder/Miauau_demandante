# 1. Regras da agenda

> **Atenção:** os valores abaixo são **valores-modelo** (os horários vêm da
> Sprint 1, que também eram modelo). Devem ser confirmados com a Selma na
> homologação. Todos ficam em `server/config.js` e `server/db.js`, então
> mudar uma regra é mudar uma linha.

## Horário de funcionamento
| Dia | Atendimento |
|---|---|
| Segunda a sexta | 08:00 – 18:00 |
| Sábado | 08:00 – 14:00 |
| Domingo | Fechado |

Um atendimento precisa **terminar** até o fechamento (ex.: um banho de 1h
no sábado pode começar no máximo às 13:00).

## Serviços e duração
Duração base, para pet de **porte pequeno**:

| Serviço | Duração base |
|---|---|
| Banho | 60 min |
| Tosa higiênica | 30 min |
| Tosa na tesoura | 90 min |
| Hidratação | 30 min |
| Corte de unhas | 15 min |
| Limpeza de ouvidos | 15 min |

O cliente pode combinar vários serviços; as durações **somam**.

## Porte do pet
| Porte | Referência | Fator de tempo |
|---|---|---|
| Pequeno | até 10 kg | × 1,00 |
| Médio | 10 a 25 kg | × 1,25 |
| Grande | acima de 25 kg | × 1,50 |

**Duração final = (soma dos serviços × fator do porte), arredondada para
cima ao próximo múltiplo de 30 min.**
Exemplos: banho em porte médio = 75 → **90 min**; banho + unhas em porte
grande = 112,5 → **120 min**; só unhas em porte pequeno = 15 → **30 min**.

## Bloqueio de horário
- Os horários de início saem de **30 em 30 minutos**.
- O salão atende **1 pet por vez** (`CAPACIDADE=1`, configurável).
- Um horário só é oferecido se o atendimento inteiro (início → fim) não
  se sobrepõe a outro agendamento. Atendimentos que apenas "encostam"
  (um termina 10:00, outro começa 10:00) são permitidos.
- Agendamentos **cancelados ou com falta** não bloqueiam o horário;
  **confirmados e concluídos** bloqueiam.
- O mesmo pet não pode ter dois agendamentos sobrepostos.
- O bloqueio é aplicado no servidor, dentro de uma transação — não
  depende do navegador do cliente.

## Antecedência
- Mínimo de **2 horas** de antecedência (para o mesmo dia).
- Máximo de **30 dias** à frente.

## Cancelamento e remarcação
- O cliente cancela sozinho usando o **código de confirmação** (8 caracteres).
- O salão (painel) pode concluir, marcar falta, cancelar, reativar e remarcar.
- Reativar/remarcar só é aceito se o horário estiver livre.

## Perguntas em aberto para o cliente
1. Quantos profissionais atendem ao mesmo tempo? (hoje: 1)
2. Há pausa de almoço?
3. Os tempos por serviço e os limites de peso estão corretos?
4. Atende gatos? (o sistema aceita; pode ser desativado)
5. Quer exibir preços no formulário?
