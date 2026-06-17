import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle, BookOpen, CalendarClock, Dumbbell, LineChart,
  MessageCircleQuestion, Settings, Target, Trophy,
} from "lucide-react";
import { Drawer, DrawerItem } from "@/components/ui/Drawer";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SectionLabel } from "@/components/ui/Card";
import { useApp } from "@/state/AppProvider";
import { MODE_LABEL } from "@/lib/mode";

type NavItem = { to: string; label: string; icon: React.ReactNode };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { to: "/tournaments", label: "Meus Torneios", icon: <LineChart className="h-4 w-4" /> },
      { to: "/treinar", label: "Treinar", icon: <Dumbbell className="h-4 w-4" /> },
      { to: "/notes", label: "Anotações", icon: <BookOpen className="h-4 w-4" /> },
    ],
  },
  {
    title: "Estudo",
    items: [
      { to: "/perguntar", label: "Perguntar ao PKE", icon: <MessageCircleQuestion className="h-4 w-4" /> },
      { to: "/home", label: "Painel de estudo", icon: <Target className="h-4 w-4" /> },
    ],
  },
  {
    title: "Gestão",
    items: [
      { to: "/sessions", label: "Sessões", icon: <CalendarClock className="h-4 w-4" /> },
      { to: "/tournament-types", label: "Estruturas", icon: <Trophy className="h-4 w-4" /> },
      { to: "/erros-criticos", label: "Erros críticos", icon: <AlertTriangle className="h-4 w-4" /> },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/settings", label: "Configurações", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

/** Drawer global de navegação (menu hambúrguer) + ajustes de modo.
 *  Renderizado uma vez no shell; aberto pelo MenuButton de cada tela. */
export function SettingsDrawer() {
  const {
    drawerOpen, setDrawerOpen, drawerActions, mode, setMode,
    studyMode, setStudyMode, setGlossaryOpen,
  } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = (to: string) => {
    navigate(to);
    setDrawerOpen(false);
  };

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="♠ Preflop">
      <div className="px-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-1">
            <SectionLabel className="px-2 pb-1.5 pt-3">{group.title}</SectionLabel>
            {group.items.map((it) => (
              <DrawerItem
                key={it.to}
                active={pathname === it.to}
                icon={it.icon}
                onClick={() => go(it.to)}
              >
                {it.label}
              </DrawerItem>
            ))}
          </div>
        ))}

        {drawerActions.length > 0 && (
          <div className="mb-1">
            <SectionLabel className="px-2 pb-1.5 pt-3">Nesta página</SectionLabel>
            {drawerActions.map((a) => (
              <DrawerItem
                key={a.label}
                icon={a.icon}
                onClick={() => { a.onClick(); setDrawerOpen(false); }}
              >
                <span className={a.danger ? "text-action-red" : undefined}>{a.label}</span>
              </DrawerItem>
            ))}
          </div>
        )}

        <SectionLabel className="px-2 pb-1.5 pt-3">Atalhos</SectionLabel>
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
