import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/state/AppProvider";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { GlossaryDialog } from "@/components/GlossaryDialog";
import { TournamentDetailPanel } from "@/components/tournaments/TournamentDetailPanel";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LauncherPage } from "@/pages/LauncherPage";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { TournamentTypesPage } from "@/pages/TournamentTypesPage";
import { SessionsPage } from "@/pages/SessionsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotesPage } from "@/pages/NotesPage";
import { BASE } from "@/lib/api";

export function App() {
  return (
    <BrowserRouter basename={BASE || undefined}>
      <AppProvider>
        <TooltipProvider>
          <Routes>
            {/* Meus Torneios é a tela inicial do app. A home antiga (LauncherPage)
                segue acessível em /home como "Painel de estudo" opcional no menu. */}
            <Route path="/" element={<Navigate to="/tournaments" replace />} />
            <Route path="/home" element={<LauncherPage />} />
            <Route path="/import" element={<Navigate to="/tournaments" replace />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournament-types" element={<TournamentTypesPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notes" element={<NotesPage />} />
          </Routes>
          <SettingsDrawer />
          <GlossaryDialog />
          <TournamentDetailPanel />
          <InstallPrompt />
        </TooltipProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
