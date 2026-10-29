# Requisitos — O Céu é o Limite

**Versão:** 1.8 · **Atualização:** 28/10/2026 · **Marco atual:** Fase 8, artefatos validados localmente; aceite externo pendente

**Disciplina hoje. Evolução sempre.**

## 1. Objetivo e escopo

Aplicativo pessoal para Windows, feito em TypeScript, para planejar metas diárias e semanais, registrar resultados e acompanhar a evolução. O uso principal funciona offline, sem cadastro, assinatura ou servidor. Os dados pertencem ao usuário do computador.

O primeiro produto utilizável termina na Fase 3: persistência confiável, gestão de metas, checklist e porcentagens corretas. Estatísticas avançadas, catálogo de rotinas, conquistas e distribuição completa seguem os marcos de [ROADMAP.md](ROADMAP.md).

Esta especificação descreve o comportamento desejado de todas as fases. As Fases 0 a 7 estão implementadas e validadas; a situação e as evidências de cada marco ficam em [PROGRESSO.md](PROGRESSO.md).

## 2. Ambiente e navegação

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-01 | Abrir como aplicativo desktop no Windows 10/11 de 64 bits, sem Node.js no computador do usuário final. | 1 / 8 |
| RF-02 | Salvar automaticamente em SQLite na pasta `userData`, fora da instalação e do executável. | 1 |
| RF-03 | Oferecer navegação entre início, metas, evolução, rotinas e dados/configurações. Mostrar apenas recursos disponíveis. | 1–7 |
| RF-04 | Funcionar sem rede depois de instalado ou extraído. Fontes externas são opcionais e não bloqueiam o app. | 1 |
| RF-05 | Adotar português brasileiro e a identidade escura com roxo da referência enviada. | 1 |

## 3. Metas e agenda

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-06 | Criar meta com título obrigatório, descrição opcional, categoria, frequência e início da vigência. | 2 |
| RF-07 | Programar metas diárias para todos os dias ou dias específicos da semana. | 2 |
| RF-08 | Acompanhar uma meta semanal como um compromisso binário por semana, de segunda a domingo. | 2 |
| RF-09 | Editar metas sem reescrever as versões e resultados dos períodos anteriores. | 2 |
| RF-10 | Arquivar uma meta, encerrando novas ocorrências e preservando as já existentes. | 2 |
| RF-11 | Excluir definitivamente apenas uma meta sem qualquer resultado registrado, mediante confirmação. Com resultados, oferecer arquivamento. | 2 |
| RF-12 | Consultar datas anteriores e corrigir resultados com registro da alteração. | 3 |
| RF-13 | Distinguir dia sem metas, descanso planejado e dia com metas não cumpridas. | 3 |

Categorias iniciais: Pessoal, Saúde, Estudos e Trabalho. Criar categorias personalizadas fica fora do MVP. Título: 1 a 100 caracteres após remover espaços nas extremidades; descrição: até 500 caracteres. Datas inválidas e frequências desconhecidas são recusadas no processo principal.

Uma meta semanal significa, inicialmente, algo como “organizar a semana”. Objetivos como “treinar três vezes por semana” exigem contagem de sessões e ficam fora do MVP; não serão simulados como três conclusões de um compromisso binário.

### 3.1 Vigência e preservação do histórico

- Mudanças em metas já em uso geram uma revisão futura; ocorrências guardam uma cópia do título, categoria, frequência e origem que valiam naquele período. Planos ainda não aplicados podem ser ajustados sem criar uma versão artificial do passado.
- Para metas diárias já em uso, alterações passam a valer no próximo dia. Para semanais, na próxima segunda-feira. A interface informa a data antes de salvar.
- Uma mudança entre frequência diária e semanal também começa na próxima segunda-feira, evitando sobrepor períodos.
- Uma meta recém-criada pode ser corrigida imediatamente enquanto não tiver ocorrência materializada ou resultado. Ocorrências históricas nunca recebem essa edição silenciosamente.
- Arquivar encerra o período atual e os futuros apenas se ainda não houve avaliação no período atual. Um período atual já avaliado permanece no histórico e no resumo correspondente, inclusive se o resultado tiver sido desmarcado depois.
- A edição de um resultado passado é uma ação explícita no calendário, diferente de editar a definição da meta. Ela recalcula as estatísticas e mantém um evento de auditoria.
- Metas criadas hoje não criam obrigações para datas anteriores. Uma data de início futura pode ser planejada, mas não entra nos resultados antes de chegar.

