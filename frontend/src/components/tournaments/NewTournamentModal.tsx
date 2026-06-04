import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { parseCentsInput } from "@/lib/money";
import type { ManualTournamentInput } from "@/lib/types";
import { cn } from "@/lib/cn";

const FMT_NONE = "__none__";

/** "2026/05/31" → "2026-05-31" (formato do <input type=date>). */
function toInputDate(day?: string | null): string {
  if (day && /^\d{4}\/\d{2}\/\d{2}/.test(day)) return day.slice(0, 10).replace(/\//g, "-");
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function NewTournamentModal({
  rooms,
  formats,
  defaultCurrency,
  defaultDay,
  onCancel,
  onSave,
}: {
  rooms: string[];
  formats: string[];
  defaultCurrency: string;
  defaultDay?: string | null;
  onCancel: () => void;
  onSave: (data: ManualTournamentInput) => void;
}) {
  const [name, setName] = useState("");
  const [room, setRoom] = useState(rooms[0] ?? "PokerStars");
  const [fmt, setFmt] = useState(FMT_NONE);
  const [date, setDate] = useState(toInputDate(defaultDay));
  const [buyIn, setBuyIn] = useState("");
  const [fee, setFee] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency || "USD");
  const [entries, setEntries] = useState("");
  const [pos, setPos] = useState("");
  const [prize, setPrize] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const roomOptions = rooms.map((r) => ({ value: r, label: r }));
  const fmtOptions = [
    { value: FMT_NONE, label: "Sem rótulo" },
    ...formats.map((f) => ({ value: f, label: f })),
  ];
  const curOptions = ["USD", "BRL", "EUR"].map((c) => ({ value: c, label: c }));

  function submit() {
    const buyInCents = parseCentsInput(buyIn);
    if (buyInCents == null) {
      setErr("Informe o buy-in.");
      return;
    }
    onSave({
      tournament_name: name.trim() || null,
      room,
      format: fmt && fmt !== FMT_NONE ? fmt : null,
      played_at: date ? date.replace(/-/g, "/") : null,
      buy_in_cents: buyInCents,
      fee_cents: fee ? parseCentsInput(fee) : 0,
      currency,
      n_entries: entries ? Number.parseInt(entries, 10) || null : null,
      finish_pos: pos ? Number.parseInt(pos, 10) || null : null,
      prize_cents: prize ? parseCentsInput(prize) : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={onCancel}
    >
      <Card
        className="max-h-[92vh] w-full max-w-md overflow-y-auto p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Novo torneio</h3>
          <button
            onClick={onCancel}
            className="rounded-ctl p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-0.5 text-2xs text-ink-faint">
          Cadastro manual — complementa a importação de arquivos.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <ModalField label="Nome do torneio" colSpan="col-span-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bounty Builder $5.50"
              className="filter-input"
            />
          </ModalField>
          <ModalField label="Sala">
            <Select value={room} onValueChange={setRoom} options={roomOptions} ariaLabel="Sala" className="w-full" />
          </ModalField>
          <ModalField label="Tipo">
            <Select value={fmt} onValueChange={setFmt} options={fmtOptions} ariaLabel="Tipo" className="w-full" />
          </ModalField>
          <ModalField label="Data">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="filter-input" />
          </ModalField>
          <ModalField label="Moeda">
            <Select value={currency} onValueChange={setCurrency} options={curOptions} ariaLabel="Moeda" className="w-full" />
          </ModalField>
          <ModalField label="Buy-in">
            <input value={buyIn} onChange={(e) => setBuyIn(e.target.value)} inputMode="decimal" placeholder="5,00" className="filter-input" />
          </ModalField>
          <ModalField label="Taxa (fee)">
            <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder="0,50" className="filter-input" />
          </ModalField>
          <ModalField label="Posição final">
            <input value={pos} onChange={(e) => setPos(e.target.value)} inputMode="numeric" placeholder="—" className="filter-input" />
          </ModalField>
          <ModalField label="Participantes">
            <input value={entries} onChange={(e) => setEntries(e.target.value)} inputMode="numeric" placeholder="—" className="filter-input" />
          </ModalField>
          <ModalField label={`Prêmio (${currency})`} colSpan="col-span-2">
            <input value={prize} onChange={(e) => setPrize(e.target.value)} inputMode="decimal" placeholder="deixe vazio se não premiou" className="filter-input" />
          </ModalField>
        </div>

        {err && <div className="mt-3 text-xs text-action-red">{err}</div>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={submit}>
            Adicionar
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ModalField({
  label,
  children,
  colSpan = "",
}: {
  label: string;
  children: React.ReactNode;
  colSpan?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", colSpan)}>
      <span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
