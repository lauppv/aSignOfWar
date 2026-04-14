import type { UnitName } from "../types/index.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";

interface Props {
  name: UnitName;
  total: number;
}

export default function UnitCard({ name, total }: Props) {
  const { openUnit } = useUnitInfo();
  const src = `/images/units/${name.toLowerCase()}.jpg`;

  return (
    <div
      onClick={() => openUnit(name)}
      className="relative aspect-square bg-[#0d1117] rounded border border-[#21262d] overflow-hidden cursor-pointer hover:border-[#484f58] transition-colors"
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <span
        className="absolute bottom-0 right-0 px-1.5 py-0.5 text-xs font-mono font-bold text-[#c9d1d9] bg-black/70 rounded-tl"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
      >
        {total.toLocaleString()}
      </span>
    </div>
  );
}