Na Fase 2, a vigência sugerida pode ser adiada pelo usuário. Uma edição envolvendo frequência semanal começa em uma segunda-feira quando já existem ocorrências. Ajustar uma revisão ainda futura altera somente esse planejamento, sem reescrever a versão vigente ou versões encerradas. Uma meta sem qualquer ocorrência pode ser corrigida de imediato, inclusive seu início, desde que não seja retroativo.

## 4. Checklist e regras de cálculo

### 4.1 Estados e calendário

| Situação | Representação | Entra no denominador? |
| --- | --- | --- |
| Programada, ainda sem avaliação | Pendente | Sim, se a data já chegou |
| Usuário confirmou cumprimento | Atingida | Sim |
| Usuário confirmou que não cumpriu | Não atingida | Sim |
| Período passado sem avaliação | Pendente, com indicação “sem registro” | Sim |
| Descanso planejado | Dispensa da agenda, separada do resultado | Não |
| Dia fora da programação | Sem ocorrência | Não |
| Dia futuro | Planejado, sem resultado permitido | Não, nas estatísticas realizadas |

O app não transforma falta de registro em declaração de fracasso. Pendências antigas permanecem identificáveis e podem ser avaliadas depois.

Descanso planejado dispensa metas diárias e de rotina. Não conclui nem dispensa a meta semanal. Pode ser definido para dias futuros ou para hoje enquanto não houver resultado registrado. Não pode apagar resultados nem dispensar retroativamente um dia encerrado para elevar a porcentagem.

Uma avaliação diária já desmarcada também impede dispensar aquele dia. Resultados semanais não impedem o descanso diário, pois continuam valendo para a semana. Descansos de dias encerrados permanecem consultáveis e não podem ser removidos retroativamente. A remoção de um descanso de hoje/futuro restaura somente ocorrências ainda existentes e dispensadas; não reativa metas arquivadas ou excluídas.

Dias e semanas usam o calendário local do computador; segunda-feira inicia a semana. O período e o fuso usado são salvos na ocorrência. Viajar ou mudar o fuso não desloca os registros já existentes.

### 4.2 Porcentagem diária

`cumprimento diário = metas diárias e de rotina atingidas / metas diárias e de rotina programadas × 100`

Pendentes e não atingidas entram no denominador. Semanais, futuras e dispensadas por descanso ficam fora. A apresentação arredonda para o inteiro mais próximo; os cálculos agregados usam as contagens originais.

| Exemplo | Resultado esperado |
| --- | --- |
| 8 atingidas, 1 pendente e 1 não atingida | 80% |
| 1 atingida entre 3 programadas | 33% na interface |
| Nenhuma meta programada | “Sem metas programadas”; percentual não aplicável, sem mérito de 100% |
| Descanso planejado | “Descanso planejado”; sem percentual de desempenho |
| Uma meta semanal concluída, sem meta diária | Resumo semanal atualizado; dia continua sem metas diárias |

### 4.3 Resultado semanal e evolução

- O resumo semanal separa metas semanais das metas diárias.
- Uma meta semanal possui um único resultado para o intervalo de segunda a domingo. Alterar o resultado por qualquer dia dessa semana atualiza esse mesmo registro.
- O resumo semanal diário usa a soma de conclusões dividida pela soma de compromissos diários elegíveis. Não calcula a média simples de porcentagens de dias com quantidades diferentes.
- O calendário e a linha de evolução diária consideram somente metas diárias e de rotina. Dias sem metas ou de descanso são lacunas identificadas, não pontos de 0% ou de 100%.
- Totais que misturam frequências devem usar o rótulo “compromissos do período”. Cada compromisso semanal entra uma única vez, na semana à qual pertence. Uma semana parcialmente visível no filtro continua contando uma única ocorrência elegível, sem duplicação.
- Períodos futuros são excluídos. O período em andamento aparece como parcial. Comparações entre semanas fechadas não usam a semana atual como se estivesse encerrada.
- Evolução mensal usa os compromissos diários dentro do mês. O resumo de metas semanais permanece separado para evitar repartir uma única meta entre dois meses.

