import { useEffect, useState } from "react";
import { useNow } from "../context/TickContext.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import CommandDetailModal from "../components/CommandDetailModal.tsx";
import CancelCommandConfirm from "../components/CancelCommandConfirm.tsx";
import { cancelCommand } from "../api/command.ts";
import { getMyCity } from "../api/city.ts";
import { getCityCommands } from "../api/command.ts";
import { getReports } from "../api/report.ts";
import { logout } from "../api/auth.ts";
import { getCurrentUserId, getActiveCityId, setActiveCityId, clearActiveCityId } from "../api/client.ts";
import {
  getHousingCapacity as getMaxPopulation,
  getWarehouseCapacity,
  getAirDefenseBonus,
  getResourceProduction,
} from "@shared/gameConfig.ts";
import { computePopulation, getBuildingLevel, computeCityPoints } from "../lib/cityHelpers.ts";
import { GAME_SPEED } from "../lib/gameSpeed.ts";
import ResourceBar from "../components/ResourceBar.tsx";
import UnitCard from "../components/UnitCard.tsx";
import { UNIT_ORDER } from "../lib/labels.ts";
import CityMap from "../components/CityMap.tsx";
import BuildingsView from "../components/BuildingsView.tsx";
import MilitaryBaseView from "../components/MilitaryBaseView.tsx";
import BuildingDetailView from "../components/BuildingDetailView.tsx";
import SimulatorView from "../components/SimulatorView.tsx";
import ReportsView from "../components/ReportsView.tsx";
import type { BuildingName, UnitName } from "../types/index.ts";
import type { OutgoingCommand, IncomingCommand } from "../types/index.ts";

type MergedCommand =
  | ({ direction: "outgoing" } & OutgoingCommand)
  | ({ direction: "incoming" } & IncomingCommand);

const CMD_COLORS = {
  ATTACK:    { border: "#f85149", badgeBg: "#3d1a1a", badgeText: "#f85149" },
  SUPPORT:   { border: "#58a6ff", badgeBg: "#0c2744", badgeText: "#58a6ff" },
  RESOURCES: { border: "#d29922", badgeBg: "#3d2e0a", badgeText: "#d29922" },
  SPY:       { border: "#a371f7", badgeBg: "#2e1a3d", badgeText: "#a371f7" },
};

const CANCEL_WINDOW_MS = 5 * 60 * 1000;

function canCancel(cmd: OutgoingCommand, now: number): boolean {
  return now - new Date(cmd.departureAt).getTime() <= CANCEL_WINDOW_MS;
}

