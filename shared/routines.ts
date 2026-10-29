import type { Category } from "./types";
export interface Routine {
  id: string;
  version: number;
  sourceCheckedOn: string;
  sourceSummary: string;
  name: string;
  initials: string;
  role: string;
  theme: string;
  title: string;
  description: string;
  principle: string;
  sourceLabel: string;
  sourceUrl: string;
  goals: {
    id: string;
    title: string;
    description: string;
    category: Category;
    time: string;
  }[];
}
export const routines: Routine[] = [
  {
    id: "ilia",
    version: 1,
    sourceCheckedOn: "2026-10-28",
    sourceSummary:
      "Em seu relato autobiográfico, Topuria destaca o valor de repetir, aprender com erros e continuar praticando. A fonte não estabelece uma agenda para o usuário.",
    name: "Ilia Topuria",
    initials: "IT",
    role: "Lutador de MMA",
    theme: "peach",
    title: "A disciplina de um campeão",
    description: "Um dia com intenção, movimento e espaço para se recuperar.",
    principle:
      "Inspirada na constância e na repetição descritas por Topuria em seu site. As atividades abaixo são uma adaptação do app; não reproduzem seu treino profissional.",
    sourceLabel: "Relato de Ilia Topuria · site oficial",
    sourceUrl: "https://iliatopuriaoficial.com/en/this-is-me/",
    goals: [
      {
        id: "intention",
        title: "Definir uma intenção para o dia",
        description: "Escolha uma prioridade e escreva por que ela importa.",
        category: "Pessoal",
        time: "Manhã",
      },
      {
        id: "movement",
        title: "Reservar um momento para me movimentar",
        description:
          "Escolha uma atividade que já faça parte da sua vida e respeite seu ritmo.",
        category: "Saúde",
        time: "Durante o dia",
      },
      {
        id: "practice",
        title: "Praticar uma habilidade com foco",
        description:
          "Dedique um bloco sem distrações a algo que deseja melhorar.",
        category: "Estudos",
        time: "Tarde",
      },
      {
        id: "reflection",
        title: "Desacelerar e revisar o dia",
        description: "Anote uma conquista e prepare um momento de descanso.",
        category: "Pessoal",
        time: "Noite",
      },
    ],
  },
  {
    id: "murakami",
    version: 1,
    sourceCheckedOn: "2026-10-28",
    sourceSummary:
      "Na entrevista Hello, Haruki, Murakami fala de corrida, escrita, leitura e música. A seleção e os blocos deste desafio são escolhas do app.",
    name: "Haruki Murakami",
    initials: "HM",
    role: "Escritor",
    theme: "lavender",
    title: "Encontre o seu ritmo criativo",
    description: "Criação, leitura e um pouco de movimento. Um passo por vez.",
    principle:
      "Inspirada no espaço que Murakami dá à escrita, ao movimento e à música. As atividades são adaptações livres do app, sem reproduzir horários ou volumes de treino do escritor.",
    sourceLabel: "UNIQLO LifeWear · Hello, Haruki, 2021",
    sourceUrl:
      "https://www.uniqlo.com/ca/en/contents/lifewear-magazine/archives/21ss/haruki-murakami/",
    goals: [
      {
        id: "create",
        title: "Criar antes de consumir",
        description:
          "Comece um texto, desenho ou projeto antes de abrir as redes sociais.",
        category: "Trabalho",
        time: "Manhã",
      },
      {
        id: "movement",
        title: "Fazer uma pausa em movimento",
        description:
          "Interrompa o tempo sentado com uma atividade confortável para você.",
        category: "Saúde",
        time: "Tarde",
      },
      {
        id: "read",
        title: "Ler algumas páginas",
        description:
          "Escolha um livro e reserve um momento tranquilo para ler.",
        category: "Estudos",
        time: "Fim da tarde",
      },
      {
        id: "music",
        title: "Encerrar o dia com calma",
        description:
          "Ouça uma música e deixe o próximo passo do projeto anotado.",
        category: "Pessoal",
        time: "Noite",
      },
    ],
  },
  {
    id: "franklin",
    version: 1,
    sourceCheckedOn: "2026-10-28",
    sourceSummary:
      "Na autobiografia, Franklin apresenta um planejamento diário com trabalho, estudo e reflexão pela manhã e à noite. Este desafio adapta essas ideias para escolhas pessoais.",
    name: "Benjamin Franklin",
    initials: "BF",
    role: "Inventor e escritor",
    theme: "butter",
    title: "Um dia com propósito",
    description:
      "Planeje com clareza. Faça o que importa. Reflita no fim do dia.",
    principle:
      "Na autobiografia, Franklin descreve um plano diário com reflexão pela manhã e à noite. A sequência abaixo é uma adaptação livre desse planejamento.",
    sourceLabel: "Autobiografia · Project Gutenberg",
    sourceUrl: "https://www.gutenberg.org/files/20203/20203-h/20203-h.htm",
    goals: [
      {
        id: "intention",
        title: "Escolher o que quero fazer bem hoje",
        description:
          "Escreva uma intenção simples para orientar suas decisões.",
        category: "Pessoal",
        time: "Manhã",
      },
      {
        id: "priority",
        title: "Trabalhar na minha prioridade",
        description:
          "Reserve um bloco de atenção para sua tarefa mais importante.",
        category: "Trabalho",
        time: "Manhã",
      },
      {
        id: "learn",
        title: "Aprender algo novo",
        description: "Leia ou estude um assunto que desperte sua curiosidade.",
        category: "Estudos",
        time: "Tarde",
      },
      {
        id: "reflection",
        title: "Revisar minhas pequenas conquistas",
        description:
          "Observe o que funcionou e o que gostaria de ajustar amanhã.",
        category: "Pessoal",
        time: "Noite",
      },
    ],
  },
];
