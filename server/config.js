// Configuração central. Tudo que o salão pode querer mudar fica aqui
// ou em variáveis de ambiente (ver .env.example).

const env = process.env;

export const config = {
  port: Number(env.PORT) || 3000,
  dbPath: env.DB_PATH || "./data/peludinho.db",
  adminToken: env.ADMIN_TOKEN || (env.NODE_ENV === "production" ? "" : "dev-admin-token"),
  whatsapp: (env.WHATSAPP_NUMBER || "5511994375673").replace(/\D/g, ""),
  nomeSalao: "Banho e Tosa Pet Peludinho",
  fusoHorario: "America/Sao_Paulo",

  // --- Regras da agenda (ver docs/01-regras-da-agenda.md) ---
  capacidade: Number(env.CAPACIDADE) || 1, // pets atendidos ao mesmo tempo
  passoMin: 30,            // os horários começam de 30 em 30 minutos
  antecedenciaMin: 120,    // só agenda com 2h de antecedência
  diasMaximos: 30,         // só agenda até 30 dias à frente

  // Horário de funcionamento por dia da semana (0 = domingo), em minutos
  // desde 00:00. null = fechado. (Valores-modelo vindos da Sprint 1.)
  funcionamento: {
    0: null,
    1: [8 * 60, 18 * 60],
    2: [8 * 60, 18 * 60],
    3: [8 * 60, 18 * 60],
    4: [8 * 60, 18 * 60],
    5: [8 * 60, 18 * 60],
    6: [8 * 60, 14 * 60],
  },

  // O porte do pet multiplica a duração do serviço.
  fatorPorte: { pequeno: 1, medio: 1.25, grande: 1.5 },
};

export function validarConfigDeProducao() {
  if (process.env.NODE_ENV === "production" && config.adminToken.length < 16) {
    throw new Error("Defina ADMIN_TOKEN (mínimo 16 caracteres) em produção.");
  }
}
