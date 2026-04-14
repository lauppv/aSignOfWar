import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import CityPage from "./pages/CityPage.tsx";
import MapPage from "./pages/MapPage.tsx";
import { UnitInfoProvider } from "./context/UnitInfoContext.tsx";

function isLoggedIn(): boolean {
  return !!localStorage.getItem("token");
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    // daca vom avea mai multe context providers, vom face un context/AppProviders.tsx
    // care sa le includa pe toate, pentru a nu avea un nesting prea adanc in acest fisier

    // mergem pe principiul YAGNI - You Aren't Gonna Need It, adica nu facem lucruri care nu sunt necesare acum
    // poate nici nu vom avea nevoie de context pentru cladiri, notificari, etc
    <UnitInfoProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/city"
          element={
            <ProtectedRoute>
              <CityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={isLoggedIn() ? "/city" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
    </UnitInfoProvider>
  );
}
