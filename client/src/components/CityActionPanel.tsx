import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MapCity, CityOverview, UnitName, OutgoingCommand } from "../types/index.ts";
import { sendCommand, getCityCommands, withdrawStationedSupport, type CommandType } from "../api/command.ts";
import { getBuildingLevel } from "../lib/cityHelpers.ts";
import { getHarborCapacity } from "@shared/gameConfig.ts";
import { UNIT_DISPLAY } from "../lib/labels.ts";
import { useUnitInfo } from "../context/UnitInfoContext.tsx";

interface Props {
  city: MapCity;
  myCity: CityOverview | undefined;
  headerColor: string;
  kindLabel: string;
  onClose: () => void;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
}

type Mode = "info" | "form";

export default function CityActionPanel({ city, myCity, headerColor, kindLabel, onClose, onHeaderMouseDown }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("info");
  const [type, setType] = useState<CommandType>("ATTACK");
  const [unitCounts, setUnitCounts] = useState<Partial<Record<UnitName, number>>>({});
  const [resources, setResources] = useState({ money: 0, energy: 0, ammo: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwn   = myCity?.id === city.id;
  const isGhost = !city.owner;

  const ownerLabel = city.owner ? city.owner.username : "Ghost city";
  const dist = myCity ? Math.sqrt((city.x - myCity.x) ** 2 + (city.y - myCity.y) ** 2) : null;

  const { data: commands } = useQuery({
    queryKey: ["commands", myCity?.id],
    queryFn: () => getCityCommands(myCity!.id),
    enabled: !!myCity?.id,
    refetchInterval: 5000,
  });
  const commandsToThisCity = (commands?.outgoing ?? []).filter(c => c.toCity.id === city.id);
  const ordersInFlight = commandsToThisCity.filter(c => c.status === "TRAVELING" || c.status === "RETURNING");
  const stationedHere  = commandsToThisCity.filter(c => c.status === "ARRIVED");

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
      <Wrapper headerColor={headerColor} title={`${city.name} (${city.x}, ${city.y})`} onClose={onClose} onHeaderMouseDown={onHeaderMouseDown}>
        <Row label="Owner"       value={ownerLabel} />
        <Row label="Alliance"    value={<span className="text-[#7d8590]">—</span>} />
        {dist !== null && (
          <Row label="Distance" value={<span className="font-mono">{dist.toFixed(1)}</span>} />
        )}
        <Row label="Type" value={<span className="capitalize">{kindLabel}</span>} />

        {!isOwn && ordersInFlight.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#30363d]">
            <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">
              My orders ({ordersInFlight.length})
            </div>
            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
              {ordersInFlight.map(c => <OrderRow key={c.id} cmd={c} />)}
            </div>
          </div>
        )}

        {!isOwn && stationedHere.length > 0 && myCity && (
          <div className="mt-2 pt-2 border-t border-[#30363d]">
            <div className="text-[10px] uppercase tracking-widest text-[#b1bac4] mb-1">
              My stationed units
            </div>
            <StationedWithdrawPanel
              fromCityId={myCity.id}
              targetCityId={city.id}
              commands={stationedHere}
            />
          </div>
        )}

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
    <Wrapper headerColor={headerColor} title={`${type.toLowerCase()} → ${city.name}`} onClose={onClose} onHeaderMouseDown={onHeaderMouseDown}>
      <div className="text-[10px] text-[#b1bac4] mb-2">
        From <span className="text-[#c9d1d9]">{myCity?.name}</span>
        {" → "}
        ({city.x}, {city.y}) · {ownerLabel}
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
              <div className="text-[10px] text-[#b1bac4] flex justify-between mt-1">
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
            <div className="text-[10px] text-[#b1bac4] py-1">No units available</div>
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
          className="flex-1 text-[10px] uppercase tracking-wide border border-[#30363d] text-[#b1bac4] rounded py-1 hover:bg-[#1c2129]"
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
  headerColor, title, onClose, onHeaderMouseDown, children,
}: { headerColor: string; title: string; onClose: () => void; onHeaderMouseDown?: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <>
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] select-none"
        style={{ background: headerColor, color: "#0d1117", cursor: onHeaderMouseDown ? "grab" : undefined }}
        onMouseDown={onHeaderMouseDown}
      >
        <span className="font-bold truncate text-xs">{title}</span>
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-[#0d1117] hover:opacity-70 text-sm leading-none px-1"
          style={{ cursor: "pointer" }}
        >
          ×
        </button>
      </div>
      <div className="p-3 flex flex-col gap-1.5 text-xs">{children}</div>
    </>
  );
}

const ORDER_META: Record<CommandType, { label: string; fg: string; border: string }> = {
  ATTACK:    { label: "Attack",    fg: "#f85149", border: "#3d1a1a" },
  SUPPORT:   { label: "Support",   fg: "#3fb950", border: "#1a3d1a" },
  RESOURCES: { label: "Resources", fg: "#d29922", border: "#3d2e0a" },
};

