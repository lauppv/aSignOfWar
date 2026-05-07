import { UNIT_DISPLAY } from "../lib/labels";
import type { UnitName } from "../types/index";

interface UnitIconProps {
  name: UnitName | string;
  quantity?: number;
  size?: number;
}

export default function UnitIcon({ name, quantity, size = 28 }: UnitIconProps) {
  const slug = name.toLowerCase();
  const label = UNIT_DISPLAY[name as UnitName] ?? name;

  return (
    <div className="flex items-center gap-1.5 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-1">
      <img
        src={`/images/units/${slug}.jpg`}
        alt={label}
        title={label}
        className="rounded"
        style={{ width: size, height: size, objectFit: "cover" }}
      />
      {quantity !== undefined && (
        <span className="text-[#c9d1d9] font-semibold text-[12px] font-mono">{quantity}</span>
      )}
    </div>
  );
}
