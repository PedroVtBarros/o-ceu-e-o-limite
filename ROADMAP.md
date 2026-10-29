# Roadmap — O Céu é o Limite

**Atualizado:** 28/10/2026 · **Modo de trabalho:** uma fase por vez

O primeiro MVP termina na Fase 3. Cada fase tem escopo, saída e critérios observáveis. Implementações experimentais não dispensam os critérios. O estado real e as evidências ficam em [PROGRESSO.md](PROGRESSO.md).

## Fluxo de cada marco

1. Ler requisitos e a situação atual; escolher apenas o escopo da fase ativa.
2. Atualizar a documentação antes de uma implementação que altere dados ou regras.
3. Implementar reaproveitando a base adequada e preservando o que já passou.
4. Executar os testes do comportamento alterado e os testes de preservação necessários.
5. Registrar resultados, limitações e próximo passo em `PROGRESSO.md`.
6. Criar commit do marco quando houver repositório Git inicializado e alterações revisadas. Não misturar dados pessoais ou artefatos gerados.
7. Encerrar o marco com evidência; o trabalho da fase seguinte recebe um novo escopo. Este roadmap não exige uma pergunta adicional de permissão quando o usuário já autorizou várias fases.

## Fase 0 — Planejamento e arquitetura

**Escopo:** requisitos, regras de cálculo, histórico, persistência, identidade visual, fases e instruções de continuidade.

**Saída:** `REQUISITOS.md`, `ARQUITETURA.md`, `BANCO_DE_DADOS.md`, `ROADMAP.md`, `PROGRESSO.md`, `CLAUDE.md` e README coerente.

**Critérios:**

- [x] Definir diferenças entre metas diárias, semanais e atividades de rotina.
- [x] Definir fórmula, denominador, ausência de metas, futuro, pendência e descanso.
- [x] Definir revisões e cópias históricas, sem depender da definição atual da meta.
- [x] Definir banco no `userData`, migração segura e distribuição portátil/instalador.
- [x] Registrar o tema escuro com roxo da referência e a stack desejada.
- [x] Registrar limites do protótipo e critérios das fases seguintes.

**Commit sugerido:** `docs: define phase 0 requirements and architecture`

## Fase 1 — Estrutura e persistência

**Escopo:** adequar Electron/React/TypeScript, introduzir Tailwind e Vitest, navegação básica com o visual definido, repositório SQLite e migração v1→v2. Não implementar recursos novos das fases seguintes para justificar a arquitetura.

**Critérios:**

- [x] `npm.cmd ci` e build reproduzíveis a partir do lockfile.
- [x] Janela desktop abre offline com recursos locais e navegação por teclado.
- [x] Banco é criado no `userData`, fora do projeto e do executável.
- [x] Gravação confirmada sobrevive ao encerramento completo e reabertura.
- [x] Esquema versionado; migração v1→v2 testada com backup e preservação.
- [x] Banco futuro/corrompido e falha de escrita geram erro, sem reset silencioso.
- [x] Renderer isolado, bridge restrita e validação real no main.
- [x] Testes existentes continuam cobrindo as mesmas garantias após adotar Vitest.
- [x] Playwright executa ao menos abertura e persistência no Electron.

**Evidências do marco:** 22 testes Vitest, dois fluxos Electron, instalação limpa e build aprovados. Detalhes e limites em `PROGRESSO.md`.

**Commit sugerido:** `feat: establish desktop foundation and versioned storage`

## Fase 2 — Sistema de metas

**Escopo:** cadastro, edição com vigência, categorias, programação, arquivamento, exclusão elegível e recuperação da agenda.

**Critérios:**

- [x] Criar diária para dias específicos e semanal com compromisso único.
- [x] Validar campos e datas no main e na interface.
- [x] Agenda respeita início, revisão vigente, dias e arquivamento.
- [x] Revisões não se sobrepõem; mudança de frequência não cria compromissos duplicados.
- [x] Editar nome/categoria/frequência mantém inalteradas as ocorrências anteriores.
- [x] Meta com qualquer evento de resultado só pode ser arquivada.
- [x] Meta elegível pode ser excluída após confirmação, sem linhas órfãs.
- [x] Reabrir o app preserva programação e revisões.

**Evidências do marco:** 35 testes Vitest, três fluxos Electron e build aprovados. O fluxo inclui seleção de dias, revisão futura, consulta de versões, agenda futura, exclusão com cancelamento/confirmação, bloqueio por histórico, arquivamento e reinício.

