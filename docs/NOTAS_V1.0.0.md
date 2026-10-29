# O Céu é o Limite 1.0.0

Disciplina hoje. Evolução sempre.

Aplicativo pessoal para Windows x64, em português, com funcionamento offline e banco SQLite local. O portátil e o instalador incluem o runtime: não é necessário instalar Node.js.

**Pré-lançamento para testes.** Compilação validada localmente com 106 testes de regras/banco, 13 fluxos Electron e três fluxos dos executáveis, incluindo instalação, diálogos de backup reais e escalas do renderer. O aceite em Windows limpo, DPI do sistema e atualização entre versões publicadas permanece pendente.

## Funcionalidades

- Metas diárias e semanais com programação, revisões e histórico preservado.
- Checklist, percentuais separados, descanso planejado e correções com registro.
- Evolução de 7/30/90 dias, calendário, categorias e comparações semanais/mensais.
- Rotinas adaptáveis inspiradas em Ilia Topuria, Haruki Murakami e Benjamin Franklin, com fontes e escolhas pessoais.
- Conquistas, níveis, objetivos independentes e temas Violeta, Oceano e Floresta.
- Exportação/restauração SQLite até 50 MB, validação antes da confirmação e cópia anterior independente.

## Escolher um arquivo

**Portatil.exe:** baixar e abrir, sem instalar. Os dados ficam na pasta do usuário deste computador, e não junto ao `.exe`. Levar o arquivo a outro computador não leva o histórico; use exportação/restauração.

**Instalador.exe:** instala para o usuário atual, cria atalhos e inclui desinstalador. Feche o aplicativo antes de atualizar. A desinstalação preserva a pasta de dados. Os dois formatos compartilham o banco quando usados pelo mesmo usuário.

## Integridade e assinatura

Esta compilação não possui assinatura digital de editor. O Windows pode mostrar avisos ao baixar ou abrir os arquivos; não há promessa de ausência de SmartScreen. Confira a origem do download e compare o SHA-256 com `SHA256SUMS.txt`.

No PowerShell, use `Get-FileHash -Algorithm SHA256 -LiteralPath 'caminho-do-arquivo.exe'` e compare o valor com o arquivo de hashes.

## Atualizar e recuperar

Exporte uma cópia em **Meus dados e backups**, feche o aplicativo e execute o novo instalador ou substitua o portátil. Não apague a pasta de dados. O banco atual é v4; formatos anteriores válidos são atualizados com proteção.

O guia `RECUPERACAO.md` acompanha os arquivos e o aplicativo. Mantenha uma exportação também em outro dispositivo para recuperar após perda do disco. Não há sincronização, atualização automática, conta online ou criptografia do banco.
