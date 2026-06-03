import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Save,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { MenuButton } from "@/components/layout/MenuButton";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { fmtMoney, parseCentsInput } from "@/lib/money";
import type { TournamentType } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Tela de "Estruturas" — agrupa torneios iguais (mesmo nome+buy-in+fee) e
 * permite cadastrar UM payout que se aplica a todos. Edição manual num
 * torneio individual continua valendo (sobrescreve o auto).
 */
export function TournamentTypesPage() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<TournamentType[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const list = await api.listTournamentTypes();
      setTypes(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar tipos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = useMemo(
    () => types.find((t) => t.type_key === selectedKey) ?? null,
    [types, selectedKey],
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title={selected ? selected.format ?? "Estrutura" : "Estruturas"}
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (selected ? setSelectedKey(null) : navigate("/tournaments"))}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <MenuButton className="h-8 w-8" />
            </div>
          }
        />
      </header>

      <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6 sm:py-6">
        {error && (
          <Card className="mb-3 flex items-center gap-2 border-action-red/30 p-3 text-sm text-action-red">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </Card>
        )}

        {loading ? (
          <Card className="p-6 text-center text-sm text-ink-faint">Carregando…</Card>
        ) : selected ? (
          <PayoutEditor
            type={selected}
            onSaved={async () => {
              await refresh();
              setSelectedKey(null);
            }}
            onDeleted={async () => {
              await refresh();
              setSelectedKey(null);
            }}
            onCancel={() => setSelectedKey(null)}
          />
        ) : types.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-dim">
            Nenhum torneio importado ainda. Volte e importe os .txt do PokerStars.
          </Card>
        ) : (
          <TypesList types={types} onSelect={setSelectedKey} />
        )}
      </div>
    </div>
  );
}

// ── Lista de tipos ───────────────────────────────────────────────────────────

function TypesList({
  types,
  onSelect,
}: {
  types: TournamentType[];
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel className="mb-1">
        {types.length} {types.length === 1 ? "tipo detectado" : "tipos detectados"}
      </SectionLabel>
      {types.map((t) => (
        <TypeRow key={t.type_key} t={t} onClick={() => onSelect(t.type_key)} />
      ))}
    </div>
  );
}

function TypeRow({ t, onClick }: { t: TournamentType; onClick: () => void }) {
  const cost = (t.buy_in_cents ?? 0) + (t.fee_cents ?? 0);
  const pendingFinishes = t.finish_positions.reduce((acc, p) => acc + p.n, 0);
  const hasPayout = t.has_payout_table;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-card border border-border bg-surface-1 p-3 text-left transition-colors",
        "hover:border-border-strong hover:bg-surface-2 active:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border",
          hasPayout
            ? "border-action-green/30 bg-action-green/10 text-action-green"
            : "border-gold/30 bg-gold/10 text-gold",
        )}
      >
        <Trophy className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink truncate">
            {t.format ?? "Sem rótulo"}
          </span>
          <span className="text-xs nums text-ink-dim shrink-0">{fmtMoney(cost, t.currency)}</span>
        </div>
        <div className="truncate text-2xs text-ink-faint" title={t.name}>
          {t.name}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-2xs">
          <Tag>
            {t.n_tournaments} {t.n_tournaments === 1 ? "torneio" : "torneios"}
          </Tag>
          {pendingFinishes > 0 && (
            <Tag>
              {pendingFinishes} {pendingFinishes === 1 ? "encerrado" : "encerrados"}
            </Tag>
          )}
          {hasPayout ? (
            <Tag tone="green">
              Payout: {t.payouts_cents.length} {t.payouts_cents.length === 1 ? "lugar" : "lugares"}
            </Tag>
          ) : (
            <Tag tone="gold">Sem payout</Tag>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
    </button>
  );
}

function Tag({
  children,
  tone = "ink",
}: {
  children: React.ReactNode;
  tone?: "ink" | "green" | "gold";
}) {
  const cls = {
    ink: "border-border bg-surface-2 text-ink-dim",
    green: "border-action-green/30 bg-action-green/10 text-action-green",
    gold: "border-gold/30 bg-gold/10 text-gold",
  }[tone];
  return (
    <span className={cn("rounded-full border px-2 py-0.5 nums", cls)}>{children}</span>
  );
}

// ── Editor de payout ─────────────────────────────────────────────────────────

