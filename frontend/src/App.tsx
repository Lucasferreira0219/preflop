import { useState } from "react";
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
import { LoginPage } from "@/pages/LoginPage";
import { BASE } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export function App() {
  const [authed, setAuthed] = useState(isAuthenticated);

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter basename={BASE || undefined}>
      <AppProvider>
        <TooltipProvider>
          <Routes>
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
