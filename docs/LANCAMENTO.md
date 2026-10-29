# Distribuição Windows e GitHub Releases

**Versão 1.0.0 · Windows x64 · 28/10/2026**

## Arquivos para o usuário

Na pasta `release`, distribua estes arquivos:

| Arquivo | Uso |
| --- | --- |
| `O-Ceu-e-o-Limite-1.0.0-Windows-x64-Portatil.exe` | Baixar e abrir, sem instalar |
| `O-Ceu-e-o-Limite-1.0.0-Windows-x64-Instalador.exe` | Instalar para o usuário atual, com atalhos e desinstalador |
| `SHA256SUMS.txt` | Conferir a integridade dos dois executáveis |
| `LEIA-ME.txt` | Instruções rápidas |
| `NOTAS-DA-VERSAO.md` | Funcionalidades, limites e tamanhos reais |
| `RECUPERACAO.md` | Backups e recuperação |
| `THIRD_PARTY_NOTICES.txt` e `LICENSE.txt` | Licenças dos componentes e do aplicativo |

Os executáveis incluem Electron, SQLite/WASM, fontes e interface locais. Não é necessário instalar Node.js ou manter um servidor. Não envie `win-unpacked`, arquivos `.7z`, `.blockmap`, caches ou bancos pessoais para o Release. O `.blockmap` gerado pelo empacotador não é usado: não há atualização automática.

Esta compilação não tem assinatura digital de editor. Ambos os arquivos devem ser identificados como **sem assinatura**; SmartScreen/antivírus podem exibir alertas. Confirme a origem e o SHA-256; não há promessa de ausência de avisos.

## Instalar, atualizar e alternar entre formatos

O portátil abre sem instalação; seus dados ficam na pasta do usuário do computador, fora do `.exe`. Copiar somente o portátil para outro computador não leva o histórico.

O instalador cria uma instalação por usuário, sem solicitar instalação para todos. Não inicia automaticamente o aplicativo ao terminar. Use o atalho **O Céu é o Limite** para abrir. Desinstalar preserva o banco e os backups por padrão.

Para atualizar, exporte um backup pelo painel, feche o aplicativo e abra o novo instalador ou substitua o portátil. Os dois formatos usam a mesma identidade e a mesma pasta de dados. Uma segunda instância não grava simultaneamente. Nunca substitua arquivos da instalação com o aplicativo aberto.

O caminho exato do banco aparece em **Meus dados e backups**. Não apague a pasta para atualizar ou reinstalar. Consulte [RECUPERACAO.md](RECUPERACAO.md).

## Gerar e verificar os arquivos

