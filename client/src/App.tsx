import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import CityPage from "./pages/CityPage.tsx";
import MapPage from "./pages/MapPage.tsx";
import RankingsPage from "./pages/RankingsPage.tsx";
import AlliancePage from "./pages/AlliancePage.tsx";
import MessagesPage from "./pages/MessagesPage.tsx";
import Layout from "./components/Layout.tsx";
import { UnitInfoProvider } from "./context/UnitInfoContext.tsx";
import { AllianceProfileProvider } from "./context/AllianceProfileContext.tsx";
import { TickProvider } from "./context/TickContext.tsx";
import { loadGameSpeed } from "./lib/gameSpeed.ts";

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
    // daca vom avea mai multe context providers, vom face un context/AppProviders.tsx
    // care sa le includa pe toate, pentru a nu avea un nesting prea adanc in acest fisier

    // mergem pe principiul YAGNI - You Aren't Gonna Need It, adica nu facem lucruri care nu sunt necesare acum
    // poate nici nu vom avea nevoie de context pentru cladiri, notificari, etc
    <TickProvider>
    <UnitInfoProvider>
    <AllianceProfileProvider>
    <BrowserRouter>
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
    </BrowserRouter>
    </AllianceProfileProvider>
    </UnitInfoProvider>
    </TickProvider>
  );
}
