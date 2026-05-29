import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/state/AppProvider";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { GlossaryDialog } from "@/components/GlossaryDialog";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LauncherPage } from "@/pages/LauncherPage";
import { SimulatorPage } from "@/pages/SimulatorPage";
import { ConsultaPage } from "@/pages/ConsultaPage";
import { ImportPage } from "@/pages/ImportPage";
import { TournamentsPage } from "@/pages/TournamentsPage";
import { TournamentTypesPage } from "@/pages/TournamentTypesPage";
import { BASE } from "@/lib/api";

export function App() {
  return (
    <BrowserRouter basename={BASE || undefined}>
      <AppProvider>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<LauncherPage />} />
            <Route path="/sim" element={<SimulatorPage />} />
            <Route path="/consulta" element={<ConsultaPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournament-types" element={<TournamentTypesPage />} />
          </Routes>
          <SettingsDrawer />
          <GlossaryDialog />
          <InstallPrompt />
        </TooltipProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