Requer Windows x64 e Node.js 24+ somente no computador de desenvolvimento. O primeiro build pode baixar as ferramentas oficiais do Electron/electron-builder; o aplicativo pronto funciona offline.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run dist:win
npm.cmd run test:e2e
node scripts/verify-release.mjs
npm.cmd run test:release
```

`dist:win` compila, coleta os textos de licença locais, cria portátil/NSIS sem publicar e prepara hashes/notas. `verify-release` confere hashes, recursos essenciais, versão, runtime x64 e ausência de bancos/testes no ASAR. `test:release` abre o aplicativo empacotado em perfis temporários; a opção nativa `--user-data-dir` mantém os dados pessoais separados. A instalação de teste só pode usar `.test-data`, recusa instalação pessoal preexistente e remove a instalação de teste ao terminar. Não há ramificação ou IPC de teste no aplicativo distribuído.

Os testes locais não substituem uma máquina limpa. O teste automatizado retira Node.js do `PATH` do aplicativo, mas o computador de desenvolvimento ainda tem Node.js e ferramentas instalados. As evidências e pendências ficam em [PROGRESSO.md](../PROGRESSO.md).

## Conferência em Windows limpo

Use uma VM Windows x64 sem Node.js ou o Windows Sandbox, quando disponível. Para gerar uma configuração do Sandbox com rede desabilitada e somente a pasta `release` montada para leitura:

```powershell
node scripts/create-sandbox.mjs
```

Abra `.test-data/windows-clean.wsb` em um computador com o recurso Windows Sandbox instalado. Isso cria uma sessão temporária; os dados da sessão desaparecem ao fechá-la. O script apenas gera a configuração, sem habilitar recursos do sistema nem iniciar uma VM.

Dentro da máquina limpa, copie os arquivos para uma pasta local, confira os hashes e registre versão do Windows, escala, resultados e capturas. Execute:

- [ ] Abrir o portátil offline e criar metas diárias/semanais; avaliar e reabrir sem perda.
- [ ] Instalar e abrir pelo atalho, sem Node.js, usando o mesmo histórico do portátil.
- [ ] Abrir os dois formatos e verificar apenas uma instância gravadora.
- [ ] Exportar, cancelar e restaurar com os diálogos reais; conferir histórico e tema após reiniciar.
- [ ] Reinstalar/atualizar, desinstalar e abrir novamente o portátil sem perder os dados.
- [ ] Conferir 1000 × 720 e escalas do Windows em 125% e 150%, incluindo modais e diálogos.
- [ ] Registrar avisos de assinatura/SmartScreen/antivírus observados, sem presumir ausência.

O teste local por `--force-device-scale-factor` confere o renderer em 125%/150%; não equivale a mudar a escala do sistema de uma máquina limpa. Atualização entre versões publicadas deve repetir a prova com um backup representativo da versão anterior.

## Publicar no GitHub

Os executáveis são anexos de **GitHub Releases**, e não arquivos para commit. Para uma versão estável, conclua o aceite limpo. O proprietário autorizou publicar 1.0.0 como pré-lançamento em `PedroVtBarros/o-ceu-e-o-limite`, mantendo explícitos os critérios externos pendentes.

A sessão de publicação tem permissão de repositório e Releases, mas não possui o escopo `workflow`. Por isso o workflow foi publicado como [modelo completo](github-actions/release.yml.example), sem automação ativa. Para ativá-lo, copie seu conteúdo para `.github/workflows/release.yml` pela interface do GitHub ou use uma autenticação com essa permissão. O arquivo ativo local foi preservado e excluído apenas localmente do envio; num clone novo, basta instalar o modelo. Não é necessário ativar a automação para baixar ou usar os executáveis.

1. Envie somente o código-fonte e documentação, respeitando `.gitignore`. Não inclua `.test-data`, SQLite, backups, caches, credenciais ou `release/` no Git.
2. Crie a tag `v1.0.0` no commit revisado. Se o modelo `Windows desktop` estiver ativado, ele compila/testa e guarda os arquivos. Enviar uma tag não publica um Release automaticamente.
3. Com a automação ativada, um rascunho pode ser criado por **Run workflow**, nessa tag, marcando **create_draft_release**. A tag deve corresponder à versão de `package.json`. Só esse trabalho recebe permissão de escrita e cria um rascunho, sem publicar.
4. Alternativamente, crie um rascunho manual em **Releases → Draft a new release**, selecione `v1.0.0`, use o conteúdo de `release/NOTAS-DA-VERSAO.md` e anexe os oito arquivos indicados acima. Use os hashes da mesma compilação dos executáveis anexados.
5. Revise os anexos, assinatura declarada, notas e teste limpo. Publique o rascunho quando a publicação estiver autorizada.

O workflow foi preparado para o repositório de destino; sua execução remota e a publicação só podem ser confirmadas após ocorrerem. Nenhum token precisa ser colocado nos arquivos do projeto. Para novas versões, atualize pacote/lockfile, fonte das notas em `prepare-release.mjs` e nomes dos testes; mantenha appId/nome interno e repita a prova de preservação.

Referências técnicas: [NSIS e portátil](https://www.electron.build/v26/docs/nsis/), [pastas e identidade do Electron](https://www.electronjs.org/docs/latest/api/app), [artefatos de workflows](https://docs.github.com/en/actions/tutorials/store-and-share-data).
