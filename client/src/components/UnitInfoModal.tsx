import type { UnitName } from "../types/index.ts";
import { UNITS } from "../lib/gameConfig.ts";

const UNIT_DISPLAY: Record<UnitName, string> = {
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

const CATEGORY_LABEL: Record<string, string> = {
  INFANTRY:   "Infantry",
  RANGE:      "Range",
  MECHANIZED: "Mechanized",
  SIEGE:      "Siege",
  CONQUER:    "Conquer",
};

interface Props {
  name: UnitName;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-xs py-0.5 border-b border-[#21262d]">
      <span className="text-[#8b949e]">{label}</span>
      <span className="text-[#c9d1d9] font-medium">{value}</span>
    </div>
  );
}

export default function UnitInfoModal({ name, onClose }: Props) {
  const cfg = UNITS[name];
  const displayName = UNIT_DISPLAY[name];
  const src = `/images/units/${name.toLowerCase()}.jpg`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-lg w-[21vw] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-2 pb-2 px-2 border-b border-[#30363d]">
          <img
            src={src}
            alt={displayName}
            className="w-[20vw] h-[20vw] object-contain rounded"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <div className="mt-1.5 text-center">
            <div className="text-sm font-semibold text-[#e6b800]">{displayName}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mt-0.5">{CATEGORY_LABEL[cfg.category]}</div>
          </div>
        </div>

        <div className="px-2 py-1.5 flex flex-col gap-1.5">
          {/* Combat */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-1">Combat</div>
            <Row label="Attack"                value={cfg.attack} />
            <Row label="Defense vs Infantry"   value={cfg.defenseVsInfantry} />
            <Row label="Defense vs Mechanized" value={cfg.defenseVsMechanized} />
            <Row label="Defense vs Range"      value={cfg.defenseVsRange} />
            {cfg.airDefenseDamage != null && <Row label="Air Defense Damage" value={cfg.airDefenseDamage} />}
            {cfg.buildingDamage    != null && <Row label="Building Damage"   value={`${cfg.buildingDamage}%`} />}
          </div>

          {/* Movement */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-1">Movement</div>
            <Row label="Speed" value={`${cfg.speed} min/tile`} />
            <Row label="Carry" value={cfg.carry} />
          </div>

          {/* Cost */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-1">Cost</div>
            <Row label="Money"      value={cfg.costMoney} />
            <Row label="Energy"     value={cfg.costEnergy} />
            <Row label="Ammo"       value={cfg.costAmmo} />
            <Row label="Population" value={cfg.population} />
          </div>

          {/* Requirements */}
          {(cfg.requiresHQ != null || cfg.requiresMilitaryBase != null) && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#58a6ff] mb-1">Requires</div>
              {cfg.requiresHQ           != null && <Row label="HQ level"            value={cfg.requiresHQ} />}
              {cfg.requiresMilitaryBase != null && <Row label="Military Base level" value={cfg.requiresMilitaryBase} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
