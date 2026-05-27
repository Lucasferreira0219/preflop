import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Drawer lateral elegante (Radix Dialog). Substitui o menu hambúrguer antigo. */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-full w-[300px] max-w-[86vw] flex-col",
            "border-l border-border bg-surface-1 shadow-pop outline-none",
            "data-[state=open]:animate-slide-in-right",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-sm font-semibold tracking-wide text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-ctl text-ink-dim hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{children}</div>
          {footer && <div className="border-t border-border p-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DrawerItem({
  active,
  icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-ctl px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? "bg-surface-2 font-medium text-ink"
          : "text-ink-dim hover:bg-surface-2 hover:text-ink",
      )}
    >
      {icon && <span className={cn("shrink-0", active ? "text-gold" : "text-ink-faint")}>{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
}
