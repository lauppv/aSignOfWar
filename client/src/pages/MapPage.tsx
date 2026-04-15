import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { getMap } from "../api/map.ts";
import { getMyCity } from "../api/city.ts";
import { getActiveCityId, setActiveCityId } from "../api/client.ts";
import type { MapCity } from "../types/index.ts";
import CityActionPanel from "../components/CityActionPanel.tsx";

const CELL = 80; // pixeli per celula → 100x100 = 8000x8000 px
const GRID_LINE = "#21262d";

// Paleta orase pe harta. Alianta ramane TODO pana cand modelam Alliance.
const COLOR_OWN      = "#e3b341"; // galben
const COLOR_GHOST    = "#e6edf3"; // alb-gri (contrast bun pe fundalul intunecat)
const COLOR_ALLIANCE = "#58a6ff"; // albastru — neutilizat momentan
const COLOR_OTHER    = "#7a1f2b"; // visiniu

type CityKind = "own" | "ghost" | "alliance" | "other";

function classify(c: MapCity, ownedIds: Set<string>): CityKind {
  if (ownedIds.has(c.id)) return "own";
  if (!c.owner) return "ghost";
  // TODO: cand avem alianta, return "alliance" daca c.owner.allianceId === myAllianceId
  return "other";
}

function colorFor(kind: CityKind): string {
  switch (kind) {
    case "own":      return COLOR_OWN;
    case "ghost":    return COLOR_GHOST;
    case "alliance": return COLOR_ALLIANCE;
    case "other":    return COLOR_OTHER;
  }
}

function spriteFor(points: number): string {
  if (points >= 9000) return "/images/map/9000-max.jpg";
  if (points >= 3000) return "/images/map/3000-8999.jpg";
  if (points >= 1000) return "/images/map/1000-2999.jpg";
  if (points >= 300)  return "/images/map/300-999.jpg";
  return "/images/map/0-299.jpg";
}

