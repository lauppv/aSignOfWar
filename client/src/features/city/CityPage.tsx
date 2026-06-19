import { useEffect, useState } from "react";
import { useNow } from "@/shared/context/TickContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import CommandDetailModal from "@/features/city/components/CommandDetailModal";
import CancelCommandConfirm from "@/features/city/components/CancelCommandConfirm";
import { cancelCommand } from "@/features/city/api/command";
import { getMyCity } from "@/features/city/api/city";
import { getCityCommands } from "@/features/city/api/command";
import { getSiegeStatus } from "@/features/siege/api/siege";
import SiegeBadge from "@/features/siege/components/SiegeBadge";
import SiegeCard from "@/features/siege/components/SiegeCard";
import { getActiveCityId, setActiveCityId, clearActiveCityId } from "@/shared/api/client";
import {
  getAirDefenseBonus,
} from "@shared/gameConfig.ts";
import { getBuildingLevel } from "@/features/city/lib/cityHelpers";
import UnitCard from "@/features/city/components/UnitCard";
import { UNIT_ORDER, CMD_COLORS, fmtArrival } from "@/shared/lib/labels";
import CityMap from "@/features/city/components/CityMap";
import BuildingsView from "@/features/city/components/BuildingsView";
import MilitaryBaseView from "@/features/city/components/MilitaryBaseView";
import BuildingDetailView from "@/features/city/components/BuildingDetailView";
import SimulatorView from "@/features/simulator/SimulatorView";
import ReportsView from "@/features/reports/components/ReportsView";
import type { BuildingName, UnitName } from "@/shared/types";
import type { OutgoingCommand, IncomingCommand } from "@/shared/types";

type MergedCommand =
  | ({ direction: "outgoing" } & OutgoingCommand)
  | ({ direction: "incoming" } & IncomingCommand);

const CANCEL_WINDOW_MS = 5 * 60 * 1000;

function canCancel(cmd: OutgoingCommand, now: number): boolean {
  return now - new Date(cmd.departureAt).getTime() <= CANCEL_WINDOW_MS;
}

export default function CityPage() {
  // Dashboard principal oras: layout 3 coloane (stanga=aparare+comenzi, centru=harta oras, dreapta=unitati).
  // Sub-view-urile (cladiri, baza militara, rapoarte, simulator) inlocuiesc tot continutul
  // prin URL search params — asta inseamna ca browser back/forward merge natural intre view-uri
  // fara management custom de history.
  const navigate = useNavigate();
  const location = useLocation();
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

  // Siege status for the active city — polled at 5s, same cadence as the city overview.
  // Cheap call (1 SELECT + a few JOINs); both attacker and defender share the same endpoint.
  const { data: siegeStatus } = useQuery({
    queryKey: ["siege", city?.id ?? "none"],
    queryFn: () => getSiegeStatus(city!.id),
    enabled: !!city?.id,
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

  // Snapshot-ul "what was already read" la momentul deschiderii listei vine din
  // Layout (care marcheaza totul ca vazut inainte de navigare).
  const navState = location.state as { initiallyRead?: string[] } | null;
  const readSnapshot = new Set<string>(navState?.initiallyRead ?? []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-[#b1bac4]">Loading city...</div>;
  }
  if (error || !city) {
    return (
      <div className="flex items-center justify-center h-full text-[#f85149]">
        Failed to load city.
      </div>
    );
  }

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

  const besieged = !!siegeStatus?.active;

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="flex flex-col h-full overflow-hidden">
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
        /* 3-column main — blocked during siege */
        <>
        {besieged && siegeStatus && <SiegeCard status={siegeStatus} />}
        <div className={`flex flex-1 overflow-hidden ${besieged ? "blur-sm pointer-events-none select-none" : ""}`}>

          {/* LEFT: Air defense + Commands */}
          <div className="flex-1 flex flex-col bg-[#161b22] border-r border-[#30363d] overflow-hidden">

            {/* Air defense + Governor/Hacker row */}
            <div className="h-1/4 min-h-[130px] border-b border-[#30363d] flex shrink-0">

              {/* Air defense (left) */}
              <div
                className="flex-1 p-2.5 border-r border-[#30363d] flex flex-col gap-1.5 cursor-pointer hover:bg-[#1c2129] transition-colors min-w-0"
                onClick={() => openView("building", { name: "AIR_DEFENSE" })}
              >
                <span className="text-[#b1bac4]">
                  <SiegeBadge status={siegeStatus} />
                </span>
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
                      borderLeft:  isOut ? `4px solid ${colors.fg}` : undefined,
                      borderRight: !isOut ? `4px solid ${colors.fg}` : undefined,
                      boxShadow: isIncomingAttack ? "0 0 10px rgba(248,81,73,0.35)" : undefined,
                    }}
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: colors.bg, color: colors.fg }}
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
        </>
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
    </div>
  );
}
