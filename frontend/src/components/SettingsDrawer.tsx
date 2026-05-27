import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Grid3x3, Home, Target } from "lucide-react";
import { Drawer, DrawerItem } from "@/components/ui/Drawer";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SectionLabel } from "@/components/ui/Card";
import { useApp } from "@/state/AppProvider";
import { MODE_LABEL } from "@/lib/mode";

/** Drawer global de navegação + modo. Renderizado uma vez no shell. */
export function SettingsDrawer() {
  const { drawerOpen, setDrawerOpen, mode, setMode, studyMode, setStudyMode, setGlossaryOpen } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = (to: string) => {
    navigate(to);
    setDrawerOpen(false);
  };

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="♠ Preflop">
      <div className="px-1">
        <SectionLabel className="px-2 pb-2 pt-1">Navegação</SectionLabel>
        <DrawerItem active={pathname === "/sim"} icon={<Target className="h-4 w-4" />} onClick={() => go("/sim")}>
          Simulador
        </DrawerItem>
        <DrawerItem active={pathname === "/consulta"} icon={<Grid3x3 className="h-4 w-4" />} onClick={() => go("/consulta")}>
          Consulta
        </DrawerItem>
        <DrawerItem active={pathname === "/"} icon={<Home className="h-4 w-4" />} onClick={() => go("/")}>
          Início
        </DrawerItem>
        <DrawerItem icon={<BookOpen className="h-4 w-4" />} onClick={() => { setGlossaryOpen(true); setDrawerOpen(false); }}>
          Glossário
        </DrawerItem>

        <SectionLabel className="px-2 pb-2 pt-5">Modo de treino</SectionLabel>
        <div className="px-2">
          <SegmentedControl
            value={studyMode ? "estudo" : "rapido"}
            onChange={(v) => setStudyMode(v === "estudo")}
            className="w-full [&>button]:flex-1"
            segments={[
              { value: "rapido", label: "Rápido" },
              { value: "estudo", label: "Estudo" },
            ]}
          />
          <p className="mt-2 px-1 text-xs leading-relaxed text-ink-faint">
            {studyMode
              ? "Estudo — mostra a explicação didática completa após cada mão."
              : "Rápido — mostra só a resposta e segue pro treino."}
          </p>
        </div>

        <SectionLabel className="px-2 pb-2 pt-5">Modo de jogo</SectionLabel>
        <div className="px-2">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            className="w-full [&>button]:flex-1"
            segments={[
              { value: "mtt", label: MODE_LABEL.mtt },
              { value: "sng", label: MODE_LABEL.sng },
            ]}
          />
          <p className="mt-2 px-1 text-xs leading-relaxed text-ink-faint">
            {mode === "sng"
              ? "Sit & Go — stacks curtos, push/fold e resteal."
              : "Torneios multi-mesa — stacks profundos, jogo clássico."}
          </p>
        </div>
      </div>
    </Drawer>
  );
}
