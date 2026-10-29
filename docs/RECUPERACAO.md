# Seus dados e a recuperação

**O Céu é o Limite · Fase 7 · 28/10/2026**

O aplicativo salva automaticamente no computador. Para guardar um momento do seu histórico ou levar os dados a outro computador, use **Meus dados e backups**. Este guia também está disponível dentro desse painel, sem internet.

## Onde ficam os dados

O arquivo principal se chama `sky.sqlite` e fica na pasta de dados do usuário, separada da instalação. O painel mostra o caminho exato e oferece **Abrir pasta dos dados**. Se o aplicativo não conseguir iniciar, a mensagem de erro também informa a pasta. Use esse caminho; não procure o banco na pasta do executável.

Não edite o arquivo enquanto o aplicativo estiver aberto. Ao atualizar o programa, conserve a pasta de dados. Testar atualização, reinstalação, portátil e instalador pertence à Fase 8.

## Guardar uma cópia

1. Abra **Meus dados e backups → Exportar backup**.
2. Escolha uma pasta e um nome. Use datas diferentes para conservar vários momentos.
3. Aguarde a mensagem **Cópia de segurança salva e conferida** e confira o caminho exibido.

A exportação inclui metas ativas e arquivadas, versões, resultados, correções, descansos, experiências de rotinas, objetivos de longo prazo e preferências de tema/incentivo. Ela não depende de conta ou internet. O limite é **50 MB** por arquivo.

A gravação passa por um arquivo temporário, sincronização e conferência antes de substituir o destino escolhido. O aplicativo impede exportar por cima do banco em uso ou de suas cópias internas. Cancelar o diálogo não altera arquivos. Se houver falha, o painel informa o problema e preserva o destino anterior.

Guarde uma exportação também em outro dispositivo para recuperar dados após perda do disco. O arquivo não é criptografado e contém informações pessoais; escolha um local de sua confiança. Não inclua bancos e backups no repositório público do projeto.

## Restaurar com o aplicativo aberto

1. Abra **Meus dados e backups → Restaurar backup** e selecione uma cópia `.sqlite` ou `.bak`.
2. O aplicativo confere tamanho, formato, integridade, versão e conteúdo. Cópias válidas dos formatos 1 a 4 são aceitas; formatos antigos são preparados no formato atual, sem alterar o arquivo escolhido. Um banco de versão futura exige um aplicativo compatível.
3. Confira o caminho, as quantidades e a versão na confirmação. **Cancelar** é a opção inicial.
4. Escolha **Restaurar e substituir** somente quando quiser trocar todo o conjunto de dados. A operação não mescla históricos.
5. Após o sucesso, o painel mostra o caminho da cópia independente do estado anterior. Metas, evolução, objetivos e aparência passam a refletir a cópia restaurada.

Enquanto a operação está em andamento, outras gravações e novas operações de backup ficam bloqueadas. Cancelar a escolha ou a confirmação mantém os dados atuais e não cria uma cópia de restauração. Arquivos inválidos são recusados antes da confirmação.

O arquivo escolhido é lido uma única vez para validação e restauração; a operação não o sobrescreve. Antes da troca do banco, o estado atual é salvo em `sky.sqlite.pre-restore-<data>-<id>.sqlite`. Gravações normais não substituem esse arquivo. Para voltar ao estado anterior, restaure essa cópia pelo mesmo painel. Ela representa o momento anterior àquela restauração, e não alterações posteriores.

Se uma gravação falhar após a confirmação, o banco atual e a origem continuam preservados; uma cópia anterior válida já criada pode permanecer na pasta. Corrija a causa indicada pelo painel, como permissão, espaço livre ou arquivo em uso, e tente novamente.

## Entender os arquivos da pasta

| Arquivo | O que guarda |
| --- | --- |
| `sky.sqlite` | Banco usado pelo aplicativo |
| `sky.sqlite.bak` | Estado anterior à última gravação comum; é uma cópia rotativa e pode mudar a cada gravação |
| `sky.sqlite.pre-restore-<data>-<id>.sqlite` | Estado anterior a uma restauração confirmada; permanece independente das gravações normais |
| `sky.sqlite.pre-v2-<data>-<id>.sqlite` | Origem v1 antes de sua atualização de formato |
| `sky.sqlite.pre-v3-<data>-<id>.sqlite` | Origem v2 antes de sua atualização de formato |
| `sky.sqlite.pre-v4-<data>-<id>.sqlite` | Origem v3 antes de sua atualização de formato |
| `sky.sqlite.tmp` e arquivos `.tmp-…` | Temporários de gravação; não são backups garantidos |

Restaurar a própria `.bak` conserva o arquivo escolhido e cria uma cópia independente do banco que estava ativo. As cópias de migração guardam somente o estado anterior à respectiva atualização: uma `.pre-v4` não contém os objetivos ou alterações criados depois dela. Não há limpeza automática nem política de retenção das cópias independentes.

## Se o aplicativo não conseguir abrir

1. Anote a pasta indicada na mensagem de erro e feche completamente o aplicativo.
2. Copie os arquivos existentes dessa pasta para outro local, antes de alterar qualquer arquivo. Preserve também o arquivo de backup que pretende usar.
3. Escolha uma exportação válida ou uma cópia automática compatível com a versão do aplicativo. Uma versão antiga do app não abre um formato mais recente.
4. Conserve o banco atual com outro nome, por exemplo `sky-preservado.sqlite`. **Copie** o backup escolhido para a pasta dos dados, com o nome exato **`sky.sqlite`**. Mantenha o arquivo de origem.
5. Reabra o aplicativo. Ele validará o arquivo e, se necessário, atualizará formatos anteriores com proteção. Confira as metas e o histórico antes de continuar.
6. Se o erro continuar, feche o aplicativo e preserve os arquivos para analisar a causa. Não apague o banco para tentar contornar a validação.

O aplicativo não reinicializa silenciosamente um banco inválido nem promete recuperar informações que nunca foram salvas ou exportadas. Corrupção, perda do disco e cópias antigas podem limitar o que está disponível. A `.bak` pode ajudar, mas não substitui exportações independentes em outro dispositivo.

As regras técnicas estão em [BANCO_DE_DADOS.md](../BANCO_DE_DADOS.md), e a evidência dos testes em [PROGRESSO.md](../PROGRESSO.md).
