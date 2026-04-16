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
const COLOR_ACTIVE   = "#e85aad"; // roz — orasul propriu selectat (cel activ)
const COLOR_OWN      = "#e3b341"; // galben — celelalte orase proprii
const COLOR_GHOST    = "#e6edf3"; // alb — orase fantoma (fara owner)
const COLOR_ALLIANCE = "#58a6ff"; // albastru — neutilizat momentan
const COLOR_OTHER    = "#8b5e3c"; // maro — alti jucatori

type CityKind = "active" | "own" | "ghost" | "alliance" | "other";

function classify(c: MapCity, ownedIds: Set<string>, activeCityId: string | undefined): CityKind {
  if (c.id === activeCityId) return "active";
  if (ownedIds.has(c.id)) return "own";
  if (!c.owner) return "ghost";
  // TODO: cand avem alianta, return "alliance" daca c.owner.allianceId === myAllianceId
  return "other";
}

function colorFor(kind: CityKind): string {
  switch (kind) {
    case "active":   return COLOR_ACTIVE;
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
  const [cursorCell, setCursorCell] = useState<{ x: number; y: number } | null>(null);
  const [scroll, setScroll] = useState({ left: 0, top: 0, w: 0, h: 0 });
  const [selected, setSelected] = useState<{ city: MapCity; px: number; py: number } | null>(null);
  const [centered, setCentered] = useState(false);
  const [panelOffset, setPanelOffset] = useState({ dx: 0, dy: 0 });
  const panelDragRef = useRef<{ startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState(0);

  useEffect(() => { setPanelOffset({ dx: 0, dy: 0 }); }, [selected?.city.id]);

  // Measure the panel after each render and adjust top so it stays fully on screen
  useEffect(() => {
    if (!selected || !panelRef.current) return;
    const idealTop = selected.py - scroll.top;
    const panelH = panelRef.current.scrollHeight;
    let top = idealTop;
    // Push up if panel overflows the bottom
    if (top + panelH > scroll.h) top = scroll.h - panelH;
    // But never above 0
    if (top < 0) top = 0;
    setPanelTop(top);
  });

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

  // Sync scroll state (pentru rigle de coordonate + panel positioning).
  // Depinde de `map` ca sa re-ruleze dupa ce loading-ul se termina si scrollRef devine disponibil.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setScroll({
      left: el.scrollLeft, top: el.scrollTop, w: el.clientWidth, h: el.clientHeight,
    });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [map]);

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
    if (scrollRef.current && !selected) {
      const rect = scrollRef.current.getBoundingClientRect();
      const worldX = e.clientX - rect.left + scrollRef.current.scrollLeft;
      const worldY = e.clientY - rect.top  + scrollRef.current.scrollTop;
      const cx = Math.floor(worldX / CELL);
      const cy = Math.floor(worldY / CELL);
      if (cx >= 0 && cy >= 0 && cx < (map?.size ?? 0) && cy < (map?.size ?? 0)) {
        if (!cursorCell || cursorCell.x !== cx || cursorCell.y !== cy) {
          setCursorCell({ x: cx, y: cy });
        }
      }
    }
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

  function handleMouseLeaveScroll() {
    endDrag();
    setCursorCell(null);
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

      <div className="relative flex-1">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto select-none"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={handleMouseLeaveScroll}
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
          {cursorCell && !isDragging && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: cursorCell.x * CELL,
                top: cursorCell.y * CELL,
                width: CELL,
                height: CELL,
                outline: "2px solid #58a6ff",
                outlineOffset: -1,
                background: "rgba(88,166,255,0.10)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
              }}
            />
          )}

          {map.cities.map((c) => {
            const kind   = classify(c, ownedCityIds, activeCityId);
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

      {/* City action panel — viewport-relative, aligned with the city row */}
      {selected && (() => {
        const c = selected.city;
        const kind = classify(c, ownedCityIds, activeCityId);

        const PANEL_W = 260;
        const MARGIN = 8;
        // Convert world coords to viewport coords
        let left = selected.px + CELL + MARGIN - scroll.left;
        // Flip to left side if overflows right
        if (left + PANEL_W > scroll.w) left = selected.px - PANEL_W - MARGIN - scroll.left;

        return (
          <div
            ref={panelRef}
            className="absolute z-10 bg-[#161b22] border border-[#30363d] rounded shadow-2xl overflow-y-auto"
            style={{
              left: left + panelOffset.dx,
              top: panelTop + panelOffset.dy,
              width: PANEL_W,
              maxHeight: scroll.h - panelTop,
            }}
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

      {/* Rigle de coordonate (stil Triburile) */}
      {(() => {
        const RULER_W = 28;
        const RULER_H = 20;
        const startX = Math.max(0, Math.floor(scroll.left / CELL));
        const endX   = Math.min(map.size - 1, Math.ceil((scroll.left + scroll.w) / CELL));
        const startY = Math.max(0, Math.floor(scroll.top  / CELL));
        const endY   = Math.min(map.size - 1, Math.ceil((scroll.top  + scroll.h) / CELL));
        const xs: number[] = [];
        for (let i = startX; i <= endX; i++) xs.push(i);
        const ys: number[] = [];
        for (let i = startY; i <= endY; i++) ys.push(i);
        return (
          <>
            {/* Left ruler (Y) */}
            <div
              className="absolute top-0 left-0 pointer-events-none bg-[#161b22] border-r border-[#30363d] overflow-hidden"
              style={{ width: RULER_W, height: scroll.h - RULER_H }}
            >
              {ys.map(y => {
                const isHot = cursorCell?.y === y;
                return (
                  <div
                    key={y}
                    className="absolute w-full flex items-center justify-center font-mono"
                    style={{
                      top: y * CELL - scroll.top,
                      height: CELL,
                      fontSize: 11,
                      fontWeight: isHot ? 700 : 500,
                      color: isHot ? "#0d1117" : "#b1bac4",
                      background: isHot ? "#58a6ff" : undefined,
                    }}
                  >
                    {y}
                  </div>
                );
              })}
            </div>

            {/* Bottom ruler (X) */}
            <div
              className="absolute left-0 bottom-0 pointer-events-none bg-[#161b22] border-t border-[#30363d] overflow-hidden"
              style={{ height: RULER_H, width: scroll.w }}
            >
              {xs.map(x => {
                const isHot = cursorCell?.x === x;
                return (
                  <div
                    key={x}
                    className="absolute h-full flex items-center justify-center font-mono"
                    style={{
                      left: x * CELL - scroll.left,
                      width: CELL,
                      fontSize: 11,
                      fontWeight: isHot ? 700 : 500,
                      color: isHot ? "#0d1117" : "#b1bac4",
                      background: isHot ? "#58a6ff" : undefined,
                    }}
                  >
                    {x}
                  </div>
                );
              })}
            </div>

            {/* Corner */}
            <div
              className="absolute left-0 bottom-0 bg-[#161b22] border-t border-r border-[#30363d] pointer-events-none flex items-center justify-center font-mono"
              style={{ width: RULER_W, height: RULER_H, fontSize: 10, color: "#58a6ff" }}
            >
              {cursorCell ? `${cursorCell.x},${cursorCell.y}` : ""}
            </div>
          </>
        );
      })()}
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
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_ACTIVE }} /> active</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OWN }} /> mine</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border border-[#484f58]" style={{ background: COLOR_GHOST }} /> ghost</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OTHER }} /> other</span>
        </div>
      </div>
    </div>
  );
}
