// Popula o banco com agendamentos de exemplo (só para demonstração/homologação).
//   npm run seed
import { config } from "./config.js";
import { abrirBanco } from "./db.js";
import { criarAgendamento } from "./agendamentos.js";
import { agoraNoSalao, somarDias, diaDaSemana } from "./rules.js";

const db = abrirBanco(config.dbPath);
const agora = agoraNoSalao();

// próximo dia útil (seg–sex) a partir de amanhã
let dia = somarDias(agora.data, 1);
while (diaDaSemana(dia) === 0 || diaDaSemana(dia) === 6) dia = somarDias(dia, 1);

const exemplos = [
  { hora: "09:00", servicos: ["banho"], pet: { nome: "Thor", porte: "grande", raca: "Golden Retriever" }, tutor: { nome: "Maria Souza", telefone: "(11) 98888-1111" } },
  { hora: "11:00", servicos: ["banho", "tosa-higienica"], pet: { nome: "Mel", porte: "pequeno", raca: "Shih Tzu" }, tutor: { nome: "João Pereira", telefone: "(11) 97777-2222" } },
  { hora: "14:00", servicos: ["tosa-tesoura"], pet: { nome: "Bob", porte: "medio", raca: "Spitz" }, tutor: { nome: "Ana Lima", telefone: "(11) 96666-3333" } },
];

for (const e of exemplos) {
  try {
    const ag = criarAgendamento(db, { ...e, data: dia }, agora);
    console.log(`criado: ${ag.pet.nome} — ${ag.data} ${ag.inicio} (código ${ag.codigo})`);
  } catch (err) {
    console.log(`ignorado (${e.pet.nome}): ${err.message}`);
  }
}
db.close();
