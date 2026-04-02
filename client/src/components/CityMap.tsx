import { useState } from "react";
import type { BuildingName } from "../types/index.ts";
import { BUILDING_DISPLAY } from "../lib/labels.ts";

interface Hotspot {
  name: BuildingName;
  top: string;
  left: string;
}

// Ajusteaza top/left (procente) dupa pozitia reala a cladirilor in city.jpg
const HOTSPOTS: Hotspot[] = [
  { name: "HEADQUARTERS",    top: "47%", left: "50%" },
  { name: "BANK",            top: "42%", left: "34%" },
  { name: "POWER_PLANT",     top: "28%", left: "12%" },
  { name: "WEAPONS_FACTORY", top: "50%", left: "90%" },
  { name: "HOUSING",         top: "65%", left: "25%" },
  { name: "WAREHOUSE",       top: "21%", left: "55%" },
  { name: "MILITARY_BASE",   top: "83%", left: "71%" },
  { name: "HARBOR",          top: "10%", left: "80%" },
];

interface Props {
  cityName: string;
  onBuildingClick?: (name: BuildingName) => void;
}

export default function CityMap({ cityName, onBuildingClick }: Props) {
  const [hovered, setHovered] = useState<BuildingName | null>(null);

  return (
    <div className="relative h-full w-auto shrink-0">
      <img
        src="/images/city.jpg"
        alt={cityName}
        className="h-full w-auto object-contain object-top pb-4 block"
        draggable={false}
      />

      {HOTSPOTS.map((spot) => {
        const isHovered = hovered === spot.name;
        return (
          <div
            key={spot.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            style={{ top: spot.top, left: spot.left }}
            onMouseEnter={() => setHovered(spot.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onBuildingClick?.(spot.name)}
          >
            {/* Dot */}
            <div
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                isHovered
                  ? "bg-[#e6b800] border-[#fff8] scale-125 shadow-[0_0_8px_3px_rgba(230,184,0,0.6)]"
                  : "bg-[#e6b80066] border-[#e6b800aa]"
              }`}
              style={{ transform: isHovered ? "scale(1.4)" : "scale(1)", transition: "transform 0.15s, box-shadow 0.15s" }}
            />

            {/* Tooltip */}
            {isHovered && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-[#161b22] border border-[#e6b800] text-[#e6b800] text-[11px] font-semibold px-2 py-0.5 rounded pointer-events-none">
                {BUILDING_DISPLAY[spot.name]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