Na Fase 4, os filtros diários são os últimos 7, 30 ou 90 dias, incluindo hoje. Categorias leem os atributos históricos das ocorrências. Gráficos Recharts preservam lacunas e oferecem tabelas expansíveis com os valores. O resumo semanal considera as semanas que cruzam o filtro, uma ocorrência por meta/semana. Comparações usam as duas últimas semanas encerradas e mostram a semana atual separada como parcial. A variação em pontos percentuais é calculada sobre proporções brutas, com arredondamento só no resultado. A evolução mensal mostra seis meses, com o atual parcial. Não há comparação artificial quando um dos períodos não tem agenda.

### 4.4 Sequências e consistência

A sequência inicial conta dias com ao menos uma meta diária ou de rotina atingida; ela não significa que todas as metas foram concluídas. Dias fora da programação e descansos planejados não aumentam nem quebram a sequência. Um dia encerrado que tinha metas elegíveis e nenhuma conclusão quebra a sequência. Hoje pode continuar pendente sem quebrar a sequência de ontem até o fim do dia. Metas semanais não prolongam a sequência diária.

O calendário usa marcações distintas para: sem agenda, descanso, futuro, sem registro, conclusão parcial e conclusão total. Cores são acompanhadas por texto/legenda e rótulos acessíveis.

O calendário mensal também identifica metas explicitamente não atingidas e hoje em aberto. Permite navegar por meses e selecionar um dia. **Revisar este dia** abre o checklist da data, preservando a confirmação e a auditoria das correções; dias futuros permitem somente consulta do planejamento.

## 5. Rotinas e desafios

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-14 | Catálogo offline de rotinas inspiradas em personalidades, com nome, descrição, fonte e data de consulta. | 5 |
| RF-15 | Informar claramente quais atividades são adaptações do app e quais fatos têm fonte. | 5 |
| RF-16 | Permitir experimentar uma rotina para um dia ou intervalo explicitamente escolhido. O padrão é só hoje. | 5 |
| RF-17 | Revisar atividades antes de copiar: selecionar, renomear e ajustar duração/horário. Intensidade é uma anotação pessoal opcional, não uma prescrição. | 5 |
| RF-18 | Criar cópias independentes na agenda, preservando origem e versão do modelo. Atualizar o catálogo não altera o que já foi copiado. | 5 |
| RF-19 | Impedir adição duplicada por duplo clique; uma segunda aplicação para a mesma data exige ação explícita. | 5 |
| RF-20 | Comparar o próprio cumprimento em experiências anteriores, sem sugerir comparação de capacidade física com a personalidade. | 5 |

Primeiros exemplos: Ilia Topuria, Haruki Murakami e Benjamin Franklin. Empresários e outras personalidades poderão ser incluídos no mesmo formato, após revisão das fontes.

Os três modelos iniciais são versão 1, consultados em 28/10/2026. A base factual e a origem das adaptações estão em [docs/FONTES_ROTINAS.md](docs/FONTES_ROTINAS.md). O catálogo é uma inspiração editorial, sem representar endosso das personalidades.

O desafio inspirado em Topuria enfatiza constância, prática e recuperação. Não reproduz automaticamente um treino profissional, dieta, corte de peso ou protocolo médico. Tempos e atividades propostos pelo app são identificados como adaptações. O usuário pode optar por não realizar qualquer atividade.

O catálogo fica empacotado no aplicativo; não depende de scraping, API externa ou download de imagens. O link de fonte abre no navegador apenas quando solicitado.