function fmtEta(cmd: OutgoingCommand): string {
  if (cmd.status === "ARRIVED")   return "stationed";
  if (cmd.status === "RETURNING") {
    const ms = new Date(cmd.arrivalAt).getTime() - Date.now();
    if (ms <= 0) return "arriving home";
    return "← " + formatMs(ms);
  }
  const ms = new Date(cmd.arrivalAt).getTime() - Date.now();
  if (ms <= 0) return "arriving";
  return formatMs(ms);
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function StationedWithdrawPanel({
  fromCityId, targetCityId, commands,
}: { fromCityId: string; targetCityId: string; commands: OutgoingCommand[] }) {
  const queryClient = useQueryClient();
  const { openUnit } = useUnitInfo();
  const [qty, setQty] = useState<Partial<Record<UnitName, number>>>({});
  const [err, setErr] = useState<string | null>(null);

  const totals = new Map<UnitName, number>();
  for (const c of commands) {
    for (const u of c.units) {
      if (u.quantity > 0) totals.set(u.name, (totals.get(u.name) ?? 0) + u.quantity);
    }
  }
  const entries = Array.from(totals.entries());

  const mutation = useMutation({
    mutationFn: (body: { mode: "all" | "partial"; units?: Partial<Record<UnitName, number>> }) =>
      withdrawStationedSupport(fromCityId, { targetCityId, ...body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commands"] });
      queryClient.invalidateQueries({ queryKey: ["city"] });
      setQty({});
      setErr(null);
    },
    onError: (e: unknown) => {
      setErr(e instanceof Error ? e.message : "Failed to withdraw");
    },
  });

  const hasPartialSelection = Object.values(qty).some(v => (v ?? 0) > 0);

  function set(name: UnitName, raw: string, max: number) {
    const num = Number(raw.replace(/\D/g, ""));
    const clamped = Math.max(0, Math.min(max, num || 0));
    setQty(prev => ({ ...prev, [name]: clamped }));
  }

  if (entries.length === 0) {
    return <span className="text-[10px] text-[#7d8590]">No units</span>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1">
        {entries.map(([name, available]) => (
          <div key={name} className="flex items-center gap-2">
            <img
              src={`/images/units/${name.toLowerCase()}.jpg`}
              alt=""
              onClick={(e) => { e.stopPropagation(); openUnit(name); }}
              className="w-6 h-6 object-cover rounded shrink-0 cursor-pointer hover:brightness-125"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <span className="text-[10px] text-[#7d8590] font-mono w-10 text-right">{available}</span>
            <input
              type="text"
              inputMode="numeric"
              value={qty[name] || ""}
              placeholder="0"
              onChange={(e) => set(name, e.target.value, available)}
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 text-[#c9d1d9] text-[10px] font-mono text-right focus:outline-none focus:border-[#58a6ff] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        ))}
      </div>

      {err && <div className="text-[10px] text-[#f85149] break-words">{err}</div>}

      <div className="flex gap-1.5">
        <button
          onClick={() => mutation.mutate({ mode: "all" })}
          disabled={mutation.isPending}
          className="flex-1 text-[10px] uppercase tracking-wide border border-[#3fb950] text-[#3fb950] rounded py-1 hover:bg-[#1a3d1a] disabled:opacity-40"
        >
          Withdraw all
        </button>
        <button
          onClick={() => mutation.mutate({ mode: "partial", units: qty })}
          disabled={!hasPartialSelection || mutation.isPending}
          className="flex-1 text-[10px] uppercase tracking-wide border border-[#58a6ff] text-[#58a6ff] rounded py-1 hover:bg-[#0c2744] disabled:opacity-40"
        >
          Withdraw some
        </button>
      </div>
    </div>
  );
}

function OrderRow({ cmd }: { cmd: OutgoingCommand }) {
  const { openUnit } = useUnitInfo();
  const meta = ORDER_META[cmd.type];
  const activeUnits = cmd.units.filter(u => u.quantity > 0);

  return (
    <div
      className="flex flex-col gap-1 rounded px-2 py-1.5 bg-[#0d1117] border"
      style={{ borderColor: meta.border }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: meta.fg }}>
          {meta.label}
        </span>
        <span className="text-[10px] text-[#b1bac4] font-mono">{fmtEta(cmd)}</span>
      </div>

      {cmd.type === "RESOURCES" ? (
        <div className="flex gap-2 text-[10px] font-mono">
          {cmd.resourceMoney  > 0 && <span className="text-[#7ee787]">{cmd.resourceMoney.toLocaleString()}M</span>}
          {cmd.resourceEnergy > 0 && <span className="text-[#79c0ff]">{cmd.resourceEnergy.toLocaleString()}E</span>}
          {cmd.resourceAmmo   > 0 && <span className="text-[#e3b341]">{cmd.resourceAmmo.toLocaleString()}A</span>}
          {cmd.resourceMoney + cmd.resourceEnergy + cmd.resourceAmmo === 0 && (
            <span className="text-[#7d8590]">—</span>
          )}
        </div>
      ) : activeUnits.length === 0 ? (
        <span className="text-[10px] text-[#7d8590]">No units</span>
      ) : (
        <div className="flex flex-row flex-wrap gap-1">
          {activeUnits.map(u => (
            <div
              key={u.name}
              onClick={(e) => { e.stopPropagation(); openUnit(u.name); }}
              className="inline-flex shrink-0 items-center gap-1 bg-[#161b22] rounded px-1 py-0.5 cursor-pointer hover:brightness-125"
              title={UNIT_DISPLAY[u.name]}
            >
              <img
                src={`/images/units/${u.name.toLowerCase()}.jpg`}
                alt={UNIT_DISPLAY[u.name]}
                className="w-5 h-5 object-contain rounded shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <span className="text-[10px] text-[#c9d1d9] font-mono">{u.quantity.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#b1bac4]">{label}</span>
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
      <span className="text-[10px] text-[#7d8590] font-mono w-10 text-right">{available}</span>
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
        className="text-[9px] text-[#b1bac4] border border-[#30363d] rounded px-1 py-0.5 hover:bg-[#1c2129]"
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
      <span className="text-[10px] text-[#7d8590] font-mono w-14 text-right">{available}</span>
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
        className="text-[9px] text-[#b1bac4] border border-[#30363d] rounded px-1 py-0.5 hover:bg-[#1c2129]"
      >
        max
      </button>
    </div>
  );
}
