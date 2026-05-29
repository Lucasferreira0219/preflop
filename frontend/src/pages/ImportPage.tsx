import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  FileText,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { SourceBadge } from "@/components/SourceBadge";
import { api } from "@/lib/api";
import { ACTION_NAME, POS_LABEL, SCENARIO_SHORT } from "@/lib/poker";
import type { ImportSummary, ImportedHand } from "@/lib/types";
import { cn } from "@/lib/cn";

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

export function ImportPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const texts = await Promise.all(Array.from(files).map(readAsText));
      const res = await api.importHands(texts.join("\n\n"));
      if ("error" in res && res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler/importar o arquivo.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Importar mãos"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
              Início
            </Button>
          }
        />
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        {/* Ajuda pro iniciante */}
        <Card className="mb-5 flex gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-action-blue" />
          <div className="text-[13px] leading-relaxed text-ink-dim">
            Exporte o histórico de mãos do PokerStars (Configurações → Histórico de Mãos →
            <em> Salvar meu histórico</em>) e solte o arquivo <code className="text-ink">.txt</code> aqui.
            O app compara cada mão com o curso e guarda tudo. Spots de
            <span className="text-ink"> limp / pote multiway</span> são salvos, mas ficam sem nota
            (fora do modelo do curso). Reenviar o mesmo arquivo não duplica nada.
          </div>
        </Card>

        {/* Dropzone */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          disabled={loading}
          className={cn(
            "flex w-full flex-col items-center gap-3 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging
              ? "border-gold/60 bg-gold/10"
              : "border-border bg-surface-1 hover:border-border-strong hover:bg-surface-2",
            loading && "cursor-wait opacity-60",
          )}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-surface-2 text-ink-dim">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </span>
          <span className="text-sm font-semibold text-ink">
            {loading ? "Processando…" : "Arraste o .txt aqui ou clique para escolher"}
          </span>
          <span className="text-xs text-ink-faint">Pode enviar vários arquivos de uma vez</span>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </button>

        {error && (
          <Card className="mt-4 flex items-center gap-2 border-action-red/30 p-3 text-sm text-action-red">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </Card>
        )}

        {result && <ResultBlock result={result} />}
      </div>
    </div>
  );
}

function ResultBlock({ result }: { result: ImportSummary }) {
  return (
    <div className="mt-6">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Tile label="Novas" value={result.new} accent="ink" />
        <Tile label="Duplicadas" value={result.duplicates} accent="faint" />
        <Tile label="Acertos" value={result.correct} accent="green" />
        <Tile label="Erros" value={result.wrong} accent="red" />
        <Tile label="Sem nota" value={result.not_modeled} accent="faint" />
      </div>

      {result.new === 0 ? (
        <p className="mt-5 text-center text-sm text-ink-dim">
          Nenhuma mão nova — tudo isso já estava no banco. 👍
        </p>
      ) : (
        <>
          <SectionLabel className="mb-2 mt-6">Mãos novas</SectionLabel>
          <div className="flex flex-col gap-2">
            {result.hands.map((h) => (
              <HandRow key={h.hand_id} hand={h} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "ink" | "green" | "red" | "faint";
}) {
  const color = {
    ink: "text-ink",
    green: "text-action-green",
    red: "text-action-red",
    faint: "text-ink-faint",
  }[accent];
  return (
    <Card className="flex flex-col items-center gap-0.5 p-3">
      <span className={cn("text-xl font-bold tabular-nums", color)}>{value}</span>
      <span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">{label}</span>
    </Card>
  );
}

function HandRow({ hand }: { hand: ImportedHand }) {
  const graded = hand.is_correct !== null;
  const correct = hand.is_correct === 1;

  return (
    <Card
      className={cn(
        "flex items-center gap-3 p-3",
        graded && (correct ? "border-action-green/25" : "border-action-red/25"),
      )}
    >
      {/* Posição + mão */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-ctl border border-border bg-surface-2 px-2 py-1 text-2xs font-semibold text-ink-dim">
          {hand.hero_pos ? POS_LABEL[hand.hero_pos] ?? hand.hero_pos : "?"}
        </span>
        <span className="font-mono text-sm font-bold text-ink">{hand.hero_cards ?? "—"}</span>
      </div>

      {/* Contexto */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-2xs text-ink-faint">
          {hand.stack_bb != null && <span>{hand.stack_bb}bb</span>}
          {hand.scenario in SCENARIO_SHORT && (
            <>
              <span>·</span>
              <span>{SCENARIO_SHORT[hand.scenario]}</span>
            </>
          )}
          {hand.source && <SourceBadge source={hand.source} className="ml-1 px-2 py-0.5" />}
        </div>
        {graded ? (
          correct ? (
            <span className="text-[13px] text-action-green">
              Correto — você fez {ACTION_NAME[hand.hero_action ?? ""] ?? hand.hero_action}
            </span>
          ) : (
            <span className="text-[13px] text-ink">
              Você: <span className="text-action-red">{ACTION_NAME[hand.hero_action ?? ""] ?? hand.hero_action}</span>
              {" · "}Curso:{" "}
              <span className="font-semibold text-action-green">
                {ACTION_NAME[hand.course_action ?? ""] ?? hand.course_action}
              </span>
            </span>
          )
        ) : (
          <span className="text-[13px] text-ink-dim">
            <FileText className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
            {hand.motivo || "Fora do modelo do curso — salvo sem nota"}
          </span>
        )}
      </div>

      {/* Ícone de veredito */}
      {graded && (
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full",
            correct ? "bg-action-green/15 text-action-green" : "bg-action-red/15 text-action-red",
          )}
        >
          {correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </span>
      )}
    </Card>
  );
}
