# O Céu é o Limite — instruções do projeto

Aplicativo desktop pessoal, em português brasileiro, TypeScript, offline e com SQLite local. Assinatura: **Disciplina hoje. Evolução sempre.**

## Antes de trabalhar

1. Leia `PROGRESSO.md` para identificar fase, evidências e pendências.
2. Consulte `REQUISITOS.md`, `ARQUITETURA.md`, `BANCO_DE_DADOS.md` e o marco correspondente em `ROADMAP.md`.
3. Preserve instruções e mudanças mais recentes do usuário; os documentos devem acompanhá-las.
4. Trabalhe no escopo autorizado. Uma fase por vez é o padrão; não iniciar outra apenas porque existe um protótipo de seu recurso. Se o usuário autorizar várias fases, execute a sequência com seus critérios, sem pedir novamente a mesma autorização.

## Situação inicial

Fases 0 a 7 concluídas; Fase 8 entregou portátil e instalador 1.0.0 x64, hashes, notas e testes locais. SQLite continua v4, nove tabelas e checksums preservados. Verificação: build, 106 testes Vitest, 13 fluxos Electron e três fluxos dos executáveis aprovados. Dependências/lockfile inalterados. Pendentes: Windows limpo sem ferramentas, escala física do sistema, atualização entre versões publicadas e publicação no repositório indicado. Não declarar Fase 8 integralmente aceita nem Release publicado enquanto essas provas não ocorrerem. Estado detalhado em PROGRESSO.md.

## Regras que devem permanecer verdadeiras

- Dados no `app.getPath('userData')`, fora do executável/instalação. A atualização não apaga o banco.
- Nenhuma escrita aparece como salva antes da confirmação do main e do arquivo.
- Renderer sem Node.js; ponte IPC específica, isolamento de contexto e sandbox habilitados.
- Valide entradas no main, além dos formulários.
- Diário e semanal têm períodos e percentuais próprios; não multiplicar uma meta semanal pelos dias.
- Futuro, descanso e ausência de agenda não são falhas nem conclusões artificiais.
- Editar a definição de uma meta não reescreve ocorrências antigas. Use revisões e cópias históricas.
- Corrigir um resultado passado é ação explícita e mantém evento de auditoria.
- Rotinas são cópias pessoais de modelos versionados com fontes; distinguir adaptações de fatos verificados.
- Não apagar/resetar banco para contornar uma migração. Faça backup e prove preservação/reabertura.
- Validar backups antes da confirmação; cancelar não grava. Preservar a origem escolhida e criar `.pre-restore-...` independente antes de substituir o ativo. Não usar a `.bak` rotativa como única proteção anterior à restauração.
- Não introduzir servidor, autenticação, sincronização ou serviços externos sem demanda de escopo.

## Tecnologias e organização

Destino: Electron, React, TypeScript, Tailwind, SQLite (`sql.js` empacotado), Recharts, electron-builder, Vitest e Playwright.

`shared/` contém regras puras e contratos. `electron/` possui persistência, arquivos e IPC. `src/` possui a interface. Reaproveite a estrutura adequada; extraia módulos conforme a fase exigir, sem uma reestruturação ampla sem relação com a entrega.

Análises ficam em `shared/analytics.ts`; a tela em `src/components/EvolutionPage.tsx` e os gráficos compartilhados em `ProgressCharts.tsx`. Usam o `Snapshot` existente, ocorrências históricas e contagens. Gráficos preservam valores nulos, tabelas acessíveis e lacunas. Semanas cruzando o filtro contam uma vez no resumo próprio; evolução mensal não reparte semanais entre meses. Semana e mês atuais são parciais. Não usar a média dos percentuais diários para calcular totais.

Rotinas: `shared/routines.ts` é o catálogo empacotado com fonte, data e versão; revisão editorial em [docs/FONTES_ROTINAS.md](docs/FONTES_ROTINAS.md). `shared/routineRuns.ts` valida escolhas e calcula progresso. `RoutinePreview.tsx` começa só hoje e oferece intervalo explícito até 31 dias. `RoutinesPage.tsx` consulta experiências e legado. `startRoutine` usa chave de operação única e entrada normalizada: repetir a solicitação não duplica, e chave reutilizada com outras escolhas falha. Sobreposição intencional exige confirmação. As cópias mantêm fonte/versão/escolhas independentemente do catálogo. Datas futuras não contam até chegarem; descanso mantém dispensa. Não inferir versão/duração/fonte das cópias legadas, nem reescrever o checksum da migração 2.

Interface: Violeta mantém fundo `#0D1424`, cartões `#1D2940`, ações `#6551D9` com texto branco e destaque `#C4B8FF`. Oceano e Floresta usam tokens próprios em `journey.css`. Siga a hierarquia da referência do usuário; priorize contraste, teclado e mensagens motivadoras sem inventar dados.

Fase 6: `shared/journey.ts` deriva 10 XP por compromisso elegível atingido, cinco níveis e seis marcos. Não persistir um saldo de recompensas ou somar pontos por evento/clique. A melhor sequência é histórica, ignorando folgas/descanso e respeitando dias encerrados sem conclusão; correções podem recalcular conquistas e níveis. `long_term_goals` não cria metas/ocorrências/pontos: progresso manual, alvo, unidade, prazo opcional, arquivamento/reativação e criação idempotente. `shared/personalization.ts` valida campos e define três paletas; `JourneyPage`/`LongTermGoalForm` são a interface e `journey.css` aplica tokens, foco e layouts. Preferências só mudam visualmente após confirmação do main; manter foco durante o IPC usando bloqueio por estado, sem desativar o controle focado. A prévia IndexedDB permite aparência, mas objetivos e garantias históricas exigem desktop. Não alterar checksums v2/v3; a migração v4 é aditiva e conserva backup v3 `.pre-v4-...`.

