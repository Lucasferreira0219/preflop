import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bookmark, Check, Dumbbell, Eye, MessageCircleQuestion, MoreHorizontal,
  Pencil, Pin, Star, Target, Trash2, Trophy, Archive,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useApp } from "@/state/AppProvider";
import { api } from "@/lib/api";
import {
  NOTE_SNIPPETS, NOTE_TYPE_LABEL, NOTE_TYPE_ORDER, REVIEW_STATUS_LABEL,
  AUTO_TAGS, fmtAgo, noteAskUrl, noteTrainMode,
} from "@/lib/notes";
import type { Note, NoteType, ReviewStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const REVIEW_BTNS: { value: ReviewStatus; label: string }[] = [
  { value: "reviewed", label: "Revisada" },
  { value: "needs_work", label: "Precisa treinar" },
  { value: "mastered", label: "Dominada" },
];

export function NoteEditor({ note, onChange, onClose, onArchive }: {
  note: Note;
  onChange: (n: Note) => void;     // propaga atualização (refresca a lista)
  onClose: () => void;             // voltar (mobile)
  onArchive: (id: string) => void; // arquivar/remover
}) {
  const navigate = useNavigate();
  const { openTournament, openRule } = useApp();
  const [title, setTitle] = useState(note.title);
  const [type, setType] = useState<NoteType>(note.type);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [preview, setPreview] = useState(false);
  const [savedAt, setSavedAt] = useState<number>(note.updated_at);
  const [menu, setMenu] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dirtyRef = useRef(false);

  // troca de nota selecionada → recarrega campos locais
  useEffect(() => {
    setTitle(note.title); setType(note.type); setContent(note.content);
    setTags(note.tags ?? []); setSavedAt(note.updated_at); setPreview(false);
    dirtyRef.current = false;
  }, [note.note_id]);

  // autosave (debounce) de title/type/content/tags
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => { void save(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, type, content, tags]);

  async function save() {
    const updated = await api.updateNote(note.note_id, { title, type, content, tags });
    dirtyRef.current = false;
    setSavedAt(updated.updated_at);
    onChange(updated);
  }
  const touch = () => { dirtyRef.current = true; };

  async function patch(p: Partial<Note>) {
    const updated = await api.updateNote(note.note_id, p);
    onChange(updated);
  }

  function insertSnippet(text: string) {
    const ta = taRef.current;
    const pos = ta ? ta.selectionStart : content.length;
    const next = content.slice(0, pos) + text + content.slice(pos);
    setContent(next); touch();
    requestAnimationFrame(() => { ta?.focus(); const c = pos + text.length; ta?.setSelectionRange(c, c); });
  }

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags([...tags, t]); touch(); }
    setTagInput("");
  }
  function removeTag(t: string) { setTags(tags.filter((x) => x !== t)); touch(); }

  function toggleCheck(idx: number) {
    let i = -1;
    const next = content.replace(/- \[( |x|X)\]/g, (m, g) => {
      i++;
      if (i !== idx) return m;
      return g.trim() ? "- [ ]" : "- [x]";
    });
    setContent(next); touch();
  }

  const trainMode = noteTrainMode(note);
  const suggestions = AUTO_TAGS.filter((t) => !tags.includes(t)
    && (!tagInput || t.includes(tagInput.toLowerCase()))).slice(0, 6);

  return (
    <div className="flex h-full flex-col">
      {/* topo: voltar (mobile) + flags + menu */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-2">
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-ctl text-ink-dim hover:bg-surface-2 lg:hidden" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-2xs text-ink-faint">
          {savedAt ? `Salvo ${fmtAgo(savedAt)}` : "Não salvo"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <FlagBtn active={note.pinned} title="Fixar" onClick={() => patch({ pinned: !note.pinned })}><Pin className="h-4 w-4" /></FlagBtn>
          <FlagBtn active={note.favorite} title="Favoritar" onClick={() => patch({ favorite: !note.favorite })}><Star className="h-4 w-4" /></FlagBtn>
          <Button size="sm" variant="ghost" onClick={() => { void save(); }}>
            <Check className="h-4 w-4" /> Salvar
          </Button>
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} className="grid h-9 w-9 place-items-center rounded-ctl text-ink-dim hover:bg-surface-2" aria-label="Mais ações">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menu && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[170px] overflow-hidden rounded-ctl border border-border bg-surface-2 py-1 shadow-pop">
                <MenuItem onClick={() => { setMenu(false); onArchive(note.note_id); }}><Archive className="h-3.5 w-3.5" /> Arquivar</MenuItem>
                <MenuItem danger onClick={async () => { setMenu(false); if (confirm("Apagar definitivamente esta anotação?")) { await api.deleteNote(note.note_id, true); onArchive(note.note_id); } }}>
                  <Trash2 className="h-3.5 w-3.5" /> Apagar de vez
                </MenuItem>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {/* título + tipo */}
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); touch(); }}
          placeholder="Título da anotação"
          className="w-full bg-transparent text-lg font-semibold text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            value={type}
            onValueChange={(v) => { setType(v as NoteType); touch(); }}
            options={NOTE_TYPE_ORDER.map((t) => ({ value: t, label: NOTE_TYPE_LABEL[t] }))}
            ariaLabel="Tipo da anotação"
            className="w-48"
          />
          <button onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1 rounded-ctl border border-border px-2 py-1.5 text-2xs text-ink-dim hover:text-ink">
            {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {preview ? "Editar" : "Visualizar"}
          </button>
        </div>

        {/* links/contexto da nota */}
        {(note.tournament_id || note.pke_rule_id || trainMode || note.hand_id) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tournament_id && (
              <LinkBtn onClick={() => openTournament(note.tournament_id!)}><Trophy className="h-3.5 w-3.5" /> Abrir torneio</LinkBtn>
            )}
            {note.pke_rule_id && (
              <LinkBtn onClick={() => openRule(note.pke_rule_id!)}><Bookmark className="h-3.5 w-3.5" /> Ver regra</LinkBtn>
            )}
            {trainMode && (
              <LinkBtn onClick={() => navigate(`/treinar?mode=${trainMode}&from=leak`)}><Dumbbell className="h-3.5 w-3.5" /> Treinar este spot</LinkBtn>
            )}
            <LinkBtn onClick={() => navigate(noteAskUrl(note))}><MessageCircleQuestion className="h-3.5 w-3.5" /> Perguntar ao PKE</LinkBtn>
          </div>
        )}

        {/* toolbar de snippets */}
        {!preview && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {NOTE_SNIPPETS.map((s) => (
              <button key={s.label} onClick={() => insertSnippet(s.insert)}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-2xs text-ink-dim hover:border-border-strong hover:text-ink">
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* conteúdo: edição ou preview */}
        {preview ? (
          <MarkdownPreview content={content} onToggleCheck={toggleCheck} />
        ) : (
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); touch(); }}
            placeholder="Escreva sua anotação… (markdown: ## título, - bullet, - [ ] checklist)"
            className="mt-3 min-h-[320px] w-full resize-y rounded-ctl border border-border bg-surface-2 p-3 text-sm leading-relaxed text-ink outline-none focus:border-border-strong"
          />
        )}

        {/* tags */}
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-2xs text-gold">
                {t}
                <button onClick={() => removeTag(t)} className="text-gold/70 hover:text-gold">×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
              placeholder="+ tag"
              className="w-24 bg-transparent text-2xs text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {suggestions.map((t) => (
                <button key={t} onClick={() => addTag(t)} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-ink-faint hover:text-ink">
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* review status */}
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1.5 text-2xs uppercase tracking-[0.1em] text-ink-faint">
            Revisão · {REVIEW_STATUS_LABEL[note.review_status]}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REVIEW_BTNS.map((b) => (
              <button key={b.value} onClick={() => patch({ review_status: note.review_status === b.value ? "not_reviewed" : b.value })}
                className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
                  note.review_status === b.value ? "border-gold/50 bg-gold/15 text-gold" : "border-border bg-surface-2 text-ink-dim hover:text-ink")}>
                <Target className="h-3 w-3" /> {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlagBtn({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className={cn("grid h-9 w-9 place-items-center rounded-ctl hover:bg-surface-2", active ? "text-gold" : "text-ink-faint")}>
      {children}
    </button>
  );
}
function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-ctl border border-border bg-surface-1 px-2.5 py-1 text-2xs text-ink-dim hover:border-border-strong hover:text-ink">
      {children}
    </button>
  );
}
function MenuItem({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-3", danger ? "text-action-red" : "text-ink-dim")}>
      {children}
    </button>
  );
}