Detalhamento da Fase 5: uma experiência começa hoje por padrão. O usuário pode escolher início futuro e ativar explicitamente um intervalo de até 31 dias. Cada atividade selecionada gera um compromisso pontual independente por dia; horários e duração são opcionais, e ritmo é uma anotação pessoal de até 120 caracteres. Dias de descanso continuam dispensados. Um identificador de operação torna a repetição da mesma solicitação idempotente; repetir intencionalmente o modelo em datas sobrepostas exige confirmação. O histórico distingue planejado, parcial e encerrado e compara somente o próprio cumprimento, com escolhas e períodos visíveis. Rotinas anteriores à Fase 5 permanecem como legado, sem inventar versão, fonte consultada ou escolhas que não foram registradas.

## 6. Motivação e personalização

Fase 6: conquistas por constância, níveis explicados por critérios transparentes, metas de longo prazo, temas e mensagens motivacionais. Conquistas são derivadas do histórico real; editar um resultado pode recalculá-las. Não adicionar punições financeiras, competição pública, ranking ou notificações insistentes ao escopo.

Detalhamento da Fase 6: cada compromisso elegível atingido vale 10 pontos, com uma contagem por meta/período; uma semanal não se multiplica pelos dias. Os cinco níveis começam em 0, 100, 300, 700 e 1500 pontos. Seis conquistas acompanham a primeira conclusão, dez conclusões, melhor sequência de três/sete dias, uma conclusão semanal e uma atividade de rotina atingida. Pontos, níveis e conquistas são derivados, sem saldo de recompensas acumulado; correções podem atualizar seu estado. Descanso/futuro não geram pontos. A melhor sequência histórica respeita folgas e descanso, sem premiá-los como conclusões.

Objetivos de longo prazo ficam separados das metas da agenda. Possuem nome, descrição, categoria, quantidade desejada, progresso informado, unidade e prazo opcional. Podem ser editados, arquivados e reativados; não criam ocorrências, pontos ou obrigações diárias. Criação usa chave de operação para impedir duplicação acidental. Preferências oferecem três temas escuros — Violeta, Oceano e Floresta — e a escolha de mostrar os cartões de incentivo na visão geral/lateral. A gravação precisa ser confirmada antes de aplicar a preferência. Mensagens são discretas e não tratam pendências como punição. SQLite v4 acrescenta objetivos e preferências sem reescrever o conteúdo ou checksums anteriores.

A tela **Meu caminho** apresenta os critérios de cada marco, os limites de pontos dos níveis e o progresso de cada conquista. Objetivos aceitam quantidade de 1 até 1 bilhão e progresso entre zero e o alvo, com unidade pessoal de até 30 caracteres. O percentual só mostra 100% ao alcançar o alvo; pode-se corrigir o progresso e reabrir o acompanhamento sem criar recompensas. Os temas preservam texto claro em superfícies escuras e o foco permanece na opção de tema durante a gravação. A preferência de incentivo controla o texto da visão geral e o cartão lateral, mantendo as ações disponíveis.

## 7. Backup e distribuição

| ID | Requisito | Fase |
| --- | --- | --- |
| RF-21 | Exportar uma cópia consistente do banco e restaurar após validar formato, integridade e versão. | 7 |
| RF-22 | Criar cópia de segurança antes de migração/restauração. Uma falha preserva o banco original e informa o usuário. | 1 / 7 |
| RF-23 | Gerar executável portátil e instalador Windows; ambos usam a mesma pasta de dados do usuário. | 8 |
| RF-24 | Atualizar/reinstalar sem apagar dados; desinstalação não apaga o banco por padrão. | 8 |
| RF-25 | Distribuir pelo GitHub Releases com versão, instruções e SHA-256 dos arquivos. | 8 |

