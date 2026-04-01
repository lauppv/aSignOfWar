import type { Unit } from "../types/index.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";

const UNIT_DISPLAY: Record<string, string> = {
  LIGHT_INFANTRY:     "Light Infantry",
  DEFENDER_INFANTRY:  "Defender Infantry",
  ANTI_TANK_INFANTRY: "Anti-Tank Infantry",
  SNIPER:             "Sniper",
  SPECIAL_FORCES:     "Special Forces",
  RAIDER:             "Raider",
  TANK:               "Tank",
  MISSILE_LAUNCHER:   "Missile Launcher",
  DRONE:              "Drone",
  GOVERNOR:           "Governor",
};

interface Props {
  unit: Unit;
}

export default function UnitCard({ unit }: Props) {
  const { openUnit } = useUnitInfo();
  const src = `/images/units/${unit.name.toLowerCase()}.jpg`;

  return (
    <div className="flex items-center gap-3 p-2 bg-[#0d1117] rounded border border-[#21262d]">
      <img
        src={src}
        alt={UNIT_DISPLAY[unit.name] ?? unit.name}
        className="w-14 h-14 object-contain rounded shrink-0 cursor-pointer hover:brightness-125 transition-[filter]"
        onClick={() => openUnit(unit.name)}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <span className="flex-1 text-xs text-[#8b949e] truncate">{UNIT_DISPLAY[unit.name] ?? unit.name}</span>
      <span className="text-sm font-semibold text-[#e6b800] shrink-0">{unit.quantity.toLocaleString()}</span>
    </div>
  );
}
