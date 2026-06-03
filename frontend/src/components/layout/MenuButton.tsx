import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useApp } from "@/state/AppProvider";

/** Botão hambúrguer padrão — abre o drawer de navegação global.
 *  Reutilizado no cabeçalho de todas as telas pra navegação consistente. */
export function MenuButton({ className }: { className?: string }) {
  const { setDrawerOpen } = useApp();
  return (
    <IconButton label="Menu" className={className} onClick={() => setDrawerOpen(true)}>
      <Menu className="h-[18px] w-[18px]" />
    </IconButton>
  );
}
