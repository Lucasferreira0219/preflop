import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Database, Loader2, RefreshCw, Settings, Wrench, X,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { MenuButton } from "@/components/layout/MenuButton";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { api } from "@/lib/api";
import type { PkeStatus, ReprocessResult } from "@/lib/types";
import { cn } from "@/lib/cn";

type Scope = "all" | "with_hands" | "last" | "not_analyzed" | "recalc";

const ACTIONS: { scope: Scope; label: string; desc: string }[] = [
  { scope: "all", label: "Reprocessar todos os torneios", desc: "Roda o PKE atual em todos os torneios com hand history." },
  { scope: "with_hands", label: "Reprocessar torneios com hand history", desc: "Só os que têm mãos salvas (puláveis sem hand history)." },
  { scope: "last", label: "Reprocessar último torneio analisado", desc: "Recalcula só o torneio mais recente." },
  { scope: "not_analyzed", label: "Reprocessar não analisados", desc: "Só os que ainda não têm análise PKE." },
  { scope: "recalc", label: "Recalcular sessões e KPIs", desc: "Atualiza agregados por dia/sessão." },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PkeStatus | null>(null);
  const [confirm, setConfirm] = useState<Scope | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReprocessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try { setStatus(await api.getPkeStatus()); } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar status.");
    }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function run(scope: Scope) {
    setConfirm(null);
    setRunning(true);
    setError(null);
    try {
      if (scope === "recalc") {
        const r = await api.recalculateSessions();
        setResult({ scope: "recalc", processed: 0, updated: 0, skipped: 0, failed: 0,
          errors: [], started_at: "", finished_at: new Date().toISOString(), elapsed_s: 0,
          sessions: r });
      } else {
        setResult(await api.reprocessPke(scope, true));
      }
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no reprocessamento.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Configurações"
          actions={<MenuButton className="h-8 w-8" />}
        />
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {error && (
          <Card className="mb-4 flex items-center gap-2 border-action-red/30 p-3 text-sm text-action-red">
            <X className="h-4 w-4 shrink-0" /> {error}
          </Card>
        )}

        {/* Card 1 — Manutenção PKE */}
        <Card className="p-4">
          <SectionLabel className="mb-1.5 flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Manutenção PKE
          </SectionLabel>
          <p className="text-[13px] leading-relaxed text-ink-dim">
            Use esta área para reprocessar torneios quando regras, ranges, parser ou cálculo da
            Nota PKE forem atualizados. Usa as mãos já salvas — não reimporta nem apaga nada.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ACTIONS.map((a) => (
              <button
                key={a.scope}
                onClick={() => (a.scope === "recalc" ? run("recalc") : setConfirm(a.scope))}
                disabled={running}
                className={cn(
                  "rounded-card border border-border bg-surface-1 p-3 text-left transition-colors",
                  "hover:border-border-strong hover:bg-surface-2 disabled:opacity-50",
                )}
              >
                <div className="text-sm font-semibold text-ink">{a.label}</div>
                <div className="mt-0.5 text-2xs text-ink-faint">{a.desc}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-ctl bg-surface-2/50 px-2.5 py-2 text-2xs text-ink-faint">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
            Reprocessar recalcula análise/nota/leaks/sessões. Não apaga hand histories, não altera
            resultado financeiro e não duplica torneios.
          </p>
        </Card>

        {/* Card 2 — Status do PKE */}
        <Card className="mt-4 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Status do PKE
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Versão PKE" value={status?.pke_version ?? "—"} />
            <Stat label="Versão regras" value={status?.rules_version ?? "—"} />
            <Stat label="Versão ranges" value={status?.ranges_version ?? "—"} />
            <Stat label="Último reprocesso" value={fmtWhen(status?.last_reprocess_at)} />
          </div>
        </Card>

        {/* Card 3 — Banco de torneios */}
        <Card className="mt-4 p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" /> Banco de torneios
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Total" value={status?.tournaments_total ?? "—"} />
            <Stat label="Com hand history" value={status?.with_hand_history ?? "—"} />
            <Stat label="Sem hand history" value={status?.without_hand_history ?? "—"} />
            <Stat label="Analisados" value={status?.pke_analyzed ?? "—"} tone="green" />
            <Stat label="Não analisados" value={status?.pke_not_analyzed ?? "—"} />
            <Stat label="Análises antigas" value={status?.pke_outdated ?? "—"}
                  tone={(status?.pke_outdated ?? 0) > 0 ? "red" : "ink"} />
          </div>
          {(status?.pke_outdated ?? 0) > 0 && (
            <p className="mt-3 text-2xs text-gold">
              Há {status?.pke_outdated} torneio(s) com análise de versão antiga. Use
              "Reprocessar todos os torneios" para atualizar.
            </p>
          )}
        </Card>

        {/* Card 4 — Último resultado */}
        {(running || result) && (
          <Card className="mt-4 p-4">
            <SectionLabel className="mb-2">Último resultado</SectionLabel>
            {running ? (
              <div className="flex items-center gap-2 text-sm text-ink-dim">
                <Loader2 className="h-4 w-4 animate-spin" /> Reprocessando…
              </div>
            ) : result && (
              <ResultBlock result={result} />
            )}
          </Card>
        )}
      </div>

      {/* Modal de confirmação */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
             onClick={() => setConfirm(null)}>
          <Card className="w-full max-w-md p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-ink">Confirmar reprocessamento</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
              Isso vai recalcular as análises PKE usando as regras atuais. As notas antigas podem
              mudar. Os hand histories não serão apagados. Deseja continuar?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={() => run(confirm)}>
                Confirmar reprocessamento
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ResultBlock({ result }: { result: ReprocessResult }) {
  return (
    <div className="text-xs">
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Processados" value={result.processed} />
        <Stat label="Atualizados" value={result.updated} tone="green" />
        <Stat label="Ignorados" value={result.skipped} />
        <Stat label="Falhas" value={result.failed} tone={result.failed > 0 ? "red" : "ink"} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-2xs text-ink-faint">
        <CheckCircle2 className="h-3.5 w-3.5 text-action-green" />
        Concluído em {result.elapsed_s}s · {fmtWhen(result.finished_at)}
        {result.sessions && <span>· sessões: {result.sessions.recalculated ? `${result.sessions.days} dias` : "falhou"}</span>}
      </div>
      {result.errors.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-action-red">
            Falhas ({result.errors.length})
          </div>
          <div className="flex flex-col gap-1">
            {result.errors.map((e) => (
              <div key={e.tournament_id} className="rounded-ctl border border-action-red/20 bg-surface-1 p-2">
                <div className="font-mono text-2xs text-ink">#{e.tournament_id}</div>
                <div className="text-2xs text-ink-dim">{e.motivo}</div>
                <div className="text-2xs text-ink-faint">→ {e.acao_sugerida}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "ink" }: { label: string; value: number | string; tone?: "ink" | "green" | "red" }) {
  const c = { ink: "text-ink", green: "text-action-green", red: "text-action-red" }[tone];
  return (
    <div className="rounded-ctl bg-surface-2/50 px-2.5 py-2">
      <div className={cn("text-base font-bold tabular-nums", c)}>{value}</div>
      <div className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</div>
    </div>
  );
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : iso;
}
