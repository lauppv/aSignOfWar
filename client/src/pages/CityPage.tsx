import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import CommandDetailModal from "../components/CommandDetailModal.tsx";
import { cancelCommand } from "../api/command.ts";
import { getMyCity } from "../api/city.ts";
import { getCityCommands } from "../api/command.ts";
import { logout } from "../api/auth.ts";
import {
  getHousingCapacity as getMaxPopulation,
  getWarehouseCapacity,
  getAirDefenseBonus,
  getResourceProduction,
} from "@shared/gameConfig.ts";
import { computePopulation, getBuildingLevel } from "../lib/cityHelpers.ts";
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
  SUPPORT:   { border: "#3fb950", badgeBg: "#1a3d1a", badgeText: "#3fb950" },
  RESOURCES: { border: "#d29922", badgeBg: "#3d2e0a", badgeText: "#d29922" },
};

const CANCEL_WINDOW_MS = 5 * 60 * 1000;

function canCancel(cmd: OutgoingCommand): boolean {
  return Date.now() - new Date(cmd.departureAt).getTime() <= CANCEL_WINDOW_MS;
}

function fmtArrival(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCmd, setSelectedCmd] = useState<MergedCommand | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OutgoingCommand | null>(null);

  const DETAIL_BUILDINGS: BuildingName[] = [
    "BANK", "POWER_PLANT", "WEAPONS_FACTORY", "HOUSING", "WAREHOUSE", "HARBOR", "AIR_DEFENSE",
  ];

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
    queryKey: ["city"],
    queryFn: getMyCity,
    refetchInterval: 5000,
  });

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

  function handleLogout() {
    logout();
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
        money={city.money}
        energy={city.energy}
        ammo={city.ammo}
        capacity={warehouseCapacity}
        moneyProd={getResourceProduction(getBuildingLevel(city, "BANK"))}
        energyProd={getResourceProduction(getBuildingLevel(city, "POWER_PLANT"))}
        ammoProd={getResourceProduction(getBuildingLevel(city, "WEAPONS_FACTORY"))}
        population={population}
        maxPopulation={maxPopulation}
        onLogout={handleLogout}
        onSimulator={() => openView("simulator")}
        onReports={() => openView("reports")}
        onMap={() => navigate("/map")}
      />

      {showSimulator ? (
        <SimulatorView onClose={closeView} />
      ) : showReports ? (
        <ReportsView onClose={closeView} />
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

            {/* Air defense */}
            <div
              className="h-1/4 min-h-[130px] p-2.5 border-b border-[#30363d] flex flex-col gap-1.5 shrink-0 cursor-pointer hover:bg-[#1c2129] transition-colors"
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

            {/* Commands */}
            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-[#b1bac4] shrink-0">Commands</span>
              {mergedCommands.length === 0 && (
                <span className="text-[11px] text-[#7d8590] text-center mt-2">No active commands</span>
              )}
              {mergedCommands.map((cmd) => {
                const isOut = cmd.direction === "outgoing";
                const otherCity = isOut
                  ? (cmd as OutgoingCommand & { direction: "outgoing" }).toCity
                  : (cmd as IncomingCommand & { direction: "incoming" }).fromCity;
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
                    className="p-2 rounded flex flex-col gap-1 shrink-0 cursor-pointer hover:brightness-125"
                    style={{
                      background: isIncomingAttack ? "#2a0e0e" : "#0d1117",
                      borderLeft:  isOut ? `4px solid ${colors.border}` : undefined,
                      borderRight: !isOut ? `4px solid ${colors.border}` : undefined,
                      boxShadow: isIncomingAttack ? "0 0 10px rgba(248,81,73,0.35)" : undefined,
                    }}
                  >
                    <div className="flex justify-between items-center gap-1">
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
                    </div>

                    <div className="flex justify-between items-center gap-2">
                      {isOut ? (
                        <div className="text-[11px] truncate min-w-0 flex-1">
                          {isReturning ? (
                            <>
                              <span className="text-[#d2a8ff] font-semibold">← {otherCity.name}</span>
                              <span className="text-[#b1bac4]"> returning</span>
                              <span className="text-[#7d8590]"> ({(otherCity.owner?.username ?? "Ghost city")})</span>
                            </>
                          ) : cmd.status === "ARRIVED" ? (
                            <>
                              <span className="text-[#b1bac4]">stationed at </span>
                              <span className="text-[#3fb950] font-semibold">{otherCity.name}</span>
                              <span className="text-[#7d8590]"> ({(otherCity.owner?.username ?? "Ghost city")})</span>
                            </>
                          ) : (
                            <>
                              <span className="text-[#b1bac4]">to </span>
                              <span className="text-[#79c0ff] font-semibold">→ {otherCity.name}</span>
                              <span className="text-[#7d8590]"> ({(otherCity.owner?.username ?? "Ghost city")})</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] truncate min-w-0 flex-1">
                          <span className="text-[#f85149] font-semibold">{otherCity.name} ←</span>
                          <span className="text-[#b1bac4]"> from</span>
                          <span className="text-[#7d8590]"> ({(otherCity.owner?.username ?? "Ghost city")})</span>
                        </div>
                      )}

                      {isOut && cmd.status === "TRAVELING" && canCancel(cmd as OutgoingCommand) && (
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

                    <span className="text-[10px] text-[#7d8590]">
                      {cmd.status === "ARRIVED" ? "⛨ stationed in target" : `⏱ ${fmtArrival(cmd.arrivalAt)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CENTER: City image */}
          <CityMap
            cityName={city.name}
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
              {UNIT_ORDER.map((name) => (
                <UnitCard key={name} name={name} total={unitTotals.get(name) ?? 0} />
              ))}
            </div>
          </div>

        </div>
      )}

      {selectedCmd && (
        <CommandDetailModal cmd={selectedCmd} onClose={() => setSelectedCmd(null)} />
      )}

      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setCancelTarget(null)}
        >
          <div
            className="bg-[#161b22] border border-[#30363d] rounded p-5 w-[340px] text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[#c9d1d9] mb-1">Are you sure you want to cancel this command?</div>
            <div className="text-[10px] text-[#7d8590] mb-4">
              Units will return home in the same time they've been travelling so far.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelTarget(null)}
                className="px-3 py-1 text-[#b1bac4] border border-[#30363d] rounded hover:bg-[#1c2129]"
              >
                Back
              </button>
              <button
                onClick={() => {
                  cancelMutation.mutate(
                    { fromCityId: city.id, commandId: cancelTarget.id },
                    { onSettled: () => setCancelTarget(null) }
                  );
                }}
                disabled={cancelMutation.isPending}
                className="px-3 py-1 text-[#f85149] border border-[#3d1a1a] rounded hover:bg-[#1f0e0e] disabled:opacity-40"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel command"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
