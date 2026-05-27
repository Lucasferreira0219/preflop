import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getMode as readMode, setMode as persistMode, stacksForMode } from "@/lib/mode";
import { lsGet, lsSet } from "@/lib/storage";
import type { Mode } from "@/lib/types";

const STUDY_KEY = "preflop.studyMode.v1";

interface AppCtx {
  mode: Mode;
  setMode: (m: Mode) => void;
  stacks: number[];
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  glossaryOpen: boolean;
  setGlossaryOpen: (v: boolean) => void;
  studyMode: boolean;
  setStudyMode: (v: boolean) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => readMode());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [studyMode, setStudyModeState] = useState<boolean>(() => lsGet<boolean>(STUDY_KEY, true));

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
      glossaryOpen, setGlossaryOpen,
      studyMode, setStudyMode,
    }),
    [mode, setMode, drawerOpen, glossaryOpen, studyMode, setStudyMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