function PayoutEditor({
  type,
  onSaved,
  onDeleted,
  onCancel,
}: {
  type: TournamentType;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  // Cada slot é uma string editável (pra o usuário poder digitar "2,50").
  // Inicializa com payout cadastrado, ou com 3 linhas vazias se for novo.
  const initial = useMemo<string[]>(() => {
    if (type.payouts_cents.length > 0) {
      return type.payouts_cents.map((c) => (c / 100).toFixed(2).replace(".", ","));
    }
    return ["", "", ""];
  }, [type.type_key]);

  const [slots, setSlots] = useState<string[]>(initial);
  const [label, setLabel] = useState<string>(type.format ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setSlot(i: number, v: string) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  }
  function addSlot() {
    setSlots((prev) => [...prev, ""]);
  }
  function removeSlot(i: number) {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Maior posição finalizada já vista nesse tipo — pra sugerir "cubra até X"
  const maxFinish = type.finish_positions.reduce((m, p) => Math.max(m, p.pos), 0);

  // Soma dos prêmios cadastrados (informativo, comparar com prize pool se houver)
  const total = useMemo(() => {
    return slots.reduce((acc, s) => acc + (parseCentsInput(s) ?? 0), 0);
  }, [slots]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payouts = slots.map((s) => parseCentsInput(s) ?? 0);
      const trimmed = label.trim();
      const res = await api.setTournamentPayout(
        type.type_key,
        payouts,
        trimmed || null,
      );
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function removePayout() {
    if (!confirm("Apagar a estrutura de payout? Os prêmios calculados desses torneios vão sumir.")) {
      return;
    }
    setSaving(true);
    try {
      await api.deleteTournamentPayout(type.type_key);
      onDeleted();
    } finally {
      setSaving(false);
    }
  }

  const cost = (type.buy_in_cents ?? 0) + (type.fee_cents ?? 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Header informativo + edição do rótulo */}
      <Card className="p-3 sm:p-4">
        <SectionLabel>Rótulo</SectionLabel>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='Ex.: "SnG 9-max Turbo", "Hyper KO", "Daily $10"…'
          className="filter-input mt-1.5"
        />
        <div className="mt-2 text-2xs text-ink-faint">
          O rótulo é aplicado a todos os {type.n_tournaments} torneios desse tipo.
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <SectionLabel className="mb-1">Identificação</SectionLabel>
          <div className="text-sm text-ink">{type.name}</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-2xs">
            <Tag>Buy-in {fmtMoney(cost, type.currency)}</Tag>
            <Tag>
              {type.n_tournaments} {type.n_tournaments === 1 ? "torneio" : "torneios"} importados
            </Tag>
            {type.n_manual_overrides > 0 && (
              <Tag tone="gold">{type.n_manual_overrides} com prêmio editado à mão</Tag>
            )}
          </div>
          {maxFinish > 0 && (
            <div className="mt-2 text-2xs text-ink-faint">
              Maior posição já encerrada: <span className="text-ink">{maxFinish}º</span> — cadastre até essa posição (preencha com 0 onde não pagou).
            </div>
          )}
        </div>
      </Card>

      {/* Posições finais já vistas (compacto) */}
      {type.finish_positions.length > 0 && (
        <Card className="p-3 sm:p-4">
          <SectionLabel className="mb-2">Posições já encerradas</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {type.finish_positions.map((p) => (
              <span
                key={p.pos}
                className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-2xs nums text-ink-dim"
                title={`${p.n} ${p.n === 1 ? "torneio" : "torneios"}`}
              >
                {p.pos}º × {p.n}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Editor de posições */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Prêmios por posição</SectionLabel>
          <span className="text-2xs text-ink-faint">
            Total: <span className="nums text-ink">{fmtMoney(total, type.currency)}</span>
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {slots.map((v, i) => (
            <PositionSlot
              key={i}
              index={i}
              value={v}
              currency={type.currency}
              onChange={(nv) => setSlot(i, nv)}
              onRemove={slots.length > 1 ? () => removeSlot(i) : undefined}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={addSlot}
          className="mt-3 w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Adicionar posição
        </Button>
      </Card>

      {error && (
        <Card className="flex items-center gap-2 border-action-red/30 p-3 text-sm text-action-red">
          <X className="h-4 w-4 shrink-0" />
          {error}
        </Card>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={save}
          disabled={saving}
          className="flex-1"
        >
          <Save className="h-4 w-4" />
          Salvar
        </Button>
        <Button variant="ghost" size="md" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>

      {type.has_payout_table && (
        <Button variant="danger" size="sm" onClick={removePayout} disabled={saving}>
          <Trash2 className="h-4 w-4" />
          Remover estrutura de payout
        </Button>
      )}
    </div>
  );
}

function PositionSlot({
  index,
  value,
  currency,
  onChange,
  onRemove,
}: {
  index: number;
  value: string;
  currency: string;
  onChange: (v: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-12 shrink-0 place-items-center rounded-ctl border border-border bg-surface-2 text-xs font-semibold text-ink-dim nums">
        {index + 1}º
      </span>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">
          {currency === "BRL" ? "R$" : "$"}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="filter-input pl-9 text-right"
        />
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remover posição"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-ctl text-ink-faint hover:bg-surface-2 hover:text-action-red active:bg-action-red/15"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
