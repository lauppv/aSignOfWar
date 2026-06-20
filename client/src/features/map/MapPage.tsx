import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState, useMemo } from "react";
import { getMap } from "@/features/map/api/map";
import { getMyCity } from "@/features/city/api/city";
import { getMyAlliance } from "@/features/alliance/api/alliance";
import { getActiveCityId, setActiveCityId } from "@/shared/api/client";
import type { MapCity } from "@/shared/types";
import CityActionPanel from "@/features/city/components/CityActionPanel";

// Side of one map cell (px). Used everywhere: city positioning,
// ruler sizing, the background grid, cursor hit-testing.
const CELL = 80;
// Color of the grid lines overlaid on the map's "grass.jpg" image.
const GRID_LINE = "#3d660e";

// Palette for city outlines on the map - each color also appears in the legend
// in the map's bottom-bar (bottom-left). The order here = the order in the legend.
const COLOR_ACTIVE   = "#e85aad"; // the city the player has selected as "active"
const COLOR_OWN      = "#e3b341"; // the player's other cities (non-active)
const COLOR_GHOST    = "#ffffff"; // ghost cities (no owner) - can be conquered
const COLOR_ALLIANCE = "#58a6ff"; // cities of alliance members
const COLOR_OTHER    = "#7125b8"; // the rest of the players (potential opponents)

// Classification of a city from the current player's perspective - determines
// the outline color, the glow, and the buttons available in CityActionPanel.
type CityKind = "active" | "own" | "ghost" | "alliance" | "other";
// The terrain type of a cell that does NOT contain a city (see getTileInfo).
type TileType = "forest" | "mountain" | "lake" | "grass";

