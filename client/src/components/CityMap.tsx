import { useState } from "react";
import type { BuildingName, CityOverview } from "../types/index.ts";
import { BUILDING_DISPLAY } from "../lib/labels.ts";
import { getBuildingLevel } from "../lib/cityHelpers.ts";

interface Hotspot {
  name: BuildingName;
  top: string;    // Poziția unde apare textul (Tooltip)
  left: string;   // Poziția unde apare textul (Tooltip)
  points: string; // Zona clickabilă a clădirii
}

const HOTSPOTS: Hotspot[] = [
  { 
    name: "HEADQUARTERS",    
    top: "47%", left: "50%", 
    points: "47,38 50.3,32 53,36 54,43 60,44 60,53 51,57 42,53 42,44 45,43" 
  },
  { 
    name: "MILITARY_BASE",   
    top: "83%", left: "71%", 
    points: "68,65 100,79 100,100 64,100 38,83" 
  },
  { 
    name: "WEAPONS_FACTORY", 
    top: "50%", left: "90%", 
    points: "72,37 80,35 80,30 92,30 92,35 100,35 100,74 60,58 63,54 73,40" 
  },
  { 
    name: "WAREHOUSE",       
    top: "21%", left: "55%", 
    points: "27,18 61,12 84,18 85,21 49,31 30,27" 
  },
  { 
    name: "HARBOR",          
    top: "10%", left: "80%", 
    points: "72,2 100,2 100,17 95,18 67,13 67,10" 
  },
  { 
    name: "POWER_PLANT",     
    top: "28%", left: "12%", 
    points: "1,20 10,17 21,17 33,33 20,40 1,37" 
  },
  { 
    name: "BANK",            
    top: "42%", left: "34%", 
    points: "27,38 34,35 41,37 41,48 34,50 27,46" 
  },
  { 
    name: "HOUSING",         
    top: "65%", left: "25%", 
    points: "0,52 22,45 62,64 0,99" 
  },
];

interface Props {
  cityName: string;
  city?: CityOverview;
  onBuildingClick?: (name: BuildingName) => void;
}

export default function CityMap({ cityName, city, onBuildingClick }: Props) {
  const [hovered, setHovered] = useState<BuildingName | null>(null);

  return (
    <div className="relative h-full w-auto shrink-0 inline-block overflow-hidden">
      {/* Imaginea Map */}
      <img
        src="/images/city.jpg"
        alt={cityName}
        className="h-full w-auto object-contain object-top block"
        draggable={false}
      />

      {/* SVG Overlay - Doar logică de detecție, fără vizual */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
      >
        {HOTSPOTS.map((spot) => (
          <polygon
            key={`poly-${spot.name}`}
            points={spot.points}
            style={{ pointerEvents: 'auto' }}
            // fill-transparent asigură că poligonul e clickabil, dar invizibil
            className="fill-transparent stroke-transparent cursor-pointer"
            onMouseEnter={() => setHovered(spot.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onBuildingClick?.(spot.name)}
          />
        ))}
      </svg>

      {/* Tooltip-ul cu numele clădirii */}
      {HOTSPOTS.map((spot) => {
        if (hovered !== spot.name) return null;

        return (
          <div
            key={`label-${spot.name}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{ top: spot.top, left: spot.left }}
          >
            <div className="whitespace-nowrap bg-[#161b22]/95 border border-[#e6b800] text-[#e6b800] text-[12px] font-bold px-3 py-1 rounded shadow-xl animate-in fade-in zoom-in duration-150">
              {BUILDING_DISPLAY[spot.name]}
              {city ? ` (${getBuildingLevel(city, spot.name)})` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}