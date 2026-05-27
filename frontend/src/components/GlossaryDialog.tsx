import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { GLOSSARY } from "@/lib/glossary";
import { useApp } from "@/state/AppProvider";

/** Glossário acessível — bottom sheet no mobile, painel central no desktop. */
export function GlossaryDialog() {
  const { glossaryOpen, setGlossaryOpen } = useApp();
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return GLOSSARY;
    return GLOSSARY.filter(
      (g) => g.term.toLowerCase().includes(t) || g.short.toLowerCase().includes(t),
    );
  }, [q]);

  return (
    <Dialog.Root open={glossaryOpen} onOpenChange={setGlossaryOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-2xl border border-border bg-surface-1 shadow-pop outline-none data-[state=open]:animate-slide-up sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-sm font-semibold text-ink">Glossário</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-ctl text-ink-dim hover:bg-surface-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 rounded-ctl border border-border bg-surface-2 px-3">
              <Search className="h-4 w-4 text-ink-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar termo…"
                className="h-9 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <dl className="space-y-3">
              {items.map((g) => (
                <div key={g.id} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <dt className="text-[13px] font-semibold text-ink">{g.term}</dt>
                  <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-dim">
                    {g.short}
                    {g.full && <span className="mt-0.5 block text-ink-faint">{g.full}</span>}
                  </dd>
                </div>
              ))}
              {items.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-faint">Nenhum termo encontrado.</p>
              )}
            </dl>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