Fase 7: `BackupService` (`electron/backup.ts`) bloqueia outras operações de dados durante escolha/validação/confirmação/gravação. `shared/backup.ts` define contratos e limite de 50 MB. Diálogos só no main; não aceitar caminhos do renderer. `prepareImport` valida/migra e projeta um candidato isolado antes da confirmação com Cancelar inicial; a origem é lida uma única vez. Confirmar cria cópia exata `.pre-restore-...`, grava/reabre/valida atomicamente e só então troca a conexão. Restaurar da `.bak` preserva essa origem. `backupFiles.ts` protege caminhos reais/hardlinks/junctions dos arquivos internos, limita leitura antes da alocação e exporta por temporário exclusivo sincronizado/conferido. `StoragePanel` informa sucesso/cancelamento/falha, caminho de recuperação e guia offline; `openDataFolder` só abre a pasta fixa. Não adicionar criptografia, retenção automática ou novo esquema sem escopo. Guia completo em [docs/RECUPERACAO.md](docs/RECUPERACAO.md).

Nos testes Electron de backup, apenas respostas nativas e shell são controlados; operações de dados e arquivos são reais. Não introduzir um canal de teste no produto. A navegação externa cancelada pode deixar o Playwright aguardando uma navegação inexistente: conferir o evento impedido, `webContents.getURL()`, `mainFrame.url`, DOM e IPC do documento local. O teste manual dos diálogos do Windows e de artefatos distribuídos ainda pertence à Fase 8.

Fase 8: `npm.cmd run dist:win` compila/coleta licenças, gera os dois formatos sem publicar e prepara os anexos. `verify-release.mjs` verifica hashes, PE x64, WASM e ASAR sem dados pessoais. `tests/release` abre os artefatos reais, usa diálogos Win32, instala somente em `.test-data` e recusa registros/atalhos pessoais existentes; nunca contornar essa proteção. O portátil conecta por CDP, pois seu lançador não encaminha a conexão do Playwright Electron. Use a opção nativa `--user-data-dir` para isolar testes, sem aceitar SKY_TEST_DATA_DIR no pacote. Preserve appId/nome interno, a pasta de dados e `deleteAppDataOnUninstall=false`. O renderer foi testado com fator 1,25/1,5, sem afirmar teste de DPI do sistema em Windows limpo. Guias em [docs/LANCAMENTO.md](docs/LANCAMENTO.md) e [docs/NOTAS_V1.0.0.md](docs/NOTAS_V1.0.0.md). Regerar notas/hashes a cada rebuild; para nova versão, atualizar pacote/lock, notas e nomes dos testes. Não incluir executáveis em commits. Tag push só compila; rascunho de Release exige opção manual em tag correspondente, e publicar é ação posterior autorizada.

## Comandos atuais

Publicação autorizada posteriormente pelo usuário: destino `PedroVtBarros/o-ceu-e-o-limite`, público, v1.0.0 como pré-lançamento. A sessão OAuth não possui escopo `workflow`; o GitHub recusou o envio do arquivo ativo. O conteúdo integral fica versionado em `docs/github-actions/release.yml.example`. O arquivo `.github/workflows/release.yml` local foi preservado e excluído só por `.git/info/exclude`. No repositório remoto não há Actions ativo; as descrições anteriores do workflow explicam o modelo, condicionado à sua ativação por uma conta autorizada. Não pedir nova autenticação apenas para publicar código/Releases, que a sessão já permite. Consultar PROGRESSO.md para a verificação final da publicação.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run dist:win
node scripts/verify-release.mjs
npm.cmd run test:release
```

`npm.cmd` evita a restrição comum a scripts `npm.ps1` no PowerShell. Node.js 24+. Testes unitários usam `.test-data`; testes Electron usam perfis temporários isolados no diretório temporário do sistema, fora do projeto e do executável. Capturas ficam em `.test-data`. Nunca apontar testes destrutivos para o banco pessoal.

Em ambiente com proxy de certificados do sistema, `NODE_USE_SYSTEM_CA=1` pode ser necessário para downloads; não desative a verificação TLS. Restrição do ambiente de execução não deve virar um contorno permanente no código do produto.

## Verificar e encerrar um marco

- Acrescente testes quando comprovarem regras, preservação ou risco da mudança; documentação isolada exige consistência e referências, não uma suíte nova.
- Execute os critérios da fase e registre comandos, resultados e limites em `PROGRESSO.md`.
- Diferencie teste de unidade, teste SQLite, teste do processo Electron e teste de `.exe` em Windows limpo.
- Build aprovado não significa executável gerado, E2E aprovado ou fase concluída.
- Mantenha README e documentação coerentes com o estado real.
- Se houver Git inicializado e o marco estiver revisado, use commit que identifique sua intenção. Não incluir bancos, backups, caches, `node_modules`, arquivos pessoais ou binários de distribuição no código-fonte.
- Publicação no GitHub usa o repositório e escopo autorizados; não confundir a intenção de o usuário publicar depois com autorização para publicar agora.
- Relate o que foi entregue, a prova obtida e a próxima pendência, sem apresentar recursos planejados como prontos.
