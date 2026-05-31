import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useApp } from "@/state/AppProvider";
import type { ImportTournamentFilesResult, Tournament } from "@/lib/types";
import { cn } from "@/lib/cn";

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

export function TournamentImport({ onImported, className }: { onImported?: () => void; className?: string }) {
  const { openTournament } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportTournamentFilesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const texts = await Promise.all(Array.from(files).map(readAsText));
      const res = await api.importTournamentFiles(texts.join("\n\n"));
      if ("error" in res && res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
        onImported?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className={cn("mb-4 p-4", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        disabled={loading}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-gold/60 bg-gold/10" : "border-border bg-surface-1 hover:border-border-strong hover:bg-surface-2",
          loading && "cursor-wait opacity-60",
        )}
      >
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface-2 text-ink-dim">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </span>
        <span className="text-sm font-semibold text-ink">
          {loading ? "Importando e analisando com o PKEâ€¦" : "Importar do PokerStars"}
        </span>
        <span className="text-2xs text-ink-faint">
          Solte os arquivos .txt (torneios ou mÃ£os) aqui ou clique â€” o PKE analisa automaticamente
        </span>
      </button>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-action-red">
          <X className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {result && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-action-green">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {result.tournaments.length} {result.tournaments.length === 1 ? "torneio importado" : "torneios importados"}
          </div>
          {result.tournaments.map((t) => (
            <ImportedTournamentRow key={t.tournament_id} t={t} onOpen={() => openTournament(t.tournament_id)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ImportedTournamentRow({ t, onOpen }: { t: Tournament; onOpen: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-ctl border border-border bg-surface-1 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">
          {t.tournament_name || `Torneio #${t.tournament_id}`}
        </div>
      </div>
      <button
        onClick={onOpen}
        className="shrink-0 rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-2xs font-semibold text-gold hover:bg-gold/25"
      >
        Abrir review
      </button>
    </div>
  );
}