**Commit sugerido:** `feat: add scheduled goals with preserved history`

## Fase 3 — Checklist e progresso diário · MVP

**Escopo:** avaliação, calendário para corrigir resultados, descanso, porcentagens e resumo semanal separado.

**Critérios:**

- [x] Marcar atingida, não atingida e pendente, sem duplicar resultado.
- [x] 8/10 produz 80%; 1/3 apresenta 33%; pendentes entram no denominador.
- [x] Dia sem agenda e descanso exibem motivo, sem nota artificial.
- [x] Meta semanal atualiza um resultado e não altera a barra diária.
- [x] Dias futuros não admitem resultados nem diminuem estatísticas.
- [x] Pendência passada é identificada como sem registro, sem conclusão automática.
- [x] Correção no calendário tem evento de auditoria e recalcula os totais.
- [x] Descanso respeita data e não elimina resultados existentes.
- [x] Fluxo completo passa no Electron: criar → avaliar → fechar → reabrir → conferir.

**Evidências do marco 3:** 52 testes Vitest, cinco fluxos Electron e build aprovados. Os novos fluxos verificam teclado, progresso diário/semanal separado, descanso futuro, restauração da programação, confirmação/cancelamento de correção, trilha de alterações e preservação após reinício. Primeiro MVP concluído; a Fase 4 foi executada no marco seguinte.

**Commit sugerido:** `feat: deliver daily checklist and progress MVP`

## Fase 4 — Evolução e estatísticas

**Escopo:** Recharts, últimos 7/30/90 dias, calendário de consistência, sequência, comparações semanais e evolução mensal.

**Critérios:**

- [x] Séries e categorias usam atributos históricos das ocorrências.
- [x] Dias sem meta/descanso são lacunas com legenda adequada.
- [x] Metas semanais são contadas uma vez e exibidas separadamente.
- [x] Percentuais agregados usam contagens, não médias de valores arredondados.
- [x] Sequência respeita folgas, descanso, hoje em aberto e dias elegíveis sem conclusão.
- [x] Comparações identificam períodos parciais e não atribuem obrigações anteriores à criação.
- [x] Valores exibidos conferem com fixtures de meses e semanas em fronteiras de calendário.

**Evidências do marco 4:** Recharts 3.10.1, instalação limpa pelo lockfile, build, 64 testes Vitest e seis fluxos Electron aprovados. Séries de 7/30/90 dias, calendário com revisão do checklist, categorias históricas, duas semanas encerradas e seis meses com o atual parcial. Fixtures cobrem virada de ano, fevereiro bissexto, semana entre meses, proporções por contagem e recálculo após correção/reabertura. Layout 1000 × 720 conferido sem rolagem horizontal. Esquema v2 e IPC preservados.

**Commit sugerido:** `feat: add consistency calendar and progress analytics`

## Fase 5 — Rotinas de pessoas famosas

**Escopo:** catálogo offline, detalhes com fontes, prévia de atividades, personalização e acompanhamento das experiências.

**Critérios:**

- [x] Topuria e os demais modelos têm fonte, data de consulta e versão.
- [x] Adaptações são explícitas; não apresentar um treino/dieta inventados como rotina real.
- [x] Selecionar e ajustar atividades antes de adicioná-las à agenda.
- [x] Padrão só hoje; intervalo maior exige escolha explícita.
- [x] Cópias pessoais são independentes; atualizar o catálogo não reescreve experiências.
- [x] Duplo clique/repetição de requisição não duplica o desafio.
- [x] Histórico permite comparar experiências do próprio usuário.
- [x] Sem rede, catálogo e atividades continuam acessíveis.

**Evidências do marco 5:** três modelos v1 com fontes consultadas em 28/10/2026; seleção, adaptação e intervalo explícito até 31 dias; histórico pessoal com comparação de experiências encerradas. SQLite v3 aditivo com backup v2 exato e preservação do legado; idempotência, falhas de escrita e cópias independentes comprovadas. Build, 78 testes Vitest e oito fluxos Electron aprovados. Nenhuma dependência adicionada.

**Commit sugerido:** `feat: add adaptable routine challenges`

## Fase 6 — Motivação e personalização

**Escopo:** conquistas, níveis, objetivos de longo prazo, temas e mensagens.

**Critérios:**

