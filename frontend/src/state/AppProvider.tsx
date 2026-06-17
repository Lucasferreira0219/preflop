import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getMode as readMode, setMode as persistMode, stacksForMode } from "@/lib/mode";
import { lsGet, lsSet } from "@/lib/storage";
import type { Mode } from "@/lib/types";

const STUDY_KEY = "preflop.studyMode.v1";

/** Ação secundária específica da página, exibida dentro do menu hambúrguer
 *  numa seção "Nesta página". A página registra com setDrawerActions. */
export interface DrawerAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface AppCtx {
  mode: Mode;
  setMode: (m: Mode) => void;
  stacks: number[];
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  drawerActions: DrawerAction[];
  setDrawerActions: (a: DrawerAction[]) => void;
  glossaryOpen: boolean;
  setGlossaryOpen: (v: boolean) => void;
  tournamentDetailId: string | null;
  openTournament: (id: string | null) => void;
  closeTournament: () => void;
  studyMode: boolean;
  setStudyMode: (v: boolean) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => readMode());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActions, setDrawerActions] = useState<DrawerAction[]>([]);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [studyMode, setStudyModeState] = useState<boolean>(() => lsGet<boolean>(STUDY_KEY, true));

  const [tournamentDetailId, setTournamentDetailId] = useState<string | null>(null);
  const openTournament = useCallback((id: string | null) => setTournamentDetailId(id), []);
  const closeTournament = useCallback(() => setTournamentDetailId(null), []);

  const setMode = useCallback((m: Mode) => {
    persistMode(m);
    setModeState(m);
  }, []);

  const setStudyMode = useCallback((v: boolean) => {
    lsSet(STUDY_KEY, v);
    setStudyModeState(v);
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      mode, setMode, stacks: stacksForMode(mode),
      drawerOpen, setDrawerOpen,
      drawerActions, setDrawerActions,
      glossaryOpen, setGlossaryOpen,
      tournamentDetailId, openTournament, closeTournament,
      studyMode, setStudyMode,
    }),
    [mode, setMode, drawerOpen, drawerActions, glossaryOpen,
     tournamentDetailId, openTournament, closeTournament, studyMode, setStudyMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
