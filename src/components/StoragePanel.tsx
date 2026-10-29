import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  CircleHelp,
  Database,
  FolderOpen,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type {
  BackupExportResult,
  BackupRestoreResult,
} from "../../shared/backup";
import type { StorageInfo } from "../../shared/types";
import { Modal } from "./Modal";

export function StoragePanel({
  storage,
  busy,
  onClose,
  onExport,
  onRestore,
  onOpenFolder,
}: {
  storage: StorageInfo | null;
  busy: boolean;
  onClose: () => void;
  onExport: () => Promise<BackupExportResult | null>;
  onRestore: () => Promise<BackupRestoreResult | null>;
  onOpenFolder: () => Promise<void>;
}) {
  const [notice, setNotice] = useState<{
    kind: "success" | "cancelled" | "error";
    message: string;
    path?: string;
  } | null>(null);
  const [operation, setOperation] = useState("");
  const running = useRef(false);
  const desktop = storage?.mode === "desktop";
  async function run(kind: "export" | "restore" | "folder") {
    if (!desktop || busy || running.current) return;
    running.current = true;
    setNotice(null);
    setOperation(kind);
    try {
      if (kind === "export") {
        const result = await onExport();
        setNotice(
          result
            ? {
                kind: "success",
                message:
                  "Cópia de segurança salva e conferida. Ela inclui suas metas, histórico, experiências, objetivos e preferências.",
                path: result.path,
              }
            : {
                kind: "cancelled",
                message: "Exportação cancelada. Nenhum arquivo foi alterado.",
              },
        );
      } else if (kind === "restore") {
        const result = await onRestore();
        setNotice(
          result
            ? {
                kind: "success",
                message:
                  "Cópia restaurada. Seus dados anteriores foram preservados neste arquivo independente:",
                path: result.recoveryPath,
              }
            : {
                kind: "cancelled",
                message:
                  "Restauração cancelada. Seus dados continuam como estavam.",
              },
        );
      } else {
        await onOpenFolder();
      }
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message.replace(
                /^Error invoking remote method '[^']+': (Error: )?/,
                "",
              )
            : "Não foi possível concluir a operação. Seus dados foram preservados.",
      });
    } finally {
      setOperation("");
      running.current = false;
    }
  }
  const blocked = busy || Boolean(operation);
  return (
    <Modal
      title="Seus dados ficam com você"
      subtitle="Salvos no computador. Uma cópia para quando você precisar."
      wide
      onClose={() => {
        if (!blocked) onClose();
      }}
    >
      <div className="storage-location">
        <Database size={25} />
        <div>
          <strong>
            {desktop ? "Banco SQLite local" : "Prévia no navegador"}
          </strong>
          <p>{storage?.path}</p>
        </div>
      </div>
      <div className="storage-tools">
        <span>
          <ShieldCheck size={15} />
          {desktop
            ? `Gravação local · formato ${storage.schemaVersion ?? "atual"}`
            : "Backup SQLite disponível no aplicativo desktop"}
        </span>
        <button
          className="text-button"
          disabled={!desktop}
          aria-disabled={blocked}
          onClick={() => void run("folder")}
        >
          <FolderOpen size={16} />
          Abrir pasta dos dados
        </button>
      </div>
      <div className="backup-option-grid">
        <section className="backup-option">
          <span className="backup-option-icon">
            <ArrowDownToLine size={23} />
          </span>
          <h3>Guarde uma cópia do seu caminho</h3>
          <p>
            Exporte todos os dados para um arquivo SQLite. A gravação é
            conferida antes de substituir o destino escolhido.
          </p>
          <button
            className="button secondary"
            disabled={!desktop}
            aria-disabled={blocked}
            onClick={() => void run("export")}
          >
            <ArrowDownToLine size={17} />
            {operation === "export" ? "Exportando…" : "Exportar backup"}
          </button>
        </section>
        <section className="backup-option">
          <span className="backup-option-icon">
            <Upload size={23} />
          </span>
          <h3>Retome de uma cópia guardada</h3>
          <p>
            Substitua os dados pelo arquivo escolhido. O app valida a cópia
            antes de pedir confirmação e guarda o estado anterior.
          </p>
          <button
            className="button secondary"
            disabled={!desktop}
            aria-disabled={blocked}
            onClick={() => void run("restore")}
          >
            <Upload size={17} />
            {operation === "restore"
              ? "Conferindo a cópia…"
              : "Restaurar backup"}
          </button>
        </section>
      </div>
      {notice && (
        <div
          className={`backup-notice ${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.kind === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <CircleHelp size={20} />
          )}
          <div>
            <p>{notice.message}</p>
            {notice.path && <code>{notice.path}</code>}
          </div>
        </div>
      )}
      <p className="backup-limit">
        Arquivos de até 50 MB. A restauração substitui o conjunto de dados, sem
        mesclar históricos.
      </p>
      <details className="recovery-guide">
        <summary>
          <CircleHelp size={16} />
          Guia de recuperação
        </summary>
        <h3>Para guardar ou levar seus dados</h3>
        <p>
          Use Exportar backup e guarde o arquivo em outra pasta ou dispositivo.
          O arquivo inclui metas, versões, avaliações, descansos, experiências
          de rotinas, objetivos e temas. Guarde cópias com datas diferentes para
          poder escolher o momento que deseja recuperar.
        </p>
        <h3>Para restaurar com o app aberto</h3>
        <ol>
          <li>Escolha Restaurar backup e selecione uma cópia.</li>
          <li>
            Confira o arquivo e as quantidades na confirmação. Cancelar mantém
            seus dados atuais.
          </li>
          <li>
            Confirme somente quando quiser substituir o conjunto de dados. O
            painel informa onde a cópia anterior foi guardada.
          </li>
        </ol>
        <h3>Se o aplicativo não conseguir abrir</h3>
        <ol>
          <li>
            Localize a pasta mostrada acima ou na mensagem de erro de abertura e
            feche completamente o aplicativo.
          </li>
          <li>
            Guarde uma cópia dos arquivos existentes antes de alterar qualquer
            um.
          </li>
          <li>
            Preserve o banco atual com outro nome e copie um backup válido para
            essa pasta com o nome <code>sky.sqlite</code>. Copie o backup,
            conservando o arquivo de origem.
          </li>
          <li>
            Reabra o app. Cópias de versões anteriores são atualizadas com
            proteção; uma versão futura exige um app compatível.
          </li>
        </ol>
        <h3>O que significam as cópias automáticas</h3>
        <p>
          <code>sky.sqlite.pre-restore-…sqlite</code> conserva o estado anterior
          a uma restauração confirmada e não é sobrescrito pelas gravações
          normais. <code>sky.sqlite.bak</code> é uma cópia rotativa da gravação
          anterior. Arquivos <code>.pre-v…sqlite</code> guardam o estado antes
          de uma atualização do formato. Não use <code>.tmp</code> como backup
          garantido.
        </p>
        <p>
          As cópias automáticas ficam neste computador. Para recuperar dados
          após perda do disco, mantenha uma exportação também em outro
          dispositivo. Os arquivos contêm seus dados pessoais e devem ser
          guardados em um local de sua confiança.
        </p>
      </details>
    </Modal>
  );
}