// Decides which category a city gets on the map. The branch order matters:
// "active" beats "own" (the active city IS mine, but we want it in the distinct
// pink color), and "alliance" is only checked if the city has an owner.
function classify(
  c: MapCity,
  ownedIds: Set<string>,
  activeCityId: string | undefined,
  myAllianceId: string | null | undefined,
): CityKind {
  if (c.id === activeCityId) return "active";
  if (ownedIds.has(c.id)) return "own";
  if (!c.owner) return "ghost";
  if (myAllianceId && c.owner.allianceId === myAllianceId) return "alliance";
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

// Picks the city illustration based on score (points = sum of the building
// points). The thresholds are purely visual - a small city looks like a village,
// one at 9000+ looks like a metropolis. They must be kept in sync with the
// images in /public/images/map/.
function spriteFor(points: number): string {
  if (points >= 9000) return "/images/map/9000-max.jpg";
  if (points >= 3000) return "/images/map/3000-8999.jpg";
  if (points >= 1000) return "/images/map/1000-2999.jpg";
  if (points >= 300)  return "/images/map/300-999.jpg";
  return "/images/map/0-299.jpg";
}

// Deterministic hash (x, y) -> [0,1). Used ONLY for the map decoration, so the
// terrain is the same on every refresh without being stored on the server.
function getPseudoRandom(x: number, y: number) {
  const dot = x * 12.9898 + y * 78.233;
  const val = Math.sin(dot) * 43758.5453123;
  return val - Math.floor(val);
}

// Splits empty cells into terrain types for decoration. The distribution:
// 5% mountain, 5% lake, 30% forest, 60% grass. It has no gameplay effect - only
// visual (grass is rendered via the grid background, the rest via images).
// Deterministic pseudo-random terrain: a tile's appearance is derived from its coordinates via a
// hash function, so the same (x,y) always produces the same tile. No server state is needed
// for terrain — it's purely cosmetic. The hash avoids storing a 200x200 grid in memory.
function getTileInfo(x: number, y: number) {
  const rand = getPseudoRandom(x, y);
  const seed = rand * 100;

  let type: TileType = "grass";
  if (seed < 5) type = "mountain";
  else if (seed < 10) type = "lake";
  else if (seed < 40) type = "forest";

  return { type };
}

// The /map screen - a large scrollable map with all the cities in the world.
// It has X/Y rulers on the left and bottom, and a bottom-bar with the color legend +
// the "Center city" / "Enter current city" buttons. Clicking a city opens
// CityActionPanel (the floating panel with info and Attack/Support/etc. buttons).
export default function MapPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  // The player's "active" city - the one whose resources are shown in the
  // header and from which commands depart. Persisted in localStorage via
  // api/client.ts so it survives a refresh.
  const [activeCityId, setActiveCityIdState] = useState<string | undefined>(() => getActiveCityId() ?? undefined);

  useEffect(() => {
    const handler = (e: Event) => setActiveCityIdState((e as CustomEvent).detail);
    window.addEventListener("activeCityChanged", handler);
    return () => window.removeEventListener("activeCityChanged", handler);
  }, []);

  // The map's scrollable container (the div with overflow:auto).
  const scrollRef = useRef<HTMLDivElement>(null);
  // Mouse-pan state on the map (null = no active drag).
  const dragState = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Flag to distinguish "click" from "drag over a city": if the user dragged
  // the mouse >4px we no longer treat the event as a selection.
  const [hasDragged, setHasDragged] = useState(false);
  // The cell the cursor is over (map coordinates x,y, not pixels). Used
  // for the blue highlight rectangle and for the coordinates in the
  // bottom-left corner (the rulers' intersection).
  const [cursorCell, setCursorCell] = useState<{ x: number; y: number } | null>(null);
  // Snapshot of the scrollable viewport. Used to render only the rulers
  // and terrain tiles that are visible, not all 100x100 cells.
  const [scroll, setScroll] = useState({ left: 0, top: 0, w: 0, h: 0 });
  // The city the user clicked (null = no panel open).
  // px/py = the pixel position of the top-left corner, so we can place
  // CityActionPanel right next to it.
  const [selected, setSelected] = useState<{ city: MapCity; px: number; py: number } | null>(null);
  // One-shot flag - the first load centers the map on the player's city.
  const [centered, setCentered] = useState(false);
  // The cumulative offset of CityActionPanel from its default position (comes from
  // dragging the panel's header). Reset when the selected city changes.
  const [panelOffset, setPanelOffset] = useState({ dx: 0, dy: 0 });
  const panelDragRef = useRef<{ startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The Y coordinate (px, relative to the viewport) where CityActionPanel starts.
  // Recalculated from the panel's real height so it doesn't go outside the
  // viewport when the selected city is far down in the scroll.
  const [panelTop, setPanelTop] = useState(0);

  // When the user selects another city, the panel "returns home" (forgets the drag).
  useEffect(() => { setPanelOffset({ dx: 0, dy: 0 }); }, [selected?.city.id]);

  // Computes CityActionPanel's Y: ideally at the same Y as the selected city,
  // but "anchored" so it doesn't go over the bottom-bar or past the top edge.
  // Runs after every render to catch content changes (e.g.
  // when the panel grows because the city receives stationed units).
  useEffect(() => {
    if (!selected || !panelRef.current) return;
    const idealTop = selected.py - scroll.top;
    const panelH = panelRef.current.scrollHeight;
    let top = idealTop;
    if (top + panelH > scroll.h) top = scroll.h - panelH;
    if (top < 0) top = 0;
    setPanelTop(top);
  });

  // Mouse-down on CityActionPanel's header = start dragging the panel.
  // Attaches global listeners on window so we can drag beyond the
  // panel's edge. They detach themselves on mouseup.
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

  // All cities on the map (including ghosts). Polled at 15s so the
  // points/ownership update after other players attack or grow.
  const { data: map, isLoading, error } = useQuery({
    queryKey: ["map"],
    queryFn: getMap,
    refetchInterval: 15000,
  });

  // The active city's data - we need it here for: the "Center city" button,
  // the "Enter current city" button, and to mark all of the player's own
  // cities with COLOR_OWN (via myCity.ownedCities).
  const { data: myCity } = useQuery({
    queryKey: ["city", activeCityId ?? "default"],
    queryFn: () => getMyCity(activeCityId),
  });

  // The player's alliance - used ONLY to know which cities to color with
  // COLOR_ALLIANCE. If not in any alliance, no city falls into the
  // "alliance" category (see the classify function above).
  const { data: myAlliance } = useQuery({
    queryKey: ["alliance", "me"],
    queryFn: getMyAlliance,
  });
  const myAllianceId = myAlliance?.id ?? null;

  // Clicking the "Select" button in CityActionPanel = change the active city
  // without leaving the map (the user stays on /map). Invalidates queries so the
  // resource header and commands re-fetch for the new city.
  function handleSelectCity(cityId: string) {
    setActiveCityId(cityId);
    setActiveCityIdState(cityId);
    queryClient.invalidateQueries({ queryKey: ["city"] });
    queryClient.invalidateQueries({ queryKey: ["commands"] });
    setSelected(null);
  }

  // A set with the ids of ALL the player's cities (not just the active one). If
  // you have only 1 city, the set has 1 element. Used in classify().
  const ownedCityIds = new Set(myCity?.ownedCities?.map((c) => c.id) ?? []);

  // Syncs the `scroll` state with the scrollable container (position +
  // size). Runs on scroll and on resize (ResizeObserver). Triggers
  // re-computation of the visible tiles and the rulers.
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

  // Auto-center: on the first load, positions the player's city in the middle of
  // the viewport. Runs only once (the `centered` flag) so it doesn't undo
  // the user's manual scroll on re-fetches.
  useEffect(() => {
    if (centered || !map || !myCity || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = myCity.x * CELL + CELL / 2 - el.clientWidth / 2;
    el.scrollTop  = myCity.y * CELL + CELL / 2 - el.clientHeight / 2;
    setCentered(true);
  }, [map, myCity, centered]);

  // Deep-link: /map?selectCityId=<id> — centers the map on the given city and opens the panel.
  // Used from reports and the player profile so you can attack/support directly from there.
  const selectCityIdParam = searchParams.get("selectCityId");
  useEffect(() => {
    if (!selectCityIdParam || !map || !scrollRef.current) return;
    const city = map.cities.find(c => c.id === selectCityIdParam);
    if (!city) return;
    const el = scrollRef.current;
    el.scrollLeft = city.x * CELL + CELL / 2 - el.clientWidth / 2;
    el.scrollTop  = city.y * CELL + CELL / 2 - el.clientHeight / 2;
    setSelected({ city, px: city.x * CELL, py: city.y * CELL });
    setCentered(true);
    // Remove the param from the URL so it doesn't re-select on re-render
    const next = new URLSearchParams(searchParams);
    next.delete("selectCityId");
    setSearchParams(next, { replace: true });
  }, [selectCityIdParam, map]);

  // A set with the "x,y" keys of all cells occupied by cities - used so we
  // do NOT draw a terrain tile (forest/lake/mountain) over a city.
  const citySlots = useMemo(() => {
    if (!map) return new Set<string>();
    return new Set(map.cities.map(c => `${c.x},${c.y}`));
  }, [map]);

  // Computes the "special" (non-grass) terrain tiles ONLY for the visible
  // area + 1 cell margin. Without this we'd render 100x100=10k divs. On
  // scroll it recomputes naturally through the dependency on `scroll.*`.
  // I render only the tiles visible in the viewport — without this, 200x200 = 40,000 DOM
  // elements would kill the browser. I compute the visible range from the scroll position and add
  // a 2-cell buffer on each side for smooth scrolling.
  const visibleSpecialTiles = useMemo(() => {
    if (!map) return [];
    const tiles = [];
    const margin = 1;
    const startX = Math.max(0, Math.floor(scroll.left / CELL) - margin);
    const endX   = Math.min(map.size - 1, Math.ceil((scroll.left + scroll.w) / CELL) + margin);
    const startY = Math.max(0, Math.floor(scroll.top  / CELL) - margin);
    const endY   = Math.min(map.size - 1, Math.ceil((scroll.top  + scroll.h) / CELL) + margin);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        if (!citySlots.has(`${x},${y}`)) {
          const info = getTileInfo(x, y);
          if (info.type !== "grass") {
            tiles.push({ x, y, ...info });
          }
        }
      }
    }
    return tiles;
  }, [scroll.left, scroll.top, scroll.w, scroll.h, map, citySlots]);

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
  //const hovered = hover ? map.cities.find(c => c.x === hover.x && c.y === hover.y) ?? null : null;

  const gridBg = `
    repeating-linear-gradient(0deg,  ${GRID_LINE} 0 1px, transparent 1px ${CELL}px),
    repeating-linear-gradient(90deg, ${GRID_LINE} 0 1px, transparent 1px ${CELL}px)
  `;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9]">
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
            backgroundImage: `${gridBg}, url("/images/map/grass.jpg")`,
            backgroundSize: `${CELL}px ${CELL}px`,
            backgroundRepeat: "repeat",
            backgroundColor: "#299945",
          }}
          onClick={() => { if (!hasDragged) setSelected(null); }}
        >
          {/* Special terrain tiles (deterministic per-cell) */}
          {visibleSpecialTiles.map((t: any) => (
            <div
              key={`${t.type}-${t.x}-${t.y}`}
              className="absolute pointer-events-none"
              style={{
                left: t.x * CELL + 1,
                top: t.y * CELL + 1,
                width: CELL - 2,
                height: CELL - 2,
                overflow: 'hidden',
              }}
            >
              <img
                src={`/images/map/${t.type}.jpg`}
                alt=""
                className="w-full h-full object-cover opacity-90"
              />
            </div>
          ))}

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
                background: "rgba(28, 126, 66, 0.1)",
                zIndex: 5
              }}
            />
          )}

          {map.cities.map((c) => {
            const kind   = classify(c, ownedCityIds, activeCityId, myAllianceId);
            const accent = colorFor(kind);
            const sprite = spriteFor(c.points);
            return (
              <div
                key={c.id}
                // onMouseEnter={() => setHover({ x: c.x, y: c.y, px: c.x * CELL, py: c.y * CELL })}
                // onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  if (hasDragged) {
                    e.stopPropagation();
                    return;
                  }
                  e.stopPropagation();
                  setSelected({ city: c, px: c.x * CELL, py: c.y * CELL });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (ownedCityIds.has(c.id)) {
                    navigate(`/city?cityId=${encodeURIComponent(c.id)}`);
                  }
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
                  backgroundColor: "#161b22",
                  zIndex: 10
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

      {selected && (() => {
        const c = selected.city;
        const kind = classify(c, ownedCityIds, activeCityId, myAllianceId);
        const PANEL_W = 260;
        const MARGIN = 8;
        let left = selected.px + CELL + MARGIN - scroll.left;
        if (left + PANEL_W > scroll.w) left = selected.px - PANEL_W - MARGIN - scroll.left;

        return (
          <div
            ref={panelRef}
            className="absolute z-50 bg-[#161b22] border border-[#30363d] rounded shadow-2xl overflow-y-auto"
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
            <div
              className="absolute top-0 left-0 pointer-events-none bg-[#161b22] border-r border-[#30363d] overflow-hidden z-20"
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

            <div
              className="absolute left-0 bottom-0 pointer-events-none bg-[#161b22] border-t border-[#30363d] overflow-hidden z-20"
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

            <div
              className="absolute left-0 bottom-0 bg-[#161b22] border-t border-r border-[#30363d] pointer-events-none flex items-center justify-center font-mono z-30"
              style={{ width: RULER_W, height: RULER_H, fontSize: 10, color: "#58a6ff" }}
            >
              {cursorCell ? `${cursorCell.x},${cursorCell.y}` : ""}
            </div>
          </>
        );
      })()}
      </div>

      <div className="border-t border-[#30363d] bg-[#161b22] px-3 py-2 text-xs h-10 shrink-0 flex items-center justify-between gap-4 z-40">
        <div className="flex items-center gap-3 text-[#b1bac4]">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_ACTIVE }} /> active</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OWN }} /> mine</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm border border-[#484f58]" style={{ background: COLOR_GHOST }} /> ghost</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_ALLIANCE }} /> alliance</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLOR_OTHER }} /> other</span>
        </div>
        <div className="flex items-center gap-2">
          {myCity && (
            <button
              onClick={() => {
                if (!scrollRef.current) return;
                scrollRef.current.scrollLeft = myCity.x * CELL + CELL / 2 - scrollRef.current.clientWidth / 2;
                scrollRef.current.scrollTop  = myCity.y * CELL + CELL / 2 - scrollRef.current.clientHeight / 2;
              }}
              className="text-xs border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
            >
              ⌖ Center city
            </button>
          )}
          <button
            onClick={() => navigate(myCity?.id ? `/city?cityId=${encodeURIComponent(myCity.id)}` : "/city")}
            className="text-xs border border-[#30363d] rounded px-2.5 py-1 hover:bg-[#1c2129]"
          >
            ← Enter current city
          </button>
        </div>
      </div>
    </div>
  );
}