Detalhamento da Fase 7: exportação usa arquivo temporário, sincronização e conferência antes de substituir o destino escolhido. Arquivos internos do banco, cópias automáticas e seus aliases são protegidos contra exportação por cima deles. Restauração lê uma única cópia limitada a 50 MB, valida/migra em memória e só então mostra a confirmação com arquivo, versão e quantidades. Cancelar a escolha ou a confirmação não grava dados. Confirmada a substituição, salvar uma cópia independente `sky.sqlite.pre-restore-<data>-<id>.sqlite`, que não é sobrescrita pelas gravações normais, além da proteção `.bak` quando ela não é o próprio arquivo escolhido para restaurar. O arquivo de origem escolhido permanece intacto. Durante os diálogos, o main impede outras operações de dados; renderer não escolhe caminhos por IPC. O painel informa sucesso, cancelamento ou falha e apresenta um guia offline, inclusive para quando o aplicativo não abre. Não acrescentar criptografia, nuvem, retenção automática ou um novo esquema nesta etapa.

Fase 7 implementada com os formatos 1–4 aceitos, confirmação inicialmente em **Cancelar**, bloqueio durante toda a operação, pasta fixa por IPC e guia em [RECUPERACAO.md](docs/RECUPERACAO.md). Uma falha posterior à confirmação pode conservar a cópia independente já criada; não substitui o banco ativo nem o arquivo escolhido. Testes de diálogos usam respostas controladas no Electron; integração manual com o Windows e executáveis ficam na Fase 8.

Fase 8: versão inicial 1.0.0, dois arquivos Windows x64 com nomes distintos (`Portatil` e `Instalador`), recursos locais e instalação por usuário. Identidade `br.app.oceueolimite`, nome interno e pasta de dados compartilhada preservados. Desinstalação configurada para conservar dados; atualização manual. Guia e licenças empacotados, SHA-256 e notas gerados dos artefatos reais. Os executáveis foram testados em perfis temporários com a opção nativa `--user-data-dir`, sem canais de teste no produto, incluindo diálogos reais por Win32, reinstalação e exclusividade. O renderer passou em 125%/150%. Windows limpo, escala do sistema e atualização entre versões continuam pendentes. Após autorização explícita do usuário, código e oito anexos foram publicados em [PedroVtBarros/o-ceu-e-o-limite](https://github.com/PedroVtBarros/o-ceu-e-o-limite), versão v1.0.0 como pré-lançamento, com hashes remotos conferidos. O [guia de lançamento](docs/LANCAMENTO.md) descreve os critérios pendentes e o modelo de CI ainda não ativado.

## 8. Qualidade e limites

- Fluxos principais operáveis por teclado, foco visível, rótulos acessíveis e alvos de clique adequados.
- Layout desktop sem cortes a partir de 1000 × 720, com atenção à escala de tela de 125% e 150%.
- Fontes, ícones e catálogo necessários ao uso incluídos no pacote.
- Nenhuma alteração é apresentada como salva antes da confirmação da persistência.
- Aplicativo com uma instância gravadora por usuário; o renderer não recebe acesso livre a arquivos, SQL ou shell.
- Não prometer criptografia, sincronização entre computadores, atualizações automáticas ou proteção contra perda física do disco. Não fazem parte do MVP.
- Não publicar dados pessoais, bancos, credenciais ou conteúdo de `.test-data` no GitHub.

## 9. Cenário de aceitação do MVP

1. Abrir o app offline em um perfil de teste vazio.
2. Criar uma meta diária para segunda, quarta e sexta, e uma meta semanal.
3. Na data elegível, registrar uma diária atingida e outra não atingida; conferir contagens e porcentagem com pendentes incluídas.
4. Verificar que a semanal não muda a barra diária e que seu resultado é único naquela semana.
5. Fechar completamente e abrir outra vez: metas, agenda e resultados continuam iguais.
6. Editar a meta e conferir a vigência anunciada; o período anterior conserva título, categoria e cálculo originais.
7. Arquivar uma meta com histórico; o histórico permanece consultável.
8. Consultar um dia de descanso, um dia sem agenda e um dia futuro; nenhum recebe nota artificial.

Os critérios específicos de cada fase estão em [ROADMAP.md](ROADMAP.md). Dúvidas novas devem gerar uma decisão documentada antes de alterar uma regra histórica.
