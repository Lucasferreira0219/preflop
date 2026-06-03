import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BookOpen, Filter, Pin, Plus, Search, Star, X,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { MenuButton } from "@/components/layout/MenuButton";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { api } from "@/lib/api";
import {
  NOTE_TYPE_LABEL, NOTE_TYPE_ORDER, REVIEW_STATUS_CLS, REVIEW_STATUS_LABEL, fmtAgo,
} from "@/lib/notes";
import type { Note, NoteFilters, NoteType, NotesStats, ReviewStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const SORTS = [
  { value: "recent", label: "Editadas recentes" },
  { value: "recent_created", label: "Criadas recentes" },
  { value: "oldest", label: "Mais antigas" },
  { value: "favorite", label: "Favoritas primeiro" },
  { value: "type", label: "Por tipo" },
  { value: "tournament", label: "Por torneio" },
];

export function NotesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [stats, setStats] = useState<NotesStats | null>(null);
  const [filters, setFilters] = useState<NoteFilters>({});
  const [sort, setSort] = useState("recent");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Note | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: NoteFilters, s: string, query: string) => {
    const [list, st] = await Promise.all([
      api.listNotes({ ...f, sort: s, q: query || undefined }),
      api.notesStats(),
    ]);
    setNotes(list);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { void load(filters, sort, q); }, [filters, sort, load]);
  // busca com debounce
  useEffect(() => {
    const t = setTimeout(() => { void load(filters, sort, q); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // deep-link ?open=<id>
  useEffect(() => {
    const open = params.get("open");
    if (open && (!selected || selected.note_id !== open)) {
      api.getNote(open).then((n) => { if (n && !("error" in n)) setSelected(n as Note); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function selectNote(id: string) {
    const n = await api.getNote(id);
    if (n && !("error" in n)) setSelected(n as Note);
  }
  async function newNote(type: NoteType = "free") {
    const n = await api.createNote({ type, title: "", content: "" });
    setSelected(n);
    setNotes((prev) => [n, ...prev]);
  }
  function onEditorChange(n: Note) {
    setSelected(n);
    setNotes((prev) => prev.map((x) => (x.note_id === n.note_id ? n : x)));
  }
  async function archive(id: string) {
    await api.deleteNote(id);
    setSelected(null);
    setParams({});
    void load(filters, sort, q);
  }

  const activeCount = useMemo(() => countFilters(filters), [filters]);
  const isEmpty = !loading && notes.length === 0 && activeCount === 0 && !q;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Anotações"
          actions={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(true)}>
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filtros</span>
                {activeCount > 0 && <span className="ml-0.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold">{activeCount}</span>}
              </Button>
              <Button variant="primary" size="sm" onClick={() => newNote()}>
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">Nova</span>
              </Button>
              <MenuButton className="h-8 w-8" />
            </div>
          }
        />
      </header>

      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6">
        {/* stats + cards rápidos — escondidos no mobile quando um detalhe está aberto */}
        <div className={cn(selected && "hidden lg:block")}>
          {stats && <StatsHeader stats={stats} onPick={(f) => { setSelected(null); setParams({}); setFilters(f); }} />}
          {stats && stats.pending_review > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-card border border-gold/30 bg-gold/5 p-3 text-xs text-ink-dim">
              <AlertTriangle className="h-4 w-4 text-gold" />
              Você tem {stats.pending_review} {stats.pending_review === 1 ? "mão salva" : "mãos salvas"} para revisar.
              <button className="ml-auto font-semibold text-gold" onClick={() => setFilters({ source: "exported_from_hand", review_status: "not_reviewed" })}>Revisar</button>
            </div>
          )}
        </div>

        {isEmpty ? (
          <EmptyState onNew={() => newNote()} onCritical={() => navigate("/erros-criticos")} />
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
            {/* LISTA (some no mobile quando há detalhe aberto) */}
            <div className={cn("flex flex-col gap-2", selected && "hidden lg:flex")}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar anotações…"
                  className="h-9 w-full rounded-ctl border border-border bg-surface-2 pl-8 pr-8 text-sm text-ink outline-none focus:border-border-strong" />
                {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"><X className="h-4 w-4" /></button>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xs text-ink-faint">{notes.length} {notes.length === 1 ? "anotação" : "anotações"}</span>
                <Select value={sort} onValueChange={setSort} options={SORTS} ariaLabel="Ordenar" className="w-44" />
              </div>
              <ActiveChips filters={filters} onChange={setFilters} />
              {notes.length === 0 ? (
                <Card className="p-6 text-center text-xs text-ink-faint">Nenhuma anotação com esses filtros.</Card>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {notes.map((n) => (
                    <NoteRow key={n.note_id} n={n} active={selected?.note_id === n.note_id} onClick={() => selectNote(n.note_id)} />
                  ))}
                </div>
              )}
            </div>

            {/* EDITOR / DETALHE */}
            <div className={cn("min-h-[60vh] rounded-card border border-border bg-surface-1", !selected && "hidden lg:block")}>
              {selected ? (
                <NoteEditor key={selected.note_id} note={selected} onChange={onEditorChange}
                  onClose={() => { setSelected(null); setParams({}); }} onArchive={archive} />
              ) : (
                <div className="grid h-full place-items-center p-8 text-center text-sm text-ink-faint">
                  Selecione uma anotação ou crie uma nova.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FAB nova (mobile) */}
      {!selected && (
        <button onClick={() => newNote()} aria-label="Nova anotação"
          className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-gold text-bg shadow-pop lg:hidden">
          <Plus className="h-6 w-6" />
        </button>
      )}

      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen} title="Filtros">
        <FiltersPanel filters={filters} onApply={(f) => { setFilters(f); setFiltersOpen(false); }} />
      </Drawer>
    </div>
  );
}

// ── Stats + cards rápidos ─────────────────────────────────────────────────────
function StatsHeader({ stats, onPick }: { stats: NotesStats; onPick: (f: NoteFilters) => void }) {
  const tiles = [
    { label: "Anotações", value: stats.total, f: {} as NoteFilters },
    { label: "Fixadas", value: stats.pinned, f: { pinned: true } },
    { label: "Mãos salvas", value: stats.hands_saved, f: { source: "exported_from_hand" } as NoteFilters },
    { label: "Leaks", value: stats.leaks_noted, f: { type: "leak" } as NoteFilters },
    { label: "Revisar", value: stats.pending_review, f: { review_status: "not_reviewed" } as NoteFilters },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map((t) => (
        <button key={t.label} onClick={() => onPick(t.f)} className="rounded-card border border-border bg-surface-1 p-2.5 text-left hover:border-border-strong">
          <div className="text-lg font-bold nums text-ink">{t.value}</div>
          <div className="text-2xs uppercase tracking-[0.1em] text-ink-faint">{t.label}</div>
        </button>
      ))}
    </div>
  );
}

function NoteRow({ n, active, onClick }: { n: Note; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-card border bg-surface-1 p-3 text-left transition-colors", active ? "border-gold/50 bg-gold/5" : "border-border hover:border-border-strong")}>
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-sm font-semibold text-ink">{n.title || "Sem título"}</span>
        <div className="flex shrink-0 items-center gap-1 text-ink-faint">
          {n.pinned && <Pin className="h-3.5 w-3.5 text-gold" />}
          {n.favorite && <Star className="h-3.5 w-3.5 text-gold" />}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-ink-faint">
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5">{NOTE_TYPE_LABEL[n.type]}</span>
        {n.review_status !== "not_reviewed" && (
          <span className={cn("rounded-full px-1.5 py-0.5", REVIEW_STATUS_CLS[n.review_status])}>{REVIEW_STATUS_LABEL[n.review_status]}</span>
        )}
        {n.tags.slice(0, 2).map((t) => <span key={t} className="text-gold">#{t}</span>)}
        <span className="ml-auto">{fmtAgo(n.updated_at)}</span>
      </div>
    </button>
  );
}

function EmptyState({ onNew, onCritical }: { onNew: () => void; onCritical: () => void }) {
  return (
    <Card className="mt-6 flex flex-col items-center gap-4 p-8 text-center sm:p-12">
      <span className="grid h-12 w-12 place-items-center rounded-full border border-border bg-surface-2 text-gold"><BookOpen className="h-6 w-6" /></span>
      <p className="max-w-sm text-sm text-ink-dim">
        Seu caderno está vazio. Salve mãos importantes, leaks e ideias de estudo aqui.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="primary" size="sm" onClick={onNew}><Plus className="h-4 w-4" /> Nova anotação</Button>
        <Button variant="ghost" size="sm" onClick={onCritical}><AlertTriangle className="h-4 w-4" /> Ver mãos críticas</Button>
      </div>
    </Card>
  );
}

// ── filtros ────────────────────────────────────────────────────────────────────
function countFilters(f: NoteFilters): number {
  return [f.type, f.tag, f.review_status, f.source, f.spot, f.phase, f.leak_key,
    f.pke_rule_id, f.favorite, f.pinned, f.archived].filter(Boolean).length;
}

function ActiveChips({ filters, onChange }: { filters: NoteFilters; onChange: (f: NoteFilters) => void }) {
  const set = (p: Partial<NoteFilters>) => onChange({ ...filters, ...p });
  const chips: { k: string; label: string; clear: () => void }[] = [];
  if (filters.type) chips.push({ k: "type", label: NOTE_TYPE_LABEL[filters.type], clear: () => set({ type: null }) });
  if (filters.review_status) chips.push({ k: "rs", label: REVIEW_STATUS_LABEL[filters.review_status], clear: () => set({ review_status: null }) });
  if (filters.source === "exported_from_hand") chips.push({ k: "src", label: "Mãos salvas", clear: () => set({ source: null }) });
  if (filters.tag) chips.push({ k: "tag", label: `#${filters.tag}`, clear: () => set({ tag: null }) });
  if (filters.spot) chips.push({ k: "spot", label: filters.spot, clear: () => set({ spot: null }) });
  if (filters.favorite) chips.push({ k: "fav", label: "Favoritas", clear: () => set({ favorite: false }) });
  if (filters.pinned) chips.push({ k: "pin", label: "Fixadas", clear: () => set({ pinned: false }) });
  if (filters.archived) chips.push({ k: "arc", label: "Arquivadas", clear: () => set({ archived: false }) });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button key={c.k} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-2xs font-semibold text-gold hover:bg-gold/15">
          {c.label}<X className="h-3 w-3" />
        </button>
      ))}
      <button onClick={() => onChange({})} className="text-2xs text-ink-faint hover:text-ink hover:underline">Limpar</button>
    </div>
  );
}

const TYPE_ALL = "__all__";
const RS_ALL = "__all__";
function FiltersPanel({ filters, onApply }: { filters: NoteFilters; onApply: (f: NoteFilters) => void }) {
  const [f, setF] = useState<NoteFilters>(filters);
  useEffect(() => setF(filters), [filters]);
  const set = (p: Partial<NoteFilters>) => setF((v) => ({ ...v, ...p }));
  return (
    <div className="flex flex-col gap-3">
      <Field label="Tipo">
        <Select value={f.type ?? TYPE_ALL} onValueChange={(v) => set({ type: v === TYPE_ALL ? null : (v as NoteType) })}
          options={[{ value: TYPE_ALL, label: "Todos" }, ...NOTE_TYPE_ORDER.map((t) => ({ value: t, label: NOTE_TYPE_LABEL[t] }))]}
          ariaLabel="Tipo" className="w-full" />
      </Field>
      <Field label="Revisão">
        <Select value={f.review_status ?? RS_ALL} onValueChange={(v) => set({ review_status: v === RS_ALL ? null : (v as ReviewStatus) })}
          options={[{ value: RS_ALL, label: "Todas" }, ...(["not_reviewed", "reviewed", "needs_work", "mastered"] as ReviewStatus[]).map((r) => ({ value: r, label: REVIEW_STATUS_LABEL[r] }))]}
          ariaLabel="Revisão" className="w-full" />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        <Toggle on={!!f.favorite} onClick={() => set({ favorite: !f.favorite })}>Favoritas</Toggle>
        <Toggle on={!!f.pinned} onClick={() => set({ pinned: !f.pinned })}>Fixadas</Toggle>
        <Toggle on={!!f.archived} onClick={() => set({ archived: !f.archived })}>Arquivadas</Toggle>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="primary" className="flex-1" onClick={() => onApply(f)}>Aplicar</Button>
        <Button size="sm" variant="ghost" onClick={() => onApply({})}>Limpar</Button>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </label>
  );
}
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("rounded-full border px-3 py-1 text-2xs font-semibold", on ? "border-gold/50 bg-gold/15 text-gold" : "border-border bg-surface-2 text-ink-dim hover:text-ink")}>
      {children}
    </button>
  );
}