- [x] Conquistas e níveis têm critérios visíveis e usam registros reais.
- [x] Recalcular após correção não duplica recompensas.
- [x] Objetivos de longo prazo não entram por acidente no denominador diário.
- [x] Tema e preferências persistem e mantêm contraste/foco legíveis.
- [x] Mensagens não ocultam ações e não tratam falhas como punição.

**Evidências do marco 6:** tela Meu caminho com seis conquistas e cinco níveis derivados do histórico, objetivos com acompanhamento independente e três temas escuros com preferência de incentivo. SQLite v4 aditivo com preservação das experiências e backup v3 exato. Build, 94 testes Vitest e dez fluxos Electron aprovados; correções recalculam pontos e marcos sem bônus acumulados. Temas, foco por teclado, reinício offline e separação da porcentagem diária comprovados. Nenhuma dependência adicionada.

**Commit sugerido:** `feat: add personal milestones and customization`

## Fase 7 — Segurança e backup

**Escopo:** completar exportação/restauração, validação de arquivos, recuperação e revisão dos limites de acesso. Proteção básica de gravação e migrações já é obrigatória na Fase 1.

**Critérios:**

- [x] Exportar, restaurar, fechar e reabrir conserva conteúdo e histórico.
- [x] Restauração substitui dados só após confirmação e mantém backup anterior.
- [x] Arquivo inválido, banco futuro e corrupção são recusados sem perda do banco ativo.
- [x] Cancelamento e falhas simuladas preservam os arquivos.
- [x] IPC, navegação e fontes externas continuam restritos.
- [x] Guia de recuperação informa onde ficam os dados e o que pode ser recuperado.

**Evidências do marco 7:** painel com exportação atômica, leitura limitada a 50 MB e validação antes da confirmação nativa. Cópia independente `.pre-restore-...` conserva o estado anterior após gravações e reinício; restaurar da `.bak` preserva a origem. Build, 106 testes Vitest e 13 fluxos Electron aprovados, incluindo os dez anteriores. Cancelamentos, falhas de escrita, versões inválidas/futuras, aliases de caminhos e limites IPC/navegação/fontes comprovados. [Guia offline e de recuperação manual](docs/RECUPERACAO.md) disponível. Esquema v4 e dependências inalterados. Respostas de diálogos/shell controladas nos testes; integração manual do Windows fica na Fase 8.

**Commit sugerido:** `feat: validate backup and recovery workflows`

## Fase 8 — Distribuição e lançamento

**Escopo:** portátil, NSIS, teste em ambiente Windows limpo e material de lançamento.

**Critérios:**

- [x] Gerar `.exe` portátil e instalador `.exe` com nomes distintos, ambos identificados com a versão 1.0.0.
- [ ] Usuário sem Node.js abre ambos e usa metas offline.
- [x] Troca entre portátil e instalado encontra o mesmo banco e impede gravação concorrente.
- [ ] Atualização e reinstalação preservam o histórico; desinstalação não apaga dados por padrão.
- [x] Verificar layout em 1000 × 720 e escalas de renderer de 125%/150%.
- [x] Gerar SHA-256, notas e instruções para GitHub Releases.
- [x] Indicar se os binários têm assinatura; não prometer ausência de alerta do Windows sem verificar.
- [ ] Publicar Release somente no repositório indicado e quando a publicação estiver autorizada.

**Evidências locais do marco 8:** portátil e NSIS 1.0.0 x64 gerados; Authenticode `NotSigned`, recursos/ASAR conferidos e oito anexos preparados. Build, 106 testes Vitest, 13 fluxos Electron e três de distribuição aprovados. Portátil real, reinstalação, segunda instância, backup pelos diálogos Win32 e reabertura do perfil preservado após desinstalar comprovados. Escalas 125%/150% conferidas no renderer. Configuração de dados preservados na desinstalação e roteiro/Sandbox offline preparados. **Aceite externo pendente:** Windows limpo sem Node.js, DPI do sistema, caminhos padrão e atualização entre versões publicadas. A reinstalação local não é prova de atualização entre versões distintas. Nenhum GitHub Release foi criado/publicado. [Guia de distribuição](docs/LANCAMENTO.md).

**Commit sugerido:** `build: package portable and installer Windows releases`

## Fora do primeiro lançamento

Conta online, servidor, sincronização em nuvem, aplicativo mobile, rede social, rankings públicos, integração com relógios e atualização automática. Novos pedidos entram em um marco definido, sem se misturarem à fase em andamento.
