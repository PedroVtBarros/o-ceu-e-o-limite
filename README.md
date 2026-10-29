# O Céu é o Limite

**Disciplina hoje. Evolução sempre.**

Aplicativo desktop pessoal para Windows, em TypeScript, para registrar metas diárias e semanais e acompanhar a evolução. Uso offline, sem conta e com SQLite no computador.

## Estado atual

**Versão 1.0.0 — pré-lançamento publicado.** Metas, análises, rotinas, Meu caminho e backups funcionam offline com SQLite v4. Os executáveis passaram nos testes locais; o aceite em Windows limpo e atualização entre versões ainda estão pendentes. Código e downloads públicos em [PedroVtBarros/o-ceu-e-o-limite](https://github.com/PedroVtBarros/o-ceu-e-o-limite).

A interface oferece três temas escuros: Violeta, Oceano e Floresta. Fontes, ícones e imagens necessários ao aplicativo estão no pacote local.

[Ver backups](docs/preview-fase-7.png) · [Ver restauração](docs/restauracao-fase-7.png) · [Ver Meu caminho](docs/preview-fase-6.png) · [Ver objetivos](docs/objetivos-fase-6.png) · [Ver temas](docs/temas-fase-6.png) · [Ver rotinas](docs/preview-fase-5.png) · [Ver a evolução](docs/preview-fase-4.png).

| Documento | Conteúdo |
| --- | --- |
| [REQUISITOS.md](REQUISITOS.md) | Comportamento, cálculos, regras e aceitação do MVP |
| [ARQUITETURA.md](ARQUITETURA.md) | Camadas, tecnologias, decisões e identidade visual |
| [BANCO_DE_DADOS.md](BANCO_DE_DADOS.md) | SQLite v4, objetivos, preferências, histórico e migrações |
| [ROADMAP.md](ROADMAP.md) | Fases 0–8 e critérios de conclusão |
| [PROGRESSO.md](PROGRESSO.md) | Estado real, verificações e pendências |
| [CLAUDE.md](CLAUDE.md) | Instruções para continuar o projeto |
| [Fontes das rotinas](docs/FONTES_ROTINAS.md) | Referências verificadas e origem das adaptações |
| [Guia de recuperação](docs/RECUPERACAO.md) | Exportar, restaurar e recuperar quando o aplicativo não abre |
| [Distribuição e publicação](docs/LANCAMENTO.md) | Usar os executáveis, testar em Windows limpo e preparar GitHub Releases |
| [Notas da versão 1.0.0](docs/NOTAS_V1.0.0.md) | Funcionalidades, instalação e assinatura |

As Fases 0 a 7 estão concluídas. A Fase 8 entregou os artefatos e testes locais; os critérios externos ainda abertos estão em [PROGRESSO.md](PROGRESSO.md).

## Abrir sem Node.js

No [pré-lançamento 1.0.0](https://github.com/PedroVtBarros/o-ceu-e-o-limite/releases/tag/v1.0.0), escolha um dos arquivos. Para compilações locais, eles ficam na pasta `release`:

- [Portátil para Windows x64](https://github.com/PedroVtBarros/o-ceu-e-o-limite/releases/download/v1.0.0/O-Ceu-e-o-Limite-1.0.0-Windows-x64-Portatil.exe): abrir diretamente, sem instalar.
- [Instalador para Windows x64](https://github.com/PedroVtBarros/o-ceu-e-o-limite/releases/download/v1.0.0/O-Ceu-e-o-Limite-1.0.0-Windows-x64-Instalador.exe): instalar para seu usuário e abrir pelo atalho.

Ambos incluem o runtime e os recursos locais. Feche o app antes de trocar de formato ou atualizar; o banco fica na pasta do usuário, fora da instalação. A compilação está **sem assinatura digital de editor**. Confira a origem e o [SHA256SUMS.txt](https://github.com/PedroVtBarros/o-ceu-e-o-limite/releases/download/v1.0.0/SHA256SUMS.txt); o Windows pode exibir avisos. Consulte o [guia de lançamento](docs/LANCAMENTO.md) para distribuição e verificação.

## Metas e programação

- Metas diárias podem valer todos os dias, só nos dias úteis ou em qualquer combinação de dias da semana.
- Metas semanais têm um compromisso único de segunda a domingo, com acompanhamento separado.
- Novas metas começam hoje ou em uma data futura. A agenda futura mostra planejamento, sem permitir resultados antecipados nem diminuir estatísticas.
- Edições incluem nome, descrição, categoria, frequência e programação. Você escolhe a vigência, respeitando o próximo período e a segunda-feira quando há mudança envolvendo uma meta semanal.
- Versões já aplicadas conservam as ocorrências e os resultados. Planos ainda futuros podem ser ajustados, e metas sem qualquer ocorrência podem ser corrigidas antes de começar.
- A tela separa metas ativas e arquivadas, filtra por categoria/nome e oferece histórico de versões.
- A exclusão exige confirmação e só é permitida quando nunca houve resultado. Desmarcar um resultado não apaga esse histórico; a meta permanece elegível para arquivamento.

## Checklist, descanso e correções

- Use ✓ para uma meta atingida e × quando não atingir; clique novamente na mesma opção para voltar a pendente.
- Uma pendência de período encerrado aparece como **Sem registro**. O aplicativo não a transforma automaticamente em resultado não atingido.
- O progresso diário inclui metas diárias e de rotina; o resumo de metas semanais possui sua própria barra. O total de metas diárias na semana usa as contagens, sem média de porcentagens arredondadas.
- Dias sem metas, futuros e de descanso ficam sem nota de desempenho. Não recebem 100% ou 0% artificiais.
- Escolha uma data no calendário para revisar resultados. Períodos encerrados abrem uma confirmação de correção; o botão de registros mostra cada mudança e seu horário.
- Planeje descanso para hoje ou uma data futura. Ele dispensa somente metas diárias e de rotina. Resultados semanais permanecem inalterados.
- Um dia que já teve avaliação diária não pode ser dispensado, mesmo após desmarcá-la. Descansos de dias encerrados permanecem preservados.
- A sequência de dias ignora folgas e descansos planejados, sem aumentá-la artificialmente. Um dia elegível encerrado sem conclusão interrompe a sequência.

## Evolução e consistência

- Escolha 7, 30 ou 90 dias para consultar o cumprimento diário e os resultados por categoria. Os totais usam contagens, preservando a categoria histórica de cada ocorrência.
- O gráfico mantém lacunas para descanso e dias sem metas. Uma tabela expansível permite consultar todos os valores por teclado.
- O calendário diferencia conclusão total, parcial, não atingidas, sem registro, hoje em aberto, descanso, sem metas e futuro. Selecione um dia e use **Revisar este dia** para abrir o checklist; uma correção recalcula as análises.
- Compromissos semanais aparecem em resumo próprio: cada meta conta uma vez por semana que cruza o intervalo, inclusive na virada do mês.
- A comparação mostra as duas últimas semanas encerradas, de segunda a domingo. A semana atual aparece separada como parcial. A variação usa pontos percentuais calculados sobre as proporções sem arredondamento intermediário.
- A evolução mensal cobre os últimos seis meses, somente com metas diárias e de rotinas. O mês atual é parcial e não inclui dias futuros. Sem compromissos, o período fica sem nota.

## Rotinas para inspirar

- Escolha Ilia Topuria, Haruki Murakami ou Benjamin Franklin. A prévia apresenta o relato usado como inspiração, a fonte, a data de consulta e a versão do modelo.
- Selecione as atividades que deseja copiar. Em **Personalizar atividade**, ajuste nome, descrição, categoria, minutos, horário e uma anotação pessoal de ritmo. Os campos opcionais começam em branco.
- O padrão é **só hoje**. Para repetir por vários dias, escolha explicitamente um intervalo de até 31 dias. Cada atividade vira uma meta pontual independente em cada data. Descanso continua dispensado e futuro não diminui o desempenho atual.
- Clique em **Quero experimentar** para salvar e abrir o checklist. Horários e minutos escolhidos também aparecem na agenda.
- Use **Minhas experiências** para consultar escolhas e resultados. Filtre por inspiração para comparar suas duas últimas experiências encerradas. Planejamentos futuros e experiências em andamento têm identificação própria.
- A cópia pessoal conserva fonte, versão e escolhas, mesmo que o catálogo seja atualizado. Reenviar a mesma solicitação não duplica metas; repetir intencionalmente em datas já usadas exige marcar a confirmação na prévia.
- Rotinas antigas continuam consultáveis como legado. O app preserva seus resultados sem inventar versão, horário ou data de consulta que não foram registrados.

As atividades são adaptações do aplicativo, e não uma reprodução de treinos, dietas ou agendas profissionais. Consulte as [fontes e notas do catálogo](docs/FONTES_ROTINAS.md).

## Meu caminho: conquistas, objetivos e temas

- Em **Conquistas**, consulte seis marcos com critérios e progresso visíveis. Cada compromisso atingido vale 10 XP; metas semanais contam uma vez por semana. Os cinco níveis começam em 0, 100, 300, 700 e 1500 XP.
- Pontos e conquistas vêm dos resultados atuais, inclusive do histórico anterior. Corrigir ou desmarcar uma meta recalcula o progresso. Repetir cliques ou reabrir a tela não acumula bônus.
- A melhor sequência histórica respeita folgas, descanso e dias encerrados sem conclusão. Descanso e futuro não geram pontos.
- Em **Objetivos de longo prazo**, defina uma conquista maior, com unidade, quantidade, progresso e prazo opcional. Atualize os valores, arquive ou reative. Esses objetivos não criam tarefas na agenda nem alteram o percentual diário ou XP.
- Em **Personalizar**, escolha Violeta, Oceano ou Floresta e controle os cartões de incentivo da visão geral/lateral. A preferência é salva no computador e mantida ao reabrir; o foco do teclado é preservado durante a gravação.

## Tecnologias

Stack definida: Electron, React, TypeScript, Tailwind CSS, SQLite, Recharts, electron-builder, Vitest e Playwright.

Electron/React/TypeScript, SQLite via `sql.js`, Tailwind, Recharts, Vitest e Playwright já estão em uso. Os gráficos são locais e funcionam offline. Consulte a situação de cada item em `ARQUITETURA.md`.

## Executar o aplicativo local

Requer Node.js 24 ou superior. A instalação inicial exige internet para baixar dependências e o runtime do Electron.

```powershell
npm.cmd ci
npm.cmd run dev
```

Para executar o build local sem servidor de desenvolvimento:

```powershell
npm.cmd run build
npm.cmd start
```

Prévia no navegador:

```powershell
npm.cmd run dev:web
```

A prévia salva em IndexedDB do navegador e continua sendo experimental. As garantias de migração, histórico e backup pertencem ao desktop, que usa um SQLite v4 separado na pasta `userData` do usuário. Veja o caminho exato em “Meus dados e backups”. Os dados não são sincronizados automaticamente entre os dois ambientes.

## Verificação

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run dist:win
node scripts/verify-release.mjs
npm.cmd run test:release
```

Validação atual: build com TypeScript, **106 testes Vitest, 13 fluxos Electron e três fluxos de distribuição aprovados**. Os novos testes abrem o portátil real, instalam/reinstalam o NSIS em pasta de teste, verificam exclusividade, exportam/restauram pelos diálogos reais do Windows e preservam o perfil após desinstalar/reabrir. O renderer empacotado foi conferido em 1000 × 720 e escalas de 125%/150%. Perfis temporários e instalação isolada não usam seu banco pessoal.

Os 13 fluxos anteriores continuam cobrindo migrações, histórico, rotinas e personalização; nos testes de backup da Fase 7 as respostas nativas são controladas. Os novos fluxos de distribuição usam os controles Win32 dos diálogos, sem simular o serviço ou escrever por atalhos de teste no produto. O executável recebe um `PATH` sem Node.js, mas isso ainda não equivale a uma VM Windows sem ferramentas instaladas. Windows limpo, escala do sistema e atualização entre versões publicadas continuam pendentes. Dependências e lockfile permanecem inalterados.

## Backups e recuperação

- Abra **Meus dados e backups** para consultar o caminho do banco ou abrir a pasta dos dados.
- **Exportar backup** grava e confere uma cópia SQLite com metas, versões, avaliações, correções, descansos, experiências, objetivos e preferências. Limite: 50 MB.
- **Restaurar backup** valida a cópia antes de mostrar arquivo, quantidades e versão na confirmação. Cancelar mantém os dados atuais. A restauração substitui todo o conjunto, sem mesclar históricos.
- Cada restauração confirmada guarda o estado anterior em `sky.sqlite.pre-restore-<data>-<id>.sqlite`. Esse arquivo permanece independente das gravações normais e pode ser restaurado pelo mesmo painel.
- Origem, banco ativo e cópias internas são protegidos contra sobrescrita indevida. Falhas aparecem no painel; o aplicativo não reinicializa silenciosamente um banco inválido.

O painel inclui um guia offline para recuperar inclusive quando o app não abre. Consulte também [RECUPERACAO.md](docs/RECUPERACAO.md). Mantenha exportações em outro dispositivo: as cópias locais não protegem contra perda do disco.

## Preservação de dados

O banco v4 mantém revisões da definição e cópias históricas em cada ocorrência. Alterações de frequência não sobrepõem períodos diários e semanais. Arquivar interrompe a geração de novos compromissos; uma alteração futura ainda não aplicada não passa a representar a meta arquivada quando sua data chega. Experiências conservam os dados do modelo e as escolhas originais; suas atividades pontuais não são reescritas pelo formulário de edição recorrente. Objetivos e preferências têm tabelas próprias.

Ao abrir v3, o app salva `sky.sqlite.pre-v4-<data>-<id>.sqlite` com os bytes exatos do original e valida/reabre o candidato v4 antes da substituição. Origens v2/v1 conservam os backups `.pre-v3-...`/`.pre-v2-...` e seguem a cadeia até v4 sem substituir o ativo por versões intermediárias. Para voltar a uma versão antiga, feche o app e use o backup correspondente ao esquema suportado; ele representa o estado anterior à migração. O procedimento e seus limites estão em `BANCO_DE_DADOS.md`. Informações que as versões antigas não registravam não são inventadas na migração.

## Distribuição

`npm.cmd run dist:win` gera portátil/NSIS x64, inclui recursos e licenças locais e prepara SHA-256, notas, instruções e guia de recuperação em `release/`. `node scripts/verify-release.mjs` confere os artefatos reais, o ASAR, SQLite/WASM e a ausência de bancos/testes no pacote. Não há atualização automática.

O [modelo de GitHub Actions](docs/github-actions/release.yml.example) compila, testa e guarda os anexos quando instalado em `.github/workflows/release.yml`. A sessão usada para publicar não possui escopo `workflow`, então a automação não está ativa no repositório. O modelo completo foi preservado; sua ativação pode ser feita pela interface do GitHub ou com autenticação apropriada. Publicação de arquivos e testes locais não dependem dessa automação. As instruções e o roteiro de Windows limpo estão em [LANCAMENTO.md](docs/LANCAMENTO.md).

Licença [MIT](LICENSE).