function fmtArrival(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "arriving...";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function CityPage() {
  const navigate = useNavigate();
  const now = useNow();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCmd, setSelectedCmd] = useState<MergedCommand | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OutgoingCommand | null>(null);

  const DETAIL_BUILDINGS: BuildingName[] = [
    "BANK", "POWER_PLANT", "WEAPONS_FACTORY", "HOUSING", "WAREHOUSE", "HARBOR", "AIR_DEFENSE",
  ];

  const urlCityId       = searchParams.get("cityId");
  const activeCityId    = urlCityId ?? getActiveCityId() ?? undefined;

  // Daca URL-ul nu are cityId dar avem unul salvat, promoveaza-l in URL ca
  // link-urile sa fie share-abile si back-button-ul sa functioneze corect.
  useEffect(() => {
    if (!urlCityId && activeCityId) {
      const next = new URLSearchParams(searchParams);
      next.set("cityId", activeCityId);
      setSearchParams(next, { replace: true });
    }
  }, [urlCityId, activeCityId, searchParams, setSearchParams]);
  const view            = searchParams.get("view");
  const showBuildings   = view === "buildings";
  const showMilitaryBase = view === "military_base";
  const detailBuilding  = view === "building" ? (searchParams.get("name") as BuildingName | null) : null;
  const showSimulator   = view === "simulator";
  const showReports     = view === "reports";

  function openView(v: string, extra?: Record<string, string>) {
    setSearchParams({ view: v, ...extra });
  }
  function closeView() {
    navigate(-1);
  }

  const { data: city, error, isLoading } = useQuery({
    queryKey: ["city", activeCityId ?? "default"],
    queryFn: () => getMyCity(activeCityId),
    refetchInterval: 5000,
    retry: false,
  });

  // Daca query-ul esueaza si aveam un cityId explicit (din URL sau localStorage),
  // e probabil un ID stale de la alt cont. Curatam si reincarcam fara el.
  useEffect(() => {
    if (error && activeCityId) {
      clearActiveCityId();
      const next = new URLSearchParams(searchParams);
      next.delete("cityId");
      setSearchParams(next, { replace: true });
    }
  }, [error, activeCityId, searchParams, setSearchParams]);

  // Persista id-ul orasului incarcat efectiv (poate fi diferit de activeCityId
  // daca acel id era invalid si backend-ul a picat pe default).
  useEffect(() => {
    if (city?.id) setActiveCityId(city.id);
  }, [city?.id]);

  function switchToCity(cityId: string) {
    const next = new URLSearchParams(searchParams);
    next.set("cityId", cityId);
    next.delete("view");
    next.delete("name");
    setSearchParams(next);
  }

  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: ({ fromCityId, commandId }: { fromCityId: string; commandId: string }) =>
      cancelCommand(fromCityId, commandId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commands"] });
      queryClient.invalidateQueries({ queryKey: ["city"] });
    },
  });

  const { data: commands } = useQuery({
    queryKey: ["commands", city?.id],
    queryFn: () => getCityCommands(city!.id),
    enabled: !!city?.id,
    refetchInterval: 5000,
  });

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
  // Snapshot-ul "what was already read" la momentul deschiderii listei, ca sa
  // putem evidentia randurile necitite dupa ce marcam totul ca vazut.
  const [readSnapshot, setReadSnapshot] = useState<Set<string>>(() => new Set());
  const unreadReports = (reports ?? []).filter((r) => !seenReportIds.has(r.id)).length;

  function openReports() {
    setReadSnapshot(new Set(seenReportIds));
    const allIds = (reports ?? []).map((r) => r.id);
    const next = new Set<string>(allIds);
    localStorage.setItem(seenReportsKey, JSON.stringify(Array.from(next)));
    setSeenReportIds(next);
    openView("reports");
  }

  function handleLogout() {
    logout();
    queryClient.clear();
    navigate("/login");
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-[#b1bac4]">Loading city...</div>;
  }
  if (error || !city) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-[#f85149]">
        Failed to load city.
        <button onClick={handleLogout} className="text-sm text-[#b1bac4] border border-[#30363d] rounded px-3 py-1">Logout</button>
      </div>
    );
  }

  const population        = computePopulation(city);
  const cityPoints        = computeCityPoints(city);
  const maxPopulation     = getMaxPopulation(getBuildingLevel(city, "HOUSING"));
  const warehouseCapacity = getWarehouseCapacity(getBuildingLevel(city, "WAREHOUSE"));
  const airDefenseLevel   = getBuildingLevel(city, "AIR_DEFENSE");
  const airDefenseBonus   = getAirDefenseBonus(airDefenseLevel);
  const unitTotals = new Map<UnitName, number>();
  for (const u of city.units)                   unitTotals.set(u.name, (unitTotals.get(u.name) ?? 0) + u.quantity);
  for (const u of city.supportUnits ?? [])      unitTotals.set(u.name, (unitTotals.get(u.name) ?? 0) + u.quantity);

  // City view arata doar comenzi in desfasurare (TRAVELING/RETURNING).
  // Sprijinul stationat (ARRIVED) se vede in map → city action panel si in rapoarte.
  const mergedCommands: MergedCommand[] = [
    ...(commands?.outgoing.map((c) => ({ ...c, direction: "outgoing" as const })) ?? []),
    ...(commands?.incoming.map((c) => ({ ...c, direction: "incoming" as const })) ?? []),
  ]
    .filter(c => c.status === "TRAVELING" || c.status === "RETURNING")
    .sort((a, b) => new Date(a.arrivalAt).getTime() - new Date(b.arrivalAt).getTime());

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
        onSimulator={() => openView("simulator")}
        onReports={openReports}
        onMap={() => navigate("/map")}
        unreadReports={unreadReports}
      />

      {showSimulator ? (
        <SimulatorView onClose={closeView} />
      ) : showReports ? (
        <ReportsView onClose={closeView} initiallyRead={readSnapshot} />
      ) : showBuildings ? (
        <BuildingsView city={city} onClose={closeView} onBuildingClick={(name) => {
          if (name === "MILITARY_BASE") openView("military_base");
          else openView("building", { name });
        }} />
      ) : showMilitaryBase ? (
        <MilitaryBaseView city={city} onClose={closeView} />
      ) : detailBuilding ? (
        <BuildingDetailView name={detailBuilding} city={city} onClose={closeView} />
      ) : (
        /* 3-column main */
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Air defense + Commands */}
          <div className="flex-1 flex flex-col bg-[#161b22] border-r border-[#30363d] overflow-hidden">

            {/* Air defense + Governor/Hacker row */}
            <div className="h-1/4 min-h-[130px] border-b border-[#30363d] flex shrink-0">

              {/* Air defense (left) */}
              <div
                className="flex-1 p-2.5 border-r border-[#30363d] flex flex-col gap-1.5 cursor-pointer hover:bg-[#1c2129] transition-colors min-w-0"
                onClick={() => openView("building", { name: "AIR_DEFENSE" })}
              >
                <span className="text-[10px] uppercase tracking-widest text-[#b1bac4]">Air defense</span>
                <img
                  src="/images/buildings/air_defense.jpg"
                  alt="Air defense"
                  className="w-full flex-1 min-h-0 object-contain rounded"
                />
                <div className="flex justify-between text-xs">
                  <span className="text-[#c9d1d9]">Lvl {airDefenseLevel}</span>
                  <span className="text-[#3fb950] font-semibold">+{airDefenseBonus}% def</span>
                </div>
              </div>

              {/* Governor + Hacker (right, stacked) */}
              <div className="flex-1 flex flex-col min-w-0 p-2 gap-2 items-center justify-center">
                <div className="w-auto h-[calc(50%-0.25rem)] aspect-square">
                  <UnitCard name="GOVERNOR" total={unitTotals.get("GOVERNOR") ?? 0} />
                </div>
                <div className="w-auto h-[calc(50%-0.25rem)] aspect-square">
                  <UnitCard name="HACKER" total={unitTotals.get("HACKER") ?? 0} />
                </div>
              </div>
            </div>

            {/* Commands */}
            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-[#b1bac4] shrink-0">Commands</span>
              {mergedCommands.length === 0 && (
                <span className="text-[11px] text-[#7d8590] text-center mt-2">No active commands</span>
              )}
              {mergedCommands.map((cmd) => {
                const isOut = cmd.direction === "outgoing";
                const colors = CMD_COLORS[cmd.type];
                const isIncomingAttack = !isOut && cmd.type === "ATTACK";
                const isReturning = cmd.status === "RETURNING";

                // Aspect:
                //  - OUT: bordura stanga (pleaca din orasul tau spre dreapta) + sageata "→ TARGET"
                //  - IN : bordura dreapta (vine din afara, spre orasul tau) + sageata "FROM ←"
                //  - INCOMING ATTACK: tinta vizibila — fundal rosu sangeriu + glow
                return (
                  <div
                    key={cmd.id}
                    onClick={() => setSelectedCmd(cmd)}
                    className="p-2 rounded flex items-center gap-2 shrink-0 cursor-pointer hover:brightness-125"
                    style={{
                      background: isIncomingAttack ? "#2a0e0e" : "#0d1117",
                      borderLeft:  isOut ? `4px solid ${colors.border}` : undefined,
                      borderRight: !isOut ? `4px solid ${colors.border}` : undefined,
                      boxShadow: isIncomingAttack ? "0 0 10px rgba(248,81,73,0.35)" : undefined,
                    }}
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: colors.badgeBg, color: colors.badgeText }}
                    >
                      {cmd.type}
                    </span>
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: isReturning ? "#2a2a1c" : (isOut ? "#1c2a3a" : "#3a1c1c"),
                        color:      isReturning ? "#d2a8ff" : (isOut ? "#79c0ff" : "#f85149"),
                      }}
                    >
                      {cmd.status === "ARRIVED" ? "⛨ stationed" : isReturning ? "↩ returning" : (isOut ? "▶ outgoing" : "◀ incoming")}
                    </span>

                    <span className="text-[10px] text-[#7d8590] font-mono flex-1 text-right">
                      {cmd.status === "ARRIVED" ? "stationed" : `⏱ ${fmtArrival(cmd.arrivalAt, now)}`}
                    </span>

                    {isOut && cmd.status === "TRAVELING" && canCancel(cmd as OutgoingCommand, now) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelTarget(cmd as OutgoingCommand);
                        }}
                        disabled={cancelMutation.isPending}
                        className="shrink-0 text-[9px] uppercase tracking-wide border border-[#30363d] text-[#b1bac4] rounded px-1.5 py-0.5 hover:border-[#f85149] hover:text-[#f85149] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CENTER: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            onBuildingClick={(name) => {
              if (name === "HEADQUARTERS")              openView("buildings");
              else if (name === "MILITARY_BASE")        openView("military_base");
              else if (DETAIL_BUILDINGS.includes(name)) openView("building", { name });
            }}
          />

          {/* RIGHT: Units */}
          <div className="flex-1 bg-[#161b22] border-l border-[#30363d] overflow-y-auto p-2.5 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[#b1bac4] shrink-0">Units in city</span>
            <div className="grid grid-cols-3 gap-1.5">
              {UNIT_ORDER.filter((name) => name !== "HACKER").map((name) => (
                <UnitCard key={name} name={name} total={unitTotals.get(name) ?? 0} />
              ))}
            </div>
          </div>

        </div>
      )}

      {selectedCmd && (
        <CommandDetailModal cmd={selectedCmd} onClose={() => setSelectedCmd(null)} />
      )}

      <CancelCommandConfirm
        open={!!cancelTarget}
        pending={cancelMutation.isPending}
        onBack={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          cancelMutation.mutate(
            { fromCityId: city.id, commandId: cancelTarget.id },
            { onSettled: () => setCancelTarget(null) }
          );
        }}
      />
    </div>
  );
}
