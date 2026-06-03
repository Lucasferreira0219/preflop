import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/state/AppProvider";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { GlossaryDialog } from "@/components/GlossaryDialog";
import { RuleDialog } from "@/components/RuleDialog";
import { TournamentDetailPanel } from "@/components/tournaments/TournamentDetailPanel";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LauncherPage } from "@/pages/LauncherPage";
import { ConsultaPage } from "@/pages/ConsultaPage";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { TournamentTypesPage } from "@/pages/TournamentTypesPage";
import { SessionsPage } from "@/pages/SessionsPage";
import { AskPage } from "@/pages/AskPage";
import { TrainPage } from "@/pages/TrainPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CriticalHandsPage } from "@/pages/CriticalHandsPage";
import { NotesPage } from "@/pages/NotesPage";
import { BASE } from "@/lib/api";

export function App() {
  return (
    <BrowserRouter basename={BASE || undefined}>
      <AppProvider>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<LauncherPage />} />
            <Route path="/sim" element={<Navigate to="/treinar" replace />} />
            <Route path="/consulta" element={<ConsultaPage />} />
            <Route path="/import" element={<Navigate to="/tournaments" replace />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournament-types" element={<TournamentTypesPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/perguntar" element={<AskPage />} />
            <Route path="/treinar" element={<TrainPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/erros-criticos" element={<CriticalHandsPage />} />
            <Route path="/notes" element={<NotesPage />} />
          </Routes>
          <SettingsDrawer />
          <GlossaryDialog />
          <RuleDialog />
          <TournamentDetailPanel />
          <InstallPrompt />
        </TooltipProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
