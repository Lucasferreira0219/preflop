import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { BookOpen, Grid3x3, HelpCircle, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/state/AppProvider";
import type { PkeRule } from "@/lib/types";

/** Modal "Ver regra" — texto canônico do Guia de Bolso, controlado por ruleId global. */
export function RuleDialog() {
  const { ruleId, closeRule } = useApp();
  const navigate = useNavigate();
  const [rule, setRule] = useState<PkeRule | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ruleId) {
      setRule(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .pkeRule(ruleId)
      .then((r) => !cancelled && setRule(r))
      .catch(() => !cancelled && setRule({ found: false, id: ruleId }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ruleId]);

  const open = ruleId != null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && closeRule()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-2xl border border-border bg-surface-1 shadow-pop outline-none data-[state=open]:animate-slide-up sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BookOpen className="h-4 w-4 text-action-blue" />
              {ruleId ?? "Regra"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-ctl text-ink-dim hover:bg-surface-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-dim">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando regra…
              </div>
            )}

            {!loading && rule && !rule.found && (
              <p className="py-6 text-center text-sm text-ink-faint">
                Regra não encontrada no Guia de Bolso.
              </p>
            )}

            {!loading && rule && rule.found && (
              <div className="flex flex-col gap-4">
                {rule.explain_pt && (
                  <p className="text-[15px] leading-relaxed text-ink">{rule.explain_pt}</p>
                )}

                {rule.source_label && (
                  <div className="text-2xs uppercase tracking-[0.1em] text-ink-faint">
                    Fonte: {rule.source_label}
                    {rule.source?.page != null && ` · p${rule.source.page}`}
                  </div>
                )}

                {rule.common_mistake && (
                  <div className="rounded-ctl border border-action-red/25 bg-action-red/5 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-action-red">
                      <HelpCircle className="h-3.5 w-3.5" /> Erro comum
                    </div>
                    <p className="text-[13px] leading-relaxed text-ink-dim">{rule.common_mistake}</p>
                  </div>
                )}

                <button
                  onClick={() => {
                    closeRule();
                    navigate("/consulta");
                  }}
                  className="flex items-center justify-center gap-2 rounded-ctl border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-dim transition-colors hover:border-border-strong hover:text-ink"
                >
                  <Grid3x3 className="h-4 w-4" /> Ver no Ranges e Regras
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
