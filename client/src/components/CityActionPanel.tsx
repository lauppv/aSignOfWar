import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MapCity, CityOverview, UnitName } from "../types/index.ts";
import { sendCommand, type CommandType } from "../api/command.ts";
import { getBuildingLevel } from "../lib/cityHelpers.ts";
import { getHarborCapacity } from "@shared/gameConfig.ts";

interface Props {
  city: MapCity;
  myCity: CityOverview | undefined;
  headerColor: string;
  kindLabel: string;
  onClose: () => void;
}

type Mode = "info" | "form";

export default function CityActionPanel({ city, myCity, headerColor, kindLabel, onClose }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("info");
  const [type, setType] = useState<CommandType>("ATTACK");
  const [unitCounts, setUnitCounts] = useState<Partial<Record<UnitName, number>>>({});
  const [resources, setResources] = useState({ money: 0, energy: 0, ammo: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwn   = myCity?.id === city.id;
  const isGhost = !city.owner;

  const ownerLabel = city.owner ? city.owner.username : "barbarians";
  const dist = myCity ? Math.sqrt((city.x - myCity.x) ** 2 + (city.y - myCity.y) ** 2) : null;

  const harborLevel  = myCity ? getBuildingLevel(myCity, "HARBOR") : 0;
  const harborCap    = getHarborCapacity(harborLevel);
  const resourceTotal = resources.money + resources.energy + resources.ammo;

  const mutation = useMutation({
    mutationFn: () =>
      sendCommand(myCity!.id, {
        type,
        targetCityId: city.id,
        units: type === "RESOURCES" ? {} : unitCounts,
        resources: type === "RESOURCES" ? resources : { money: 0, energy: 0, ammo: 0 },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["city"] });
      queryClient.invalidateQueries({ queryKey: ["commands"] });
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send command");
    },
  });

  function openForm(t: CommandType) {
    setType(t);
    setUnitCounts({});
    setResources({ money: 0, energy: 0, ammo: 0 });
    setErrorMsg(null);
    setMode("form");
  }

  function setUnitCount(name: UnitName, value: number, max: number) {
    const clamped = Math.max(0, Math.min(max, Math.floor(value || 0)));
    setUnitCounts(prev => ({ ...prev, [name]: clamped }));
  }

  function setResource(key: "money" | "energy" | "ammo", value: number, max: number) {
    const clamped = Math.max(0, Math.min(Math.floor(max), Math.floor(value || 0)));
    setResources(prev => ({ ...prev, [key]: clamped }));
  }

  // ─── INFO MODE ───────────────────────────────────────────────────────────────
  if (mode === "info") {
    return (
      <Wrapper headerColor={headerColor} title={city.name} onClose={onClose}>
        <Row label="Coordinates" value={<span className="font-mono">[{city.x}, {city.y}]</span>} />
        <Row label="Owner"       value={ownerLabel} />
        <Row label="Alliance"    value={<span className="text-[#484f58]">—</span>} />
        {dist !== null && (
          <Row label="Distance" value={<span className="font-mono">{dist.toFixed(1)}</span>} />
        )}
        <Row label="Type" value={<span className="capitalize">{kindLabel}</span>} />

        {!isOwn && myCity && (
          <div className="flex gap-1.5 mt-2 pt-2 border-t border-[#30363d]">
            <button
              onClick={() => openForm("ATTACK")}
              className="flex-1 text-[10px] uppercase tracking-wide border border-[#f85149] text-[#f85149] rounded py-1 hover:bg-[#3d1a1a]"
            >
              Attack
            </button>
            {!isGhost && (
              <>
                <button
                  onClick={() => openForm("SUPPORT")}
                  className="flex-1 text-[10px] uppercase tracking-wide border border-[#3fb950] text-[#3fb950] rounded py-1 hover:bg-[#1a3d1a]"
                >
                  Support
                </button>
                <button
                  onClick={() => openForm("RESOURCES")}
                  className="flex-1 text-[10px] uppercase tracking-wide border border-[#d29922] text-[#d29922] rounded py-1 hover:bg-[#3d2e0a]"
                >
                  Send
                </button>
              </>
            )}
          </div>
        )}
      </Wrapper>
    );
  }

  // ─── FORM MODE ───────────────────────────────────────────────────────────────
  const availableUnits = myCity?.units.filter(u => u.quantity > 0) ?? [];
  const typeColors: Record<CommandType, { fg: string; bg: string; border: string }> = {
    ATTACK:    { fg: "#f85149", bg: "#3d1a1a", border: "#f85149" },
    SUPPORT:   { fg: "#3fb950", bg: "#1a3d1a", border: "#3fb950" },
    RESOURCES: { fg: "#d29922", bg: "#3d2e0a", border: "#d29922" },
  };
  const tc = typeColors[type];

  const canSubmit = (() => {
    if (mutation.isPending) return false;
    if (type === "RESOURCES") {
      if (harborLevel < 1) return false;
      if (resourceTotal <= 0) return false;
      if (resourceTotal > harborCap) return false;
      return true;
    }
    return Object.values(unitCounts).some(v => (v ?? 0) > 0);
  })();

  return (
    <Wrapper headerColor={headerColor} title={`${type.toLowerCase()} → ${city.name}`} onClose={onClose}>
      <div className="text-[10px] text-[#8b949e] mb-2">
        From <span className="text-[#c9d1d9]">{myCity?.name}</span>
        {" → "}
        [{city.x}, {city.y}] · {ownerLabel}
      </div>

      {type === "RESOURCES" ? (
        <div className="flex flex-col gap-2">
          {harborLevel < 1 ? (
            <div className="text-[10px] text-[#f85149] py-1">Harbor level 1 required</div>
          ) : (
            <>
              <ResourceInput label="Money"  color="#7ee787" value={resources.money}  available={Math.floor(myCity?.money  ?? 0)} onChange={(v) => setResource("money",  v, myCity?.money  ?? 0)} />
              <ResourceInput label="Energy" color="#79c0ff" value={resources.energy} available={Math.floor(myCity?.energy ?? 0)} onChange={(v) => setResource("energy", v, myCity?.energy ?? 0)} />
              <ResourceInput label="Ammo"   color="#e3b341" value={resources.ammo}   available={Math.floor(myCity?.ammo   ?? 0)} onChange={(v) => setResource("ammo",   v, myCity?.ammo   ?? 0)} />
              <div className="text-[10px] text-[#8b949e] flex justify-between mt-1">
                <span>Harbor cap (lvl {harborLevel})</span>
                <span className={resourceTotal > harborCap ? "text-[#f85149]" : "text-[#c9d1d9]"}>
                  {resourceTotal} / {harborCap}
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
          {availableUnits.length === 0 ? (
            <div className="text-[10px] text-[#8b949e] py-1">No units available</div>
          ) : availableUnits.map(u => (
            <UnitInput
              key={u.id}
              name={u.name}
              available={u.quantity}
              value={unitCounts[u.name] ?? 0}
              onChange={(v) => setUnitCount(u.name, v, u.quantity)}
            />
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="text-[10px] text-[#f85149] mt-2 break-words">{errorMsg}</div>
      )}

      <div className="flex gap-1.5 mt-3 pt-2 border-t border-[#30363d]">
        <button
          onClick={() => setMode("info")}
          className="flex-1 text-[10px] uppercase tracking-wide border border-[#30363d] text-[#8b949e] rounded py-1 hover:bg-[#1c2129]"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="flex-1 text-[10px] uppercase tracking-wide border rounded py-1 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
          style={{
            color: tc.fg,
            borderColor: tc.border,
            background: canSubmit ? tc.bg : undefined,
          }}
        >
          {mutation.isPending ? "Sending…" : "Confirm"}
        </button>
      </div>
    </Wrapper>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Wrapper({
  headerColor, title, onClose, children,
}: { headerColor: string; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[#30363d]"
        style={{ background: headerColor, color: "#0d1117" }}
      >
        <span className="font-bold truncate text-xs">{title}</span>
        <button
          onClick={onClose}
          className="text-[#0d1117] hover:opacity-70 text-sm leading-none px-1"
        >
          ×
        </button>
      </div>
      <div className="p-3 flex flex-col gap-1.5 text-xs">{children}</div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#8b949e]">{label}</span>
      <span className="text-[#c9d1d9]">{value}</span>
    </div>
  );
}

function UnitInput({ name, available, value, onChange }: {
  name: string; available: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-[#c9d1d9] text-[10px] uppercase truncate">
        {name.toLowerCase().replace(/_/g, " ")}
      </span>
      <span className="text-[10px] text-[#484f58] font-mono w-10 text-right">{available}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")))}
        className="w-14 bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 text-[#c9d1d9] text-[10px] font-mono text-right focus:outline-none focus:border-[#58a6ff]"
      />
      <button
        onClick={() => onChange(available)}
        className="text-[9px] text-[#8b949e] border border-[#30363d] rounded px-1 py-0.5 hover:bg-[#1c2129]"
      >
        max
      </button>
    </div>
  );
}

function ResourceInput({ label, color, value, available, onChange }: {
  label: string; color: string; value: number; available: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-[10px] uppercase" style={{ color }}>{label}</span>
      <span className="text-[10px] text-[#484f58] font-mono w-14 text-right">{available}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")))}
        className="w-16 bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 text-[#c9d1d9] text-[10px] font-mono text-right focus:outline-none focus:border-[#58a6ff]"
      />
      <button
        onClick={() => onChange(available)}
        className="text-[9px] text-[#8b949e] border border-[#30363d] rounded px-1 py-0.5 hover:bg-[#1c2129]"
      >
        max
      </button>
    </div>
  );
}
