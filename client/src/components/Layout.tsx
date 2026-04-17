import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyCity } from "../api/city.ts";
import { getReports } from "../api/report.ts";
import { getDirectUnreadCount } from "../api/message.ts";
import { logout } from "../api/auth.ts";
import {
  getCurrentUserId,
  getActiveCityId,
  setActiveCityId,
  clearActiveCityId,
} from "../api/client.ts";
import {
  getHousingCapacity as getMaxPopulation,
  getWarehouseCapacity,
  getResourceProduction,
} from "@shared/gameConfig.ts";
import { computePopulation, getBuildingLevel, computeCityPoints } from "../lib/cityHelpers.ts";
import { GAME_SPEED } from "../lib/gameSpeed.ts";
import ResourceBar from "./ResourceBar.tsx";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const onCityRoute = location.pathname === "/city";
  const urlCityId = onCityRoute ? searchParams.get("cityId") : null;
  const activeCityId = urlCityId ?? getActiveCityId() ?? undefined;

  const { data: city, error } = useQuery({
    queryKey: ["city", activeCityId ?? "default"],
    queryFn: () => getMyCity(activeCityId),
    refetchInterval: 5000,
    retry: false,
  });

  useEffect(() => {
    if (error && activeCityId) clearActiveCityId();
  }, [error, activeCityId]);

  useEffect(() => {
    if (city?.id) setActiveCityId(city.id);
  }, [city?.id]);

  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
    refetchInterval: 10000,
  });

  const seenReportsKey = `seenReports:${getCurrentUserId() ?? "anon"}`;
  const [seenReportIds, setSeenReportIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(seenReportsKey);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });

  // Re-sync if the user changed (rare; defensive).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(seenReportsKey);
      setSeenReportIds(new Set<string>(raw ? JSON.parse(raw) : []));
    } catch {
      setSeenReportIds(new Set<string>());
    }
  }, [seenReportsKey]);

  const unreadReports = (reports ?? []).filter((r) => !seenReportIds.has(r.id)).length;

  const { data: unreadMsgs } = useQuery({
    queryKey: ["messages", "unread"],
    queryFn: getDirectUnreadCount,
    refetchInterval: 3000,
  });
  const unreadMessages = unreadMsgs?.count ?? 0;

  function openReports() {
    const snapshot = Array.from(seenReportIds);
    const allIds = (reports ?? []).map((r) => r.id);
    const next = new Set<string>(allIds);
    localStorage.setItem(seenReportsKey, JSON.stringify(Array.from(next)));
    setSeenReportIds(next);
    navigate("/city?view=reports", { state: { initiallyRead: snapshot } });
  }

  function handleLogout() {
    logout();
    queryClient.clear();
    navigate("/login");
  }

  function switchToCity(cityId: string) {
    setActiveCityId(cityId);
    queryClient.invalidateQueries({ queryKey: ["city"] });
    queryClient.invalidateQueries({ queryKey: ["commands"] });
    if (onCityRoute) {
      navigate(`/city?cityId=${encodeURIComponent(cityId)}`);
    }
  }

  // If we have no city yet (first load or load error), render only the outlet.
  // Pages handle their own loading / error states.
  if (!city) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  }

  const population = computePopulation(city);
  const cityPoints = computeCityPoints(city);
  const maxPopulation = getMaxPopulation(getBuildingLevel(city, "HOUSING"));
  const warehouseCapacity = getWarehouseCapacity(getBuildingLevel(city, "WAREHOUSE"));

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ResourceBar
        cityName={city.name}
        ownedCities={city.ownedCities}
        activeCityId={city.id}
        onSwitchCity={switchToCity}
        cityPoints={cityPoints}
        money={city.money}
        energy={city.energy}
        ammo={city.ammo}
        capacity={warehouseCapacity}
        moneyProd={getResourceProduction(getBuildingLevel(city, "BANK"), GAME_SPEED)}
        energyProd={getResourceProduction(getBuildingLevel(city, "POWER_PLANT"), GAME_SPEED)}
        ammoProd={getResourceProduction(getBuildingLevel(city, "WEAPONS_FACTORY"), GAME_SPEED)}
        population={population}
        maxPopulation={maxPopulation}
        onLogout={handleLogout}
        onRankings={() => navigate("/rankings")}
        onAlliance={() => navigate("/alliance")}
        onSimulator={() => navigate("/city?view=simulator")}
        onReports={openReports}
        onMessages={() => navigate("/messages")}
        onMap={() => navigate("/map")}
        unreadReports={unreadReports}
        unreadMessages={unreadMessages}
      />
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
