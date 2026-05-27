import { cn } from "@/lib/cn";

/** Linha 1 do cabeçalho — reutilizada entre telas. Marca à esquerda, slot
 *  central (modo/tipo) e ações secundárias à direita. */
export function BrandBar({
  title,
  center,
  actions,
  className,
}: {
  title: React.ReactNode;
  center?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-14 items-center gap-3 px-4 sm:px-5", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-gold/30 bg-gold/10 text-[15px] text-gold">
          ♠
        </span>
        <span className="truncate text-[15px] font-semibold tracking-tight text-ink">{title}</span>
      </div>

      {center && <div className="flex shrink-0 items-center justify-center">{center}</div>}

      <div className="flex flex-1 items-center justify-end gap-1.5">{actions}</div>
    </div>
  );
}
