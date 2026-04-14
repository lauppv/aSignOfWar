import type { UnitName } from "../types/index.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";
import { UNIT_DISPLAY } from "../lib/labels.ts";

interface Props {
  name: UnitName;
  own: number;
  support: number;
}

export default function UnitCard({ name, own, support }: Props) {
  const { openUnit } = useUnitInfo();
  const src = `/images/units/${name.toLowerCase()}.jpg`;
  const total = own + support;
  const label = UNIT_DISPLAY[name] ?? name;

  return (
    <div className="flex items-center gap-3 p-2 bg-[#0d1117] rounded border border-[#21262d]">
      <img
        src={src}
        alt={label}
        className="w-14 h-14 object-contain rounded shrink-0 cursor-pointer hover:brightness-125 transition-[filter]"
        onClick={() => openUnit(name)}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <span className="flex-1 text-xs text-[#b1bac4] truncate">{label}</span>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-sm font-semibold text-[#e6b800]">{total.toLocaleString()}</span>
        {support > 0 && (
          <span className="text-[10px] text-[#79c0ff]" title="Stationed support">
            +{support.toLocaleString()} support
          </span>
        )}
      </div>
    </div>
  );
}
