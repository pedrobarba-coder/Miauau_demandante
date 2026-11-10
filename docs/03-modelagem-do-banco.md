# 3. Modelagem da base de dados

Banco: **SQLite** (arquivo único, sem instalar servidor — adequado para o
porte do projeto). Esquema completo e comentado em `server/schema.sql`.

```mermaid
erDiagram
  TUTOR ||--o{ PET : possui
  TUTOR ||--o{ AGENDAMENTO : faz
  PET   ||--o{ AGENDAMENTO : recebe
  AGENDAMENTO ||--|{ AGENDAMENTO_SERVICO : inclui
  SERVICO ||--o{ AGENDAMENTO_SERVICO : "é incluído em"

  TUTOR { int id PK
          text nome
          text telefone UK "só dígitos, com DDD"
          text email
          text criado_em }
  PET { int id PK
        int tutor_id FK
        text nome "único por tutor"
        text especie "cao | gato"
        text raca
        text porte "pequeno | medio | grande"
        text observacoes }
  SERVICO { int id PK
            text codigo UK
            text nome
            text descricao
            int duracao_min "porte pequeno"
            int ativo }
  AGENDAMENTO { int id PK
                text codigo UK "código secreto da confirmação"
                int tutor_id FK
                int pet_id FK
                text data "AAAA-MM-DD"
                int inicio_min "minutos desde 00:00"
                int fim_min
                text status "confirmado | cancelado | concluido | faltou"
                text observacoes }
  AGENDAMENTO_SERVICO { int agendamento_id PK,FK
                        int servico_id PK,FK }
```

## Escolhas de modelagem
- **Horário em minutos** (`inicio_min`/`fim_min`): checar sobreposição vira
  uma comparação de números, sem lidar com fuso/formatos de hora.
- **N:N agendamento ↔ serviço**: um atendimento pode ter vários serviços.
- **Tutor identificado pelo telefone** (único). Um cadastro já existente
  não é alterado por quem apenas conhece o número.
- **Restrições no próprio banco** (`CHECK`, `UNIQUE`, chaves estrangeiras):
  mesmo que a aplicação falhe, dados inválidos não entram.
- **Código do agendamento** com 8 caracteres de um alfabeto sem letras
  confusas (sem 0/O/1/I): ~10¹² combinações, serve como "senha" do
  cliente para consultar/cancelar sem criar conta.
- Índices em `(data, status)` e `(pet_id, data)` para as consultas da agenda.
