import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/features/auth/LoginPage";
import RegisterPage from "@/features/auth/RegisterPage";
import CityPage from "@/features/city/CityPage";
import MapPage from "@/features/map/MapPage";
import RankingsPage from "@/features/rankings/RankingsPage";
import AlliancePage from "@/features/alliance/AlliancePage";
import MessagesPage from "@/features/messages/MessagesPage";
import Layout from "@/app/Layout";
import { UnitInfoProvider } from "@/shared/context/UnitInfoContext";
import { AllianceProfileProvider } from "@/features/alliance/context/AllianceProfileContext";
import { PlayerProfileProvider } from "@/features/rankings/context/PlayerProfileContext";
import { TickProvider } from "@/shared/context/TickContext";
import { loadGameSpeed } from "@/shared/lib/gameSpeed";

function isLoggedIn(): boolean {
  return !!localStorage.getItem("token");
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    loadGameSpeed()
      .then(() => setConfigReady(true))
      .catch((e) => setConfigError(e.message ?? "Failed to load config"));
  }, []);

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-red-400">
        Failed to load server config: {configError}
      </div>
    );
  }

  if (!configReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-300">
        Loading…
      </div>
    );
  }

  return (
    // Nesting de context providers: TickProvider trebuie sa fie cel mai exterior pentru ca
    // hook-urile de countdown depind de el. Restul pot fi reordonate liber. Daca creste
    // peste 5-6 provideri, as extrage un <Providers> wrapper — dar cu 4 nu merita indirectia.
    <TickProvider>
    <BrowserRouter>
    <UnitInfoProvider>
    <AllianceProfileProvider>
    <PlayerProfileProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/city" element={<CityPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/alliance" element={<AlliancePage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Route>
        <Route path="*" element={<Navigate to={isLoggedIn() ? "/city" : "/login"} replace />} />
      </Routes>
    </PlayerProfileProvider>
    </AllianceProfileProvider>
    </UnitInfoProvider>
    </BrowserRouter>
    </TickProvider>
  );
}
