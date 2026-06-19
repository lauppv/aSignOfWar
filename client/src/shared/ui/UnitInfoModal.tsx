import type { UnitName } from "@/shared/types";
import { UNITS } from "@shared/gameConfig.ts";
import { UNIT_DISPLAY, UNIT_DESCRIPTION, CATEGORY_LABEL } from "@/shared/lib/labels";

interface Props {
  name: UnitName;
  onClose: () => void;
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between text-xs py-0.5 border-b border-[#21262d]">
      <span className="text-[#b1bac4]" style={color ? { color } : undefined}>{label}</span>
      <span className="text-[#c9d1d9] font-medium" style={color ? { color } : undefined}>{value}</span>
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
            <div className="text-[11px] text-[#b1bac4] mt-1.5 leading-relaxed italic">{UNIT_DESCRIPTION[name]}</div>
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
            {cfg.airDefenseDamage != null && <Row label="Air defense damage" value={cfg.airDefenseDamage} />}
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
            <Row label="Money"      value={cfg.costMoney}  color="#7ee787" />
            <Row label="Energy"     value={cfg.costEnergy} color="#79c0ff" />
            <Row label="Ammo"       value={cfg.costAmmo}   color="#e3b341" />
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
