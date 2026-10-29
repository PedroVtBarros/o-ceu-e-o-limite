# Progresso — O Céu é o Limite

**Atualizado:** 28/10/2026 · **Último marco concluído:** Fase 7 — segurança e backup

**Pré-lançamento v1.0.0 publicado, com autorização explícita do usuário.** [Repositório público](https://github.com/PedroVtBarros/o-ceu-e-o-limite) e [oito anexos do Release](https://github.com/PedroVtBarros/o-ceu-e-o-limite/releases/tag/v1.0.0) disponíveis. Todos os SHA-256 remotos coincidem com os arquivos locais. Windows limpo, DPI do sistema e atualização entre versões continuam pendentes; o workflow fica como modelo por falta de escopo OAuth `workflow`.

## Situação do projeto

As Fases 0 a 7 estão concluídas. O desktop reúne metas, checklist, descanso, correções auditáveis, análises, rotinas, Meu caminho e backups completos com recuperação. SQLite permanece v4, com nove tabelas e checksums inalterados nesta fase. A restauração preserva o arquivo escolhido e guarda o estado anterior em uma cópia independente; histórico, resultados e aparência persistem após reiniciar.

| Fase | Estado | Próxima condição |
| --- | --- | --- |
| 0 — Planejamento | Concluída | Requisitos e arquitetura documentados |
| 1 — Estrutura e persistência | Concluída | Critérios e evidências abaixo |
| 2 — Metas | Concluída | Dias programados, revisão, histórico, exclusão e reinício verificados |
| 3 — Checklist / MVP | Concluída | Estados, descanso, correções, cálculos e reinício comprovados |
| 4 — Evolução | Concluída | Recharts, calendário, fronteiras de períodos e recálculo após correção comprovados |
| 5 — Rotinas | Concluída | Fontes, personalização, experiências, idempotência e migração com backup comprovadas |
| 6 — Motivação | Concluída | Marcos derivados, objetivos independentes, preferências, foco e migração comprovados |
| 7 — Backup | Concluída | Exportação, restauração/retorno, cancelamentos, falhas, limites e guia comprovados |
| 8 — Lançamento | Pré-lançamento público | Windows limpo, DPI do sistema e atualização entre versões pendentes |

## Entrega da Fase 1

- Electron/React/TypeScript mantidos, com navegação existente e tema escuro/roxo baseado em tokens Tailwind.
- SQLite v2 com seis tabelas de base: migrações, metas, revisões, ocorrências, eventos e planejamento de descanso. A presença das tabelas não implica interface de todas essas funções.
- Migração v1→v2 em banco separado, com backup identificado e validação após gravar/reabrir o arquivo temporário, antes da substituição.
- Cópia exata do legado em `sky.sqlite.pre-v2-<data>-<id>.sqlite`; `.bak` comum não substitui essa cópia.
- Recuperação dos resultados da data do arquivamento, origem de rotinas e uma ocorrência por meta semanal.
- Gravação atômica e reversão do estado em memória quando o arquivo não pode ser salvo.
- Versões desconhecidas/futuras, corrupção e conteúdo inválido recusados sem sobrescrever o original.
- Consultas de datas e evolução adaptadas para atributos históricos. A edição existente programa uma revisão para amanhã ou para a próxima segunda-feira; a interface mostra a vigência.
- Exportação do `sql.js` reativa chaves estrangeiras para não perder a proteção da conexão.
- Recarregamento da agenda quando a data local muda, inclusive após retornar o foco à janela.
- IPC restrito ao renderer local e frame principal; sandbox e isolamento mantidos, Node.js indisponível no renderer.
- Vitest adotado, preservando os 12 cenários anteriores e acrescentando provas da migração, histórico e recuperação.
- Playwright exercita o processo Electron em perfis temporários isolados fora do projeto.

## Evidências da Fase 1 — marco anterior

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd ci --no-audit --no-fund --cache .npm-cache` | Aprovada | Reinstalação completa a partir do lockfile, incluindo runtime Electron |
| `npm.cmd test` | 22 testes aprovados, três arquivos | Regras originais, migração, recuperação, histórico e integridade da conexão |
| `npm.cmd run build` | Aprovado | TypeScript e builds de renderer, main e preload |
| `npm.cmd run test:e2e` | Dois fluxos aprovados | Perfil novo e migração de legado, ambos encerrando e reiniciando o processo |
| Interface mínima | 1000 × 720 sem rolagem horizontal | Navegação acessível e layout básico adaptável; escalas de tela pertencem à Fase 8 |

O primeiro fluxo Electron cria metas diárias e semanais, registra resultados, usa uma rotina existente, fecha, reabre e compara os dados. Também verifica teclado, tema, fonte local, modo offline, sandbox do processo, ausência de `require` no renderer e rejeição de chamadas inválidas. A edição mantém a versão atual e apresenta a próxima versão programada.

O segundo fluxo abre uma fixture v1 pela aplicação, verifica quatro metas e quatro resultados, confere o backup byte a byte, fecha e reabre o v2 sem divergência. O resultado de uma meta arquivada é preservado.

Testes unitários usam `.test-data`. Os perfis Electron ficam no diretório temporário do sistema com prefixos `ceu-e-limite-`; são criados exclusivamente para teste e não usam o banco pessoal. As capturas estão em `.test-data`; a [captura da interface](docs/preview-fase-1.png) usa exclusivamente dados de teste.

## Entrega da Fase 2

- Metas diárias com qualquer combinação de dias, atalhos para todos os dias/dias úteis e validação de seleção não vazia.
- Metas semanais como compromisso único; dias avulsos não são misturados com a frequência semanal.
- Início hoje ou no futuro; novas metas não retroagem para criar obrigações. A agenda futura é projetada sem materializar resultados e não permite avaliação antecipada.
- Edição completa de nome, descrição, categoria, frequência e dias, com data de vigência explícita. A transição envolvendo uma semana inicia em segunda-feira quando já há ocorrências.
- Revisões aplicadas e ocorrências anteriores preservadas. Planejamento futuro pode ser ajustado; meta sem ocorrência pode ser corrigida antes de começar.
- Tela de metas com ativas/arquivadas, busca por nome, filtro por categoria e consulta de versões.
- Arquivamento impede novos compromissos, mantém períodos avaliados e conserva a definição da data do arquivamento. Revisões posteriores não aplicadas não passam a representar a meta quando sua data chega.
- Exclusão com confirmação somente quando nunca houve resultado, inclusive após desfazer a avaliação. O main verifica a regra novamente e remove identidade, revisões e ocorrências sem deixar linhas órfãs.
- Falha de escrita durante a exclusão conserva o arquivo e restaura o estado em memória.
- Formulário, gestão de metas, histórico e modal extraídos para `src/components/`, reaproveitando a navegação existente.
- Nenhuma dependência nova, alteração de esquema v2 ou migração adicional.

### Evidências da Fase 2 — marco anterior

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd test` | 35 testes aprovados, quatro arquivos | Cenários anteriores mais programação, vigência, frequência, exclusão e fronteiras de calendário |
| `npm.cmd run build` | Aprovado | TypeScript, renderer, main e preload |
| `npm.cmd run test:e2e` | Três fluxos aprovados | Perfil novo, migração v1 e fluxo completo de gestão de metas, com reinício |

O novo fluxo Electron escolhe dias, valida que uma seleção vazia impede salvar, registra e desfaz uma conclusão, confirma que a exclusão permanece bloqueada, agenda revisão semanal, consulta as duas versões, planeja uma meta futura e verifica a avaliação desabilitada. Também cancela uma exclusão, confirma outra, arquiva a meta protegida, consulta arquivadas, fecha e reabre para comparar programação e revisões.

Os testes de banco verificam diária→semanal→diária sem sobreposição, adiamento de uma revisão sem criar lacunas, correção antes da primeira ocorrência, domingo na mudança de mês, rejeição de valores inválidos sem alterar o banco, exclusão sem órfãos, recuperação após falha e preservação dos atributos da meta arquivada. Os testes antigos de dados históricos usam relógios controlados para criar a meta no dia original; não dependem mais de cadastro retroativo.

A [captura da tela de metas](docs/preview-fase-2.png) foi obtida no teste Electron com dados fictícios. Nenhum banco pessoal foi usado.

## Entrega da Fase 3 — primeiro MVP

- Checklist com resultados atingida, não atingida e pendente; a mesma seleção pode ser desfeita sem apagar a trilha de avaliação.
- Pendências de períodos encerrados identificadas como “Sem registro”, sem converter automaticamente em não atingidas.
- Barra diária independente da aba de metas semanais, com resumos e denominadores próprios. Total diário da semana calculado pelas contagens originais.
- Dias sem agenda, futuros e de descanso sem porcentagem de desempenho. Calendário semanal com estados identificados por legenda e rótulos acessíveis.
- Escolha direta de data e confirmação/cancelamento antes de corrigir um período encerrado. Consulta das mudanças com estado anterior, novo estado, origem e horário.
- Descanso de hoje/futuro com observação opcional. Dispensa apenas diárias e rotinas; semanais continuam disponíveis em seu próprio período.
- Proteção contra descanso retroativo e contra dispensar uma data que já teve avaliação diária, inclusive após desmarcar. Remoção de descanso não reativa metas arquivadas ou excluídas.
- Novas metas e rotinas criadas em uma data de descanso recebem a dispensa ao materializar. Planejamento futuro persiste e é aplicado quando a data chega.
- Falhas de gravação mantêm arquivo e estado em memória. Banco com descanso incompatível com avaliações é recusado antes de restaurar.
- Sequência ajustada para ignorar descanso/folgas sem incrementá-la, mantendo a interrupção por dia elegível encerrado sem conclusão. Esta adequação integra a nova entrada de descanso; análises e calendário completos permanecem na Fase 4.
- Checklist em componentes próprios, com ordem de criação preservada e foco mantido após salvar pelo teclado. O banner de apresentação fica reservado ao espaço inicial sem metas.
- As seis tabelas do esquema v2 e as dependências foram reaproveitadas, sem nova migração.

### Evidências atuais

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd test` | 52 testes aprovados, cinco arquivos | Fases anteriores, cálculos, descanso, recuperação, trilha de resultados e consistência do banco |
| `npm.cmd run build` | Aprovado | TypeScript, renderer, main e preload |
| `npm.cmd run test:e2e` | Cinco fluxos aprovados | Fases anteriores e os dois fluxos do MVP, todos com reinício |

O primeiro novo fluxo usa teclado no checklist, confere 1/3 = 33%, registra não atingida, conclui uma semanal sem alterar a barra diária, bloqueia descanso de dia avaliado, planeja/remove/replaneja descanso futuro e confere notas, eventos e resultados após reiniciar.

O segundo novo fluxo usa um histórico fictício com pendências e descanso já planejado. Cancela uma correção sem gravar, confirma duas avaliações de um dia encerrado, confere a trilha, recusa alteração retroativa do descanso e recusa resultado em ocorrência dispensada. Reiniciar preserva todos esses dados.

Os testes de regras também comprovam 8/10 = 80%, média semanal por contagens, nenhuma nota artificial, uma oportunidade por meta semanal, resultado desmarcado impedindo dispensa, adição de metas/rotinas durante descanso, ausência de ressurreição de metas, falha de escrita, ordem estável do checklist e recusa de backup que tente ocultar uma avaliação como descanso.

[Checklist do MVP](docs/preview-fase-3.png) · [Descanso planejado](docs/descanso-fase-3.png). As capturas usam exclusivamente dados de teste. Os testes Electron continuam em perfis temporários isolados, sem tocar no banco pessoal.

## Entrega da Fase 4 — evolução e estatísticas

- Recharts 3.10.1 com versão exata e lockfile. Série diária compartilhada entre o início e a tela de evolução; gráfico mensal para seis meses. Tudo empacotado e utilizável offline.
- Filtros de 7/30/90 dias com totais diários por contagem e categorias das ocorrências históricas. Edições de título/categoria não reclassificam o passado.
- Descanso e ausência de agenda são lacunas de valor nulo. Metas pendentes e não atingidas continuam no denominador; o futuro fica fora dos cálculos. Tabelas expansíveis oferecem consulta dos valores por teclado.
- Calendário mensal com estados distintos, legenda e rótulos acessíveis: todas atingidas, parcial, não atingidas, sem registro, em aberto, sem metas, descanso e futuro.
- Selecionar uma data e usar **Revisar este dia** abre o checklist correspondente. Correções mantêm confirmação/auditoria e recalculam gráficos, categorias, meses, semanas e sequência a partir dos registros existentes.
- Resumo de compromissos semanais separado, uma ocorrência por meta/semana que cruza o filtro. Uma semana entre dois meses não é dividida no gráfico mensal.
- Comparação das duas últimas semanas encerradas, de segunda a domingo. Semana atual e mês atual identificados como parciais. Sem agenda, não há base artificial de comparação.
- Variação em pontos percentuais calculada sobre proporções brutas e arredondada só no resultado; totais não fazem média dos percentuais diários arredondados.
- Funções puras em `shared/analytics.ts` e componentes próprios para evolução/gráficos. Nenhuma alteração de esquema v2, checksum, IPC ou serviço de gravação.
- Ajuste no contêiner dos gráficos impede que a largura anterior do SVG provoque rolagem horizontal durante o redimensionamento da janela.

### Evidências da Fase 4

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd ci --no-audit --no-fund --cache .npm-cache` | Aprovada | Instalação reproduzível após adicionar Recharts, com runtime Electron |
| `npm.cmd test` | 64 testes aprovados, seis arquivos | 52 cenários anteriores e 12 novos cenários de análises com SQLite e relógio controlado |
| `npm.cmd run build` | Aprovado | TypeScript e builds do renderer, main e preload |
| `npm.cmd run test:e2e` | Seis fluxos aprovados | Novo fluxo de evolução e todos os anteriores, com reinício |
| Janela mínima | 1000 × 720 sem rolagem horizontal | Layout das análises e gráficos com largura válida; capturas conferidas |

Fixtures atravessam dezembro/janeiro, semanas entre meses/anos e fevereiro bissexto. Conferem totais por contagem (1/3 seguido de 1/1 resulta em 2/4 = 50%), variação sobre proporções brutas, metas criadas no meio da semana, categoria anterior preservada, folgas/descanso, pendências, ausência de agenda, futuro e correção seguida de reabertura.

O novo fluxo Electron prepara cerca de dez semanas de dados fictícios, abre offline, confere os totais de 7/30/90 dias e o resumo semanal, consulta tabelas diária/mensal, navega no calendário e corrige uma pendência histórica pelo checklist. Confere o recálculo, fecha, reabre e compara o banco e a porcentagem. Os perfis continuam isolados no diretório temporário do sistema, sem acessar o banco pessoal.

[Evolução com dados de teste](docs/preview-fase-4.png). A captura mostra a interface implementada, com dados exclusivamente fictícios. O bundle local do renderer fica em aproximadamente 655 kB minificado com Recharts; o Vite emite aviso de tamanho, sem impedir o build ou os fluxos offline. Distribuição continua na Fase 8.

## Entrega da Fase 5 — rotinas personalizáveis

- Catálogo offline com Ilia Topuria, Haruki Murakami e Benjamin Franklin. Modelos v1 com IDs estáveis de atividades, fonte e consulta editorial em 28/10/2026. [Referências e adaptações](docs/FONTES_ROTINAS.md).
- Prévia distingue o relato da fonte das atividades adaptadas pelo aplicativo. Horários, minutos e anotações de ritmo começam em branco; não são agendas profissionais ou prescrições de treino/dieta.
- Selecionar atividades e adaptar nome, descrição, categoria, horário, minutos e ritmo pessoal antes de copiar. A agenda mostra as anotações escolhidas.
- Padrão só hoje. Início futuro e intervalo até 31 dias são escolhas explícitas; cada atividade selecionada cria um compromisso pontual independente por data. Descanso mantém dispensa e futuro fica fora dos percentuais até chegar.
- Aba **Minhas experiências** com filtro por inspiração, situação planejada/parcial/encerrada, cumprimento por contagens e consulta das escolhas/fontes originais. Compara as duas últimas experiências encerradas do modelo filtrado, com seus períodos e escolhas visíveis.
- Cópias pessoais guardam nome, princípio, versão, fonte, data de consulta, escolhas e IDs dos compromissos. Atualizar o catálogo não as reescreve.
- Chave de operação e entrada normalizada persistidas: reenvios equivalentes não duplicam; reutilizar chave com outro conteúdo é recusado. Nova experiência em datas sobrepostas exige confirmação explícita, inclusive quando existe uma rotina legada.
- SQLite v3 acrescenta somente `routine_runs` e índice. As tabelas anteriores, a migração 2 e seu checksum ficam preservados. A migração usa candidato separado, comparação de conteúdo, gravação/reabertura e validação antes da substituição; backup `.pre-v3-...` conserva os bytes exatos do v2.
- A cadeia v1→v2→v3 preserva o backup v1 `.pre-v2-...`. Importação v1/v2/v3 valida antes de trocar o ativo e conserva o anterior em `.bak`. Falhas de escrita revertem experiência, metas e chave de operação em memória.
- Rotinas antigas continuam consultáveis como legado. Não foi inferida versão, horário ou consulta de fonte que não existia nesses dados.
- `RoutinePreview`, `RoutinesPage` e `shared/routineRuns.ts` reaproveitam agenda, descanso, auditoria e análises. Novo IPC específico `sky:routine:start`; remetente e campos validados no main. Fontes salvas também passam pela autorização de abertura de links.
- Nenhuma dependência adicionada ou alterada. A prévia do navegador informa que salvar experiências com histórico exige o desktop SQLite.

### Evidências da Fase 5

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd test` | 78 testes aprovados, sete arquivos | 64 cenários anteriores e 14 novos cenários de catálogo, experiências, cópias, migração e recuperação |
| `npm.cmd run build` | Aprovado | TypeScript e builds do renderer, main e preload |
| `npm.cmd run test:e2e` | Oito fluxos aprovados | Dois novos fluxos de rotinas/v2 e todos os seis anteriores, com reinício |
| Banco de teste original da Fase 4 | Compatível | Cópia de v2 migrada; cinco tabelas de conteúdo idênticas, backup exato e original sem alteração |
| Interface | Capturas conferidas e 1000 × 720 sem rolagem horizontal | Catálogo, personalização, histórico, comparação e navegação offline |

Os novos testes SQLite verificam intervalo cruzando meses, seleção e campos personalizados, ausência de desempenho futuro, sobreposição/confirmação, repetição da mesma operação antes/depois de reabrir, atualização simulada de catálogo, descanso, entradas malformadas, falha de escrita e tentativa de importar JSON/vínculos/fontes inválidos. Também comprovam preservação de cada tabela v2, backup byte a byte, importação v2/v3 e exclusão elegível sem apagar as escolhas originais. O leitor mantém as garantias de auditoria e migração v1 das fases anteriores.

O primeiro novo fluxo Electron prepara duas experiências encerradas, confere a comparação pessoal, personaliza duas atividades, salva e avalia uma, reenvia a mesma solicitação sem duplicar, cancela uma repetição e confirma outra em um intervalo com dia futuro. Confere anotações, fontes, porcentagens, escolhas originais e preservação após reiniciar, offline. O segundo abre um perfil v2, consulta o legado, bloqueia repetição sem confirmação, confere o backup exato e reabre sem outra migração. Ambos usam perfis temporários isolados; nenhum banco pessoal foi acessado.

[Catálogo implementado](docs/preview-fase-5.png) · [Histórico de experiências](docs/experiencias-fase-5.png). Capturas com dados fictícios. Bundle local do renderer: aproximadamente 673 kB minificado, com o aviso de tamanho do Vite já existente. Instalação limpa foi validada na Fase 4; o lockfile não mudou nesta fase.

## Entrega da Fase 6 — motivação e personalização

- Nova tela **Meu caminho**, com abas Conquistas, Objetivos de longo prazo e Personalizar, além de resumo de nível/XP na visão geral.
- Seis marcos com critérios e progresso explícitos: primeira conclusão, dez conclusões, melhor sequência de três/sete dias, conclusão semanal e atividade de rotina atingida. Cinco níveis em 0/100/300/700/1500 XP.
- 10 XP por compromisso elegível atingido, contando cada semanal uma vez por meta/semana. Pontos e marcos são derivados dos resultados atuais, sem saldo ou eventos de recompensa persistidos. Desmarcar/corrigir recalcula os níveis, sem bônus ao repetir cliques.
- Melhor sequência histórica ignora descanso e folgas, sem contá-los como conclusões; dia encerrado programado sem conclusão interrompe a sequência daquele momento. Semanal não prolonga a sequência diária.
- Objetivos com nome, descrição, categoria, alvo, progresso manual, unidade e prazo opcional. Criar, atualizar, concluir/corrigir, arquivar e reativar. Criação idempotente e validação de limites/datas no main; progresso só exibe 100% ao atingir o alvo.
- Objetivos ficam em tabela própria, sem metas/ocorrências/eventos diários. Atingir um objetivo manual não altera porcentagem diária/semanal, XP ou conquistas.
- Temas escuros Violeta, Oceano e Floresta, aplicados a superfícies, ações, destaques e gráficos. Preferência de incentivo controla texto da visão geral e cartão lateral, sem ocultar ações ou resultados.
- Preferências aplicadas somente após confirmação de gravação. Bloqueio por estado/`aria-disabled` mantém foco na opção durante o IPC; um teste de teclado detectou e ajudou a corrigir a perda de foco causada por desativar o `fieldset` temporariamente.
- SQLite v4 acrescenta apenas `personal_preferences` e `long_term_goals`, com checksum próprio e padrão inicial Violeta/incentivo habilitado. Conteúdo e checksums v2/v3 ficam intactos. `upgradeToCurrent` encadeia cópias até a versão atual sem gravar versões intermediárias no ativo; origem v3 recebe backup `.pre-v4-...` exato.
- Preferências e objetivos têm IPC específico e validação de abertura/importação. Falha de gravação reverte memória/arquivo; reenvio da criação não duplica o objetivo. Importação v1–v4 preserva o banco ativo anterior em `.bak`, incluindo personalização.
- Nenhuma dependência adicionada ou atualizada. A prévia IndexedDB permite aparência; objetivos e garantias históricas continuam no desktop SQLite.

### Evidências da Fase 6

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd test` | 94 testes aprovados, oito arquivos | 78 cenários anteriores e 16 novos cenários de marcos, objetivos, preferências e migração |
| `npm.cmd run build` | Aprovado | TypeScript e builds do renderer, main e preload |
| `npm.cmd run test:e2e` | Dez fluxos aprovados | Dois novos fluxos de Meu caminho/v3 e todos os oito anteriores, com reinício |
| Paletas | Pares de contraste aprovados | Texto das ações ≥ 4,5:1 e foco ≥ 3:1 contra fundos/superfícies; foco também conferido no Electron |
| Banco original de teste da Fase 5 | Compatível | Cópia v3 migrada para v4 com seis tabelas de conteúdo idênticas, backup exato e origem sem alteração |
| Interface | Capturas conferidas; conquistas e personalização em 1000 × 720 sem rolagem horizontal | Layout desktop, temas e controles de teclado |

Os novos testes cobrem todos os limites de nível, repetição/remoção/reinclusão de resultados, semanais sem multiplicação, melhor sequência com descanso/folga/lacuna, objetivos completos sem XP/obrigações, criação idempotente mesmo após edição/reabertura, arquivamento/reativação, preferências persistidas, campos inválidos e falhas de escrita. Backups com JSON, preferências, datas ou metadados inválidos são recusados sem trocar o ativo. A migração compara as seis tabelas v3 e os registros/checksums anteriores permanecem válidos.

O primeiro novo fluxo Electron parte de 90 XP, atinge 100 e o nível 2, cria/atualiza/arquiva/reativa um objetivo sem alterar agenda/pontos, testa os temas por teclado e desabilita incentivo. Corrige um resultado encerrado, volta a 90 XP/nível 1, reinicia offline e verifica tudo; ao restaurar a conclusão, retorna a 100 XP sem bônus adicional. O segundo abre um perfil v3 com rotina personalizada, calcula marcos a partir do histórico preservado, confere o backup byte a byte e reabre sem nova migração. Todos os perfis são temporários e isolados; nenhum banco pessoal foi acessado.

[Meu caminho](docs/preview-fase-6.png) · [Objetivos](docs/objetivos-fase-6.png) · [Temas](docs/temas-fase-6.png). Capturas com dados fictícios. Bundle local do renderer: aproximadamente 693 kB minificado, com o aviso de tamanho do Vite já existente. Instalação limpa foi validada na Fase 4; lockfile inalterado nas Fases 5/6.

## Entrega da Fase 7 — segurança e backup

- Painel **Meus dados e backups** com cartões de exportação/restauração, caminho real do banco, abertura da pasta fixa e mensagens persistentes de sucesso, cancelamento ou falha. O guia de recuperação está disponível offline dentro do painel e em [RECUPERACAO.md](docs/RECUPERACAO.md).
- Exportação valida o banco e escreve um temporário exclusivo ao lado do destino, sincroniza, compara bytes e só então renomeia. Protege banco em uso e cópias internas, incluindo aliases de caminho, junction e hardlink. Falhas conservam o destino anterior.
- Restauração lê uma única origem, limitada a 50 MB antes da alocação; recusa arquivo inválido, desconhecido, corrompido ou futuro. Origens v1–v4 usam as validações e migrações existentes, sem alterar a origem. O candidato é projetado e conferido antes de pedir confirmação.
- Confirmação nativa mostra arquivo, quantidades, formato e substituição integral, com **Cancelar** como opção inicial. Cancelar a escolha ou a confirmação não grava arquivos, não cria cópia anterior e não anuncia sucesso.
- Antes da troca confirmada, cria e confere `sky.sqlite.pre-restore-<data>-<id>.sqlite` com os bytes exatos do ativo. Essa cópia permanece após gravações normais e pode desfazer a restauração pelo mesmo painel. A troca usa gravação/reabertura/validação atômicas antes de mudar a conexão ativa.
- A `.bak` continua rotativa. Restaurar dela conserva a origem selecionada; a cópia independente protege o banco que estava ativo. Em uma falha posterior à confirmação, a cópia válida já criada pode permanecer, sem perda do banco ativo ou da origem.
- `BackupService` mantém exclusividade desde a escolha até o término; o main recusa outras operações de dados, inclusive `load`. Informações, abertura da pasta fixa e fontes autorizadas continuam disponíveis. A interface bloqueia repetição e recargas automáticas por foco/data durante backup.
- IPC mantém remetente, frame principal e URL exata. Renderer continua sem Node; novas janelas, navegação externa e permissões permanecem bloqueadas. CSP acrescenta `frame-src 'none'`. Não há caminho arbitrário, SQL ou acesso genérico a arquivos exposto ao renderer.
- Falha de abertura mostra pasta e instruções de preservação/recuperação, sem resetar silenciosamente o banco. Erros de arquivo ausente, permissão, arquivo em uso ou falta de espaço têm mensagens úteis.
- `StoragePanel`, `backup.css`, `BackupService`, `backupFiles.ts` e os contratos de `shared/backup.ts` reaproveitam validação, materialização e gravação existentes. Nenhuma dependência, tabela, versão de esquema ou checksum foi alterado.

### Evidências da Fase 7

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd test` | 106 testes aprovados, nove arquivos | 94 cenários anteriores e 12 novos de backup, preservação, exclusividade e falhas |
| `npm.cmd run build` | Aprovado | TypeScript e builds do renderer, main e preload |
| `npm.cmd run test:e2e` | 13 fluxos aprovados | Dez fluxos anteriores e três novos com IPC/SQLite/arquivos reais |
| Restauração e reinício offline | Conteúdo completo preservado | Metas, revisões, resultados, auditoria, descanso, experiências, objetivos e preferências |
| Cópia anterior | Bytes exatos e recuperação comprovada | Independência de gravações normais, retorno após reiniciar e preservação da origem `.bak` |
| Interface | Duas capturas conferidas; painel em 1000 × 720 sem rolagem horizontal | Cartões, mensagens, caminhos extensos e guia offline |
| Documentação | Nove documentos, 50 links locais e três blocos SQL conferidos | Referências válidas, contrato com nove tabelas, integridade e chaves estrangeiras aprovadas sem alterar banco pessoal |

Os novos testes SQLite usam falhas controladas apenas nas operações de arquivo necessárias para comprovar falta de espaço, permissão ou renomeação indisponível. Comparam destino, ativo e origem byte a byte, verificam limpeza do temporário da própria operação e provam preservação em memória. Incluem cancelamentos sem alterações, recusa antes da confirmação, limite por arquivo esparso maior que 50 MB, formatos desconhecido/futuro, corrupção, caminhos protegidos e seus aliases, preparação descartada, leitura congelada mesmo se a origem externa mudar e bloqueio durante o diálogo.

O primeiro novo fluxo Electron exporta um perfil completo, altera metas/objetivos/tema, cancela escolhas e confirmação, segura uma confirmação para verificar exclusividade, restaura e compara o perfil original. Reinicia offline e usa a cópia anterior para recuperar as alterações. O segundo recusa destinos protegidos, erros de acesso, arquivos inválidos/futuros/grandes/ausentes e o próprio ativo; simula falha de gravação na restauração, compara arquivos e repete com sucesso. O terceiro restaura a `.bak` sem sobrescrevê-la e confere sandbox, CSP, novas janelas, navegação, fontes autorizadas e rejeição de IPC de outra janela.

Somente respostas de diálogos nativos e abertura pelo shell são controladas nos testes Electron; serviço, IPC, SQLite e arquivos não são simulados. Os testes verificam opções e conteúdo da confirmação, mas não automatizam os controles visuais dos diálogos do Windows. Essa integração manual e os executáveis em Windows limpo continuam na Fase 8. Após navegação cancelada, o teste confere evento impedido, URL/frame do `webContents`, DOM local e IPC autorizado: o Playwright pode manter uma navegação pendente mesmo com o documento local intacto.

[Painel de backups](docs/preview-fase-7.png) · [Restauração concluída](docs/restauracao-fase-7.png). Capturas com dados fictícios em perfis isolados; nenhum banco pessoal foi usado. Renderer local: aproximadamente 699 kB minificado, com o aviso de tamanho do Vite já existente. Lockfile e dependências permanecem os mesmos das Fases 5/6.

## Entrega local da Fase 8 — distribuição

- Versão 1.0.0 gerada em dois executáveis Windows x64, com nomes distintos e runtime/recursos locais. O usuário não precisa instalar Node.js. Os anexos estão em `release/`, que permanece fora do Git.
- Instalador NSIS por usuário, pt-BR, com atalhos e desinstalador; não abre automaticamente ao terminar. `deleteAppDataOnUninstall=false` conserva os dados por padrão. `app.setAppUserModelId` usa a identidade existente `br.app.oceueolimite`, antes da janela. Nome interno e `userData` preservados; nenhuma migração ou dependência nova.
- Recursos PE de ícone/metadados editados pelo builder. `ProductVersion=1.0.0.0` e `FileVersion=1.0.0` conferidos no executável do aplicativo. Authenticode retorna **NotSigned** em ambos os anexos: não há assinatura digital de editor, nem promessa de ausência de SmartScreen.
- `sql-wasm.wasm`, guia de recuperação e licenças acompanham o aplicativo. Os 45 textos de licença dos componentes de produção vêm da instalação local/lockfile. O pacote inclui arquivos locais e não precisa de servidor de desenvolvimento.
- `prepare-release.mjs` calcula SHA-256 dos executáveis reais e prepara seis arquivos de apoio: hashes, instruções, notas, recuperação, avisos de terceiros e licença MIT. `verify-release.mjs` confere os dois hashes, versão, runtime PE x64, recursos/ASAR e WASM exato; não encontrou bancos ou arquivos de teste no arquivo da aplicação.
- Workflow Windows atualizado para compilar e executar as suítes antes de armazenar os oito anexos. Tag push não publica. Somente uma solicitação manual `create_draft_release` em tag igual à versão do pacote pode criar um rascunho, em trabalho separado com permissão de escrita. Nenhum repositório presumido ou token no código; workflow remoto não executado nesta entrega.
- [Guia de distribuição](docs/LANCAMENTO.md), [notas 1.0.0](docs/NOTAS_V1.0.0.md) e gerador opcional de configuração do Windows Sandbox offline preparados. `node scripts/create-sandbox.mjs` gera `.test-data/windows-clean.wsb`, montando somente `release/` para leitura; não habilita recurso do Windows nem inicia VM.

| Artefato | Tamanho exato | Situação |
| --- | --- | --- |
| `O-Ceu-e-o-Limite-1.0.0-Windows-x64-Portatil.exe` | 119.679.628 bytes | Gerado, aberto offline e testado; sem assinatura de editor |
| `O-Ceu-e-o-Limite-1.0.0-Windows-x64-Instalador.exe` | 137.745.246 bytes | Gerado, instalado/reinstalado/desinstalado em pasta de teste; sem assinatura de editor |

### Evidências da Fase 8

| Verificação | Resultado | O que comprova |
| --- | --- | --- |
| `npm.cmd run dist:win` | Aprovado | TypeScript, renderer/main/preload, licenças, portátil, NSIS, hashes e notas |
| `node scripts/verify-release.mjs` | Aprovado | Dois hashes iguais ao manifesto, runtime x64, WASM exato, versão e ASAR sem bancos/testes |
| `npm.cmd test` | 106 testes aprovados, nove arquivos | Todas as regras e provas anteriores de persistência preservadas |
| `npm.cmd run test:e2e` | 13 fluxos aprovados | Todos os fluxos das Fases 1–7 com a identidade Windows do lançamento |
| `npm.cmd run test:release` | Três fluxos aprovados | Executáveis reais, instalação isolada, diálogos Win32 e escalas do renderer |
| `npm.cmd run typecheck` após formatação | Aprovado | Código/configuração dos novos testes e scripts tipados |
| `Get-AuthenticodeSignature` | `NotSigned` nos dois anexos | Assinatura de editor ausente, declarada no material de distribuição |
| Sandbox | Configuração XML gerada | Preparação offline para aceite externo; VM não executada |
| Documentação/workflow | 11 documentos, 70 links locais, três blocos SQL e YAML aprovados | Nove tabelas íntegras, referências válidas e rascunho condicionado a ação manual/tag; workflow remoto não executado |

O primeiro fluxo de distribuição instala o NSIS em diretório exclusivo de `.test-data`, abre o portátil real com perfil temporário, cria/avalia uma meta e tenta abrir o instalado simultaneamente. A segunda instância termina sem gravar; bytes do banco continuam iguais. O teste fecha o portátil, reinstala, abre o instalado e compara o conjunto inteiro. Cancela o seletor real de exportação, exporta para um arquivo real, altera dados e restaura usando o seletor/confirmação nativos. Confere o resultado, desinstala, compara os bytes preservados e reabre o portátil com o mesmo histórico.

Os outros dois fluxos abrem o runtime empacotado com fatores 1,25 e 1,5, verificam `devicePixelRatio`, ajustam a área para 1000 × 720 e navegam por metas, evolução, rotinas, Meu caminho e dados/guia sem rolagem horizontal. Esses fatores exercitam o renderer; não equivalem a alterar o DPI do Windows em máquina limpa.

O lançador portátil não fornece diretamente a conexão de processo esperada pelo conector Electron do Playwright. O teste inicia o `.exe` real e conecta a interface por CDP em loopback; o instalado usa o conector Electron. Caminhos de teste usam a opção nativa `--user-data-dir`; variáveis de teste/desenvolvimento são ignoradas pelo app empacotado. Seu `PATH` não contém Node.js, mas o host de desenvolvimento ainda tem Node.js instalado. Não há atalho de persistência ou canal de teste no produto.

Os diálogos desta suíte são reais e controlados por Win32, identificados pelo PID do próprio aplicativo. Os testes anteriores com respostas controladas continuam separados. A automação verifica a identidade NSIS nas visões do Registro e recusa instalação/atalho pessoal preexistente; alvos de instalação e desinstalador precisam ficar no diretório de teste verificado. As instalações temporárias foram removidas. Nenhum banco pessoal foi aberto. Novos arquivos de teste no OneDrive precisaram ser materializados localmente para o coletor enxergá-los como arquivos regulares; o conteúdo permaneceu igual e não foi colocado um contorno no aplicativo.

### Aceite externo ainda pendente

1. Este Windows não disponibiliza Windows Sandbox/VM limpa. Não foi comprovado o uso em Windows sem ferramentas instaladas, nem os caminhos padrão de dados em tal ambiente.
2. Reinstalação da mesma versão foi comprovada; atualização entre versões publicadas distintas ainda precisa ser testada. `1.0.0` é o primeiro pré-lançamento.
3. Escala do renderer 125%/150% passou. DPI do sistema e aparência/comportamento dos diálogos em Windows limpo permanecem no roteiro externo.
4. Assinatura de editor não foi adicionada; avisos reais de download/SmartScreen não foram caracterizados em máquina limpa.
5. O workflow não foi executado remotamente. Posteriormente à entrega local, o usuário pediu explicitamente publicar em seu GitHub. Repositório e pré-lançamento foram publicados na conta autenticada, conforme o registro seguinte.

A Fase 8 não está marcada como integralmente aceita. Os executáveis, material e testes locais estão entregues, e o [roteiro de aceite](docs/LANCAMENTO.md) permite concluir as provas restantes. [Portátil em execução](docs/preview-fase-8.png) · [Restauração no instalado](docs/restauracao-fase-8.png) · [Renderer 125%](docs/escala-125-fase-8.png) · [Renderer 150%](docs/escala-150-fase-8.png). Capturas com dados fictícios.

## Limites e diferenças que permanecem

1. Categorias iniciais permanecem fixas e metas semanais são binárias. Contagem de sessões por semana continua fora do MVP.
2. Evolução diária usa filtros de 7/30/90 dias; evolução mensal usa seis meses. A sequência significa ao menos uma conclusão diária, não cumprimento integral do dia.
3. Rotinas usam os três modelos revisados e intervalos até 31 dias. Atividades são pontuais; as escolhas originais permanecem no histórico e não são reescritas pelo formulário de edição recorrente. Novos modelos exigem revisão editorial das fontes.
4. A prévia do navegador usa IndexedDB experimental e não oferece as garantias de histórico/migração do SQLite desktop.
5. O v1 não registrava versões anteriores de título/categoria nem instantes de conclusão. A migração preserva o que existe e não inventa esses fatos.
6. Backup é local, sem criptografia, nuvem ou retenção automática. Limite de 50 MB; perda física do disco exige cópia em outro dispositivo. Diálogos reais foram exercitados localmente na Fase 8, sem equivaler a aceite de Windows limpo.
7. Portátil e instalador 1.0.0 foram publicados como pré-lançamento, sem assinatura de editor, com hashes e notas. Automação de build remota não está ativa; modelo disponível.
8. Windows limpo, atualização entre versões publicadas e DPI do sistema continuam pendentes; fatores de renderer 125%/150% foram comprovados no pacote local.

## Próxima verificação

Concluir o aceite externo da Fase 8 pelo roteiro de Windows limpo antes de promover uma versão estável. Preservar os anexos/hashes do pré-lançamento publicado. Para ativar CI, usar o modelo com uma sessão que permita enviar workflows; não presumir que isso já ocorreu.

Nenhuma fase adicional ou funcionalidade fora desse escopo foi iniciada.

## Registro dos marcos

| Data | Marco | Resultado |
| --- | --- | --- |
| 27/10/2026 | Protótipo inicial | Electron/React/SQLite v1, metas e rotinas experimentais; 12 testes e build |
| 27/10/2026 | Fase 0 | Seis documentos, README, 21 links locais e sintaxe do contrato SQL conferidos |
| 28/10/2026 | Fase 1 | SQLite v2/migração, Tailwind/tema escuro, Vitest, instalação limpa, build e dois fluxos Electron aprovados |
| 28/10/2026 | Fase 2 | Gestão de metas, dias programados, vigência, histórico e exclusão protegida; 35 testes, build e três fluxos Electron aprovados |
| 28/10/2026 | Fase 3 / MVP | Checklist, resumos separados, descanso e correções auditáveis; 52 testes, build e cinco fluxos Electron aprovados |
| 28/10/2026 | Fase 4 | Recharts, calendário de consistência, categorias históricas, comparações semanais e seis meses de evolução; instalação limpa, 64 testes, build e seis fluxos Electron aprovados |
| 28/10/2026 | Fase 5 | Rotinas versionadas, personalização, experiências e SQLite v3 com backup; 78 testes, build e oito fluxos Electron aprovados |
| 28/10/2026 | Fase 6 | Meu caminho, marcos/níveis derivados, objetivos independentes, temas e SQLite v4; 94 testes, build e dez fluxos Electron aprovados |
| 28/10/2026 | Fase 7 | Backup atômico, validação antes da confirmação, cópia anterior independente e guia de recuperação; 106 testes, build e 13 fluxos Electron aprovados |
| 28/10/2026 | Fase 8 — entrega local | Portátil/NSIS 1.0.0, hashes, licenças, notas e guia; 106 testes, 13 fluxos anteriores e três dos executáveis aprovados; aceite externo/publicação pendentes |
| 28/10/2026 | Publicação GitHub | Código público e pré-lançamento v1.0.0 com oito anexos, hashes remotos iguais e downloads anônimos 200; CI como modelo, aceite externo pendente |

## Publicação GitHub — solicitação posterior do usuário

- Conta autenticada: `PedroVtBarros`. Criado repositório público `PedroVtBarros/o-ceu-e-o-limite`, com código, documentação, licença e capturas de dados fictícios. Bancos, caches, credenciais e executáveis ficam fora do histórico Git. Autoria usa o endereço noreply público, sem e-mail pessoal.
- Tag `v1.0.0` vinculada ao commit `505e56ca8debd0a2633c4c28f1d2266052b44222`. Os executáveis são os mesmos testados na entrega local; nenhuma recompilação ou alteração de dados ocorreu na publicação.
- Release ID `427374505`, público, `draft=false`, `prerelease=true`. Publicado com os oito anexos revisados; tamanho e SHA-256 de cada um conferidos com os digests calculados pelo GitHub.
- Repositório, página da versão e ambos os downloads responderam HTTP 200 em consultas sem autenticação; tamanhos públicos dos executáveis correspondem aos originais.
- A sessão OAuth tem escopo de repositório/Releases, mas não `workflow`. O GitHub recusou o envio inicial do arquivo ativo. O commit ainda não publicado foi corrigido, sem reescrever histórico remoto: o conteúdo integral foi publicado em `docs/github-actions/release.yml.example`; o arquivo ativo permanece local e está excluído apenas por `.git/info/exclude`.
- CI não foi ativada nem executada. A publicação manual de código e Release foi concluída com as permissões existentes. As pendências de Windows limpo e atualização permanecem declaradas nas notas e neste documento; a Fase 8 não foi promovida a aceite integral.

[Repositório](https://github.com/PedroVtBarros/o-ceu-e-o-limite) · [Pré-lançamento 1.0.0](https://github.com/PedroVtBarros/o-ceu-e-o-limite/releases/tag/v1.0.0).
