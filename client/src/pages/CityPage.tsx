import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMyCity } from "../api/city.ts";
import { getCityCommands } from "../api/command.ts";
import { logout } from "../api/auth.ts";
import {
  computePopulation,
  getBuildingLevel,
  getMaxPopulation,
  getWarehouseCapacity,
  getAirDefenseBonus,
} from "../lib/gameConfig.ts";
import ResourceBar from "../components/ResourceBar.tsx";
import UnitCard from "../components/UnitCard.tsx";
import type { OutgoingCommand, IncomingCommand } from "../types/index.ts";

type MergedCommand =
  | ({ direction: "outgoing" } & OutgoingCommand)
  | ({ direction: "incoming" } & IncomingCommand);

const CMD_COLORS = {
  ATTACK:    { border: "#f85149", badgeBg: "#3d1a1a", badgeText: "#f85149" },
  SUPPORT:   { border: "#3fb950", badgeBg: "#1a3d1a", badgeText: "#3fb950" },
  RESOURCES: { border: "#d29922", badgeBg: "#3d2e0a", badgeText: "#d29922" },
};

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

  const { data: city, error, isLoading } = useQuery({
    queryKey: ["city"],
    queryFn: getMyCity,
    refetchInterval: 5000,
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
    return <div className="flex items-center justify-center h-screen text-[#8b949e]">Loading city...</div>;
  }
  if (error || !city) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-[#f85149]">
        Failed to load city.
        <button onClick={handleLogout} className="text-sm text-[#8b949e] border border-[#30363d] rounded px-3 py-1">Logout</button>
      </div>
    );
  }

  const population        = computePopulation(city);
  const maxPopulation     = getMaxPopulation(getBuildingLevel(city, "HOUSING"));
  const warehouseCapacity = getWarehouseCapacity(getBuildingLevel(city, "WAREHOUSE"));
  const airDefenseLevel   = getBuildingLevel(city, "AIR_DEFENSE");
  const airDefenseBonus   = getAirDefenseBonus(airDefenseLevel);
  const activeUnits       = city.units.filter((u) => u.quantity > 0);

  const mergedCommands: MergedCommand[] = [
    ...(commands?.outgoing.map((c) => ({ ...c, direction: "outgoing" as const })) ?? []),
    ...(commands?.incoming.map((c) => ({ ...c, direction: "incoming" as const })) ?? []),
  ].sort((a, b) => new Date(a.arrivalAt).getTime() - new Date(b.arrivalAt).getTime());

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-1.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <h1 className="text-base text-[#e6b800] tracking-wider">{city.name}</h1>
        <button
          onClick={handleLogout}
          className="text-xs text-[#8b949e] border border-[#30363d] rounded px-2.5 py-1 hover:border-[#f85149] hover:text-[#f85149] cursor-pointer"
        >
          Logout
        </button>
      </header>

      <ResourceBar
        money={city.money}
        energy={city.energy}
        ammo={city.ammo}
        capacity={warehouseCapacity}
        population={population}
        maxPopulation={maxPopulation}
      />

      {/* 3-column main */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Air Defense + Commands */}
        <div className="flex-1 flex flex-col bg-[#161b22] border-r border-[#30363d] overflow-hidden">

          {/* Air Defense */}
          <div className="h-1/4 min-h-[130px] p-2.5 border-b border-[#30363d] flex flex-col gap-1.5 shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-[#8b949e]">Air Defense</span>
            <img
              src="/images/buildings/air_defense.jpg"
              alt="Air Defense"
              className="w-full flex-1 min-h-0 object-contain rounded"
            />
            <div className="flex justify-between text-xs">
              <span className="text-[#c9d1d9]">Lvl {airDefenseLevel}</span>
              <span className="text-[#3fb950] font-semibold">+{airDefenseBonus}% def</span>
            </div>
          </div>

          {/* Commands */}
          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-[#8b949e] shrink-0">Commands</span>
            {mergedCommands.length === 0 && (
              <span className="text-[11px] text-[#484f58] text-center mt-2">No active commands</span>
            )}
            {mergedCommands.map((cmd) => {
              const isOut = cmd.direction === "outgoing";
              const cityName = isOut
                ? (cmd as OutgoingCommand & { direction: "outgoing" }).toCity.name
                : (cmd as IncomingCommand & { direction: "incoming" }).fromCity.name;
              const username = isOut
                ? (cmd as OutgoingCommand & { direction: "outgoing" }).toCity.owner.username
                : (cmd as IncomingCommand & { direction: "incoming" }).fromCity.owner.username;
              const colors = CMD_COLORS[cmd.type];

              return (
                <div
                  key={cmd.id}
                  className="p-1.5 rounded bg-[#0d1117] border-l-[3px] flex flex-col gap-0.5 shrink-0"
                  style={{ borderLeftColor: colors.border }}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      style={{ background: colors.badgeBg, color: colors.badgeText }}
                    >
                      {cmd.type}
                    </span>
                    <span className="text-[9px] text-[#484f58]">{isOut ? "▶ OUT" : "◀ IN"}</span>
                  </div>
                  <span className="text-[11px] text-[#8b949e] truncate">{cityName} ({username})</span>
                  <span className="text-[10px] text-[#484f58]">⏱ {fmtArrival(cmd.arrivalAt)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER: City image */}
        <img
          src="/images/city.jpg"
          alt={city.name}
          className="shrink-0 h-full w-auto object-contain object-top pb-4"
        />

        {/* RIGHT: Units */}
        <div className="flex-1 bg-[#161b22] border-l border-[#30363d] overflow-y-auto p-2.5 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-[#8b949e] shrink-0">Units in city</span>
          {activeUnits.length === 0 && (
            <span className="text-[11px] text-[#484f58] text-center mt-2">No units</span>
          )}
          {activeUnits.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>

      </div>
    </div>
  );
}