// Render leve de markdown: ## título, **bold**, - [ ] checklist (clicável), - bullet.
function MarkdownPreview({ content, onToggleCheck }: { content: string; onToggleCheck: (i: number) => void }) {
  const lines = content.split("\n");
  let checkIdx = -1;
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="text-ink">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>);
  return (
    <div className="mt-3 min-h-[320px] rounded-ctl border border-border bg-surface-2 p-3 text-sm leading-relaxed text-ink-dim">
      {lines.map((ln, i) => {
        if (ln.startsWith("## ")) return <h3 key={i} className="mt-3 text-xs font-semibold uppercase tracking-wide text-gold first:mt-0">{ln.slice(3)}</h3>;
        const chk = ln.match(/^- \[( |x|X)\] (.*)$/);
        if (chk) {
          const idx = ++checkIdx;
          const done = chk[1].trim() !== "";
          return (
            <label key={i} className="flex cursor-pointer items-start gap-2 py-0.5">
              <input type="checkbox" checked={done} onChange={() => onToggleCheck(idx)} className="mt-0.5 accent-gold" />
              <span className={done ? "text-ink-faint line-through" : ""}>{bold(chk[2])}</span>
            </label>
          );
        }
        if (ln.startsWith("- ")) return <div key={i} className="flex gap-2 py-0.5"><span className="text-ink-faint">•</span><span>{bold(ln.slice(2))}</span></div>;
        if (ln.trim() === "") return <div key={i} className="h-2" />;
        return <p key={i} className="py-0.5">{bold(ln)}</p>;
      })}
    </div>
  );
}