export default function MapPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCityId, setActiveCityIdState] = useState<string | undefined>(() => getActiveCityId() ?? undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [selected, setSelected] = useState<{ city: MapCity; px: number; py: number } | null>(null);
  const [centered, setCentered] = useState(false);
  const [panelOffset, setPanelOffset] = useState({ dx: 0, dy: 0 });
  const panelDragRef = useRef<{ startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);

  useEffect(() => { setPanelOffset({ dx: 0, dy: 0 }); }, [selected?.city.id]);

  function handlePanelHeaderMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    panelDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseDx: panelOffset.dx,
      baseDy: panelOffset.dy,
    };
    const onMove = (ev: MouseEvent) => {
      if (!panelDragRef.current) return;
      setPanelOffset({
        dx: panelDragRef.current.baseDx + (ev.clientX - panelDragRef.current.startX),
        dy: panelDragRef.current.baseDy + (ev.clientY - panelDragRef.current.startY),
      });
    };
    const onUp = () => {
      panelDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const { data: map, isLoading, error } = useQuery({
    queryKey: ["map"],
    queryFn: getMap,
    refetchInterval: 15000,
  });

  const { data: myCity } = useQuery({
    queryKey: ["city", activeCityId ?? "default"],
    queryFn: () => getMyCity(activeCityId),
  });

  function handleSelectCity(cityId: string) {
    setActiveCityId(cityId);
    setActiveCityIdState(cityId);
    queryClient.invalidateQueries({ queryKey: ["city"] });
    queryClient.invalidateQueries({ queryKey: ["commands"] });
    setSelected(null);
  }

  const ownedCityIds = new Set(myCity?.ownedCities?.map((c) => c.id) ?? []);

  // Centreaza viewport-ul pe orasul propriu la primul load
  useEffect(() => {
    if (centered || !map || !myCity || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = myCity.x * CELL + CELL / 2 - el.clientWidth / 2;
    el.scrollTop  = myCity.y * CELL + CELL / 2 - el.clientHeight / 2;
    setCentered(true);
  }, [map, myCity, centered]);

  function handleMouseDown(e: React.MouseEvent) {
    if (!scrollRef.current) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
    };
    setIsDragging(true);
    setHasDragged(false);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragState.current || !scrollRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) setHasDragged(true);
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - dx;
    scrollRef.current.scrollTop  = dragState.current.scrollTop  - dy;
  }

  function endDrag() {
    dragState.current = null;
    setIsDragging(false);
  }

  // Inchide panel-ul de click pe Escape
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-[#b1bac4]">Loading map...</div>;
  }
  if (error || !map) {
    return <div className="flex items-center justify-center h-screen text-[#f85149]">Failed to load map.</div>;
  }

  const worldPx = map.size * CELL;
  const hovered = hover ? map.cities.find(c => c.x === hover.x && c.y === hover.y) ?? null : null;

  // Background grid via repeating gradients — fara mii de DOM nodes
  const gridBg = `
    repeating-linear-gradient(0deg,  ${GRID_LINE} 0 1px, transparent 1px ${CELL}px),
    repeating-linear-gradient(90deg, ${GRID_LINE} 0 1px, transparent 1px ${CELL}px)
  `;

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex items-center justify-between p-3 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <span className="text-sm uppercase tracking-widest text-[#b1bac4]">World map ({map.size}×{map.size})</span>
        <div className="flex gap-2">
          {myCity && (
            <button
              onClick={() => {
                if (!scrollRef.current) return;
                scrollRef.current.scrollLeft = myCity.x * CELL + CELL / 2 - scrollRef.current.clientWidth / 2;
                scrollRef.current.scrollTop  = myCity.y * CELL + CELL / 2 - scrollRef.current.clientHeight / 2;
              }}
              className="text-xs border border-[#30363d] rounded px-3 py-1 hover:bg-[#1c2129]"
            >
              ⌖ My city
            </button>
          )}
          <button
            onClick={() => navigate(myCity?.id ? `/city?cityId=${encodeURIComponent(myCity.id)}` : "/city")}
            className="text-xs border border-[#30363d] rounded px-3 py-1 hover:bg-[#1c2129]"
          >
            ← Back to city
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto select-none"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <div
          className="relative"
          style={{
            width: worldPx,
            height: worldPx,
            background: `${gridBg}, #0d1117`,
          }}
          onClick={() => { if (!hasDragged) setSelected(null); }}
        >
          {selected && (() => {
            const c = selected.city;
            const kind = classify(c, ownedCityIds);

            const PANEL_W = 260;
            const PANEL_H = 320;
            let left = selected.px + CELL + 8;
            let top = selected.py;
            if (left + PANEL_W > worldPx) left = selected.px - PANEL_W - 8;
            if (top + PANEL_H > worldPx) top = worldPx - PANEL_H - 8;
            if (top < 0) top = 0;

            return (
              <div
                className="absolute z-10 bg-[#161b22] border border-[#30363d] rounded shadow-2xl"
                style={{ left: left + panelOffset.dx, top: top + panelOffset.dy, width: PANEL_W }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <CityActionPanel
                  city={c}
                  myCity={myCity}
                  headerColor={colorFor(kind)}
                  kindLabel={kind}
                  onClose={() => setSelected(null)}
                  onHeaderMouseDown={handlePanelHeaderMouseDown}
                  isOwnedByMe={ownedCityIds.has(c.id)}
                  onSelectCity={handleSelectCity}
                  onEnterCity={(cityId) => navigate(`/city?cityId=${encodeURIComponent(cityId)}`)}
                />
              </div>
            );
          })()}

          {map.cities.map((c) => {
            const kind   = classify(c, ownedCityIds);
            const accent = colorFor(kind);
            const sprite = spriteFor(c.points);
            return (
              <div
                key={c.id}
                onMouseEnter={() => setHover({ x: c.x, y: c.y, px: c.x * CELL, py: c.y * CELL })}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  if (hasDragged) {
                    e.stopPropagation();
                    return;
                  }
                  e.stopPropagation();
                  setSelected({ city: c, px: c.x * CELL, py: c.y * CELL });
                }}
                className="absolute rounded-sm"
                style={{
                  left: c.x * CELL + 2,
                  top: c.y * CELL + 2,
                  width: CELL - 4,
                  height: CELL - 4,
                  outline: `2px solid ${accent}`,
                  outlineOffset: -2,
                  boxShadow: kind === "own" ? `0 0 12px ${accent}` : `0 0 4px rgba(0,0,0,0.6)`,
                  cursor: isDragging ? "grabbing" : "pointer",
                }}
              >
                <img
                  src={sprite}
                  alt={c.name}
                  draggable={false}
                  className="w-full h-full object-cover rounded-sm pointer-events-none"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#30363d] bg-[#161b22] px-3 py-2 text-xs h-10 shrink-0 flex items-center justify-between gap-4">
        <div>
          {hovered ? (
            <span>
              <span className="text-[#c9d1d9] font-semibold">{hovered.name}</span>
              <span className="text-[#b1bac4]">
                {" · "}
                {hovered.owner ? hovered.owner.username : "Ghost city"}
                {" · "}({hovered.x},{hovered.y})
              </span>
            </span>
          ) : (
            <span className="text-[#7d8590]">Drag to pan · hover a city for details</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[#b1bac4]">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OWN }} /> mine</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border border-[#484f58]" style={{ background: COLOR_GHOST }} /> ghost</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OTHER }} /> other</span>
        </div>
      </div>
    </div>
  );
}
