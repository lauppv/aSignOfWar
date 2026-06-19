import { useState } from "react";
import { UNITS, calcBuildingDamage } from "@shared/gameConfig.ts";
import type { UnitName } from "@shared/gameConfig.ts";
import { calculateBattle } from "@shared/battleCalc.ts";
import type { BattleResult } from "@shared/battleCalc.ts";
import { UNIT_DISPLAY, UNIT_ORDER } from "@/shared/lib/labels";
import { useUnitInfo } from "@/shared/context/UnitInfoContext";

interface Props {
  onClose: () => void;
}

const ALL_UNITS: UnitName[] = [...UNIT_ORDER.filter(n => n !== "HACKER"), "GOVERNOR"] as UnitName[];

const EMPTY_UNITS = (): Record<UnitName, number> =>
  Object.fromEntries(Object.keys(UNITS).map(k => [k, 0])) as Record<UnitName, number>;

export default function SimulatorView({ onClose }: Props) {
  // Simulatorul foloseste ACEEASI functie calculateBattle() ca serverul. Asta garanteaza
  // ca rezultatele din simulator corespund bataliilor reale — nu exista o "aproximare
  // client-side" separata care ar putea induce in eroare jucatorii.
  const [attacker, setAttacker] = useState(EMPTY_UNITS);
  const [defender, setDefender] = useState(EMPTY_UNITS);
  const [airDefenseLevel, setAirDefenseLevel] = useState(0);
  const [defMoney, setDefMoney] = useState(0);
  const [defEnergy, setDefEnergy] = useState(0);
  const [defAmmo, setDefAmmo] = useState(0);
  const [targetBuildingLevel, setTargetBuildingLevel] = useState(0);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [buildingDamageResult, setBuildingDamageResult] = useState<number>(0);

  const { openUnit } = useUnitInfo();

  function simulate() {
    const atkUnits = ALL_UNITS
      .filter(n => attacker[n] > 0)
      .map(n => ({ name: n, quantity: attacker[n] }));
    const defUnits = ALL_UNITS
      .filter(n => defender[n] > 0)
      .map(n => ({ name: n, quantity: defender[n] }));

    if (atkUnits.length === 0 && defUnits.length === 0) return;

    const simTargetBuilding = targetBuildingLevel > 0 ? "HEADQUARTERS" : undefined;
    const battleResult = calculateBattle(atkUnits, defUnits, airDefenseLevel, defMoney, defEnergy, defAmmo, simTargetBuilding);
    setResult(battleResult);

    const initialDrones = attacker["DRONE"] ?? 0;
    if (targetBuildingLevel > 0 && initialDrones > 0) {
      setBuildingDamageResult(calcBuildingDamage(targetBuildingLevel, initialDrones, battleResult.battleRatio));
    } else {
      setBuildingDamageResult(0);
    }
  }

  function reset() {
    setAttacker(EMPTY_UNITS());
    setDefender(EMPTY_UNITS());
    setAirDefenseLevel(0);
    setDefMoney(0);
    setDefEnergy(0);
    setDefAmmo(0);
    setTargetBuildingLevel(0);
    setResult(null);
    setBuildingDamageResult(0);
  }

  function setUnit(side: "atk" | "def", name: UnitName, value: string) {
    const num = Math.max(0, parseInt(value) || 0);
    if (side === "atk") setAttacker(prev => ({ ...prev, [name]: num }));
    else setDefender(prev => ({ ...prev, [name]: num }));
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#30363d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-xs text-[#b1bac4] hover:text-[#c9d1d9] cursor-pointer">← Back</button>
          <span className="text-sm font-semibold text-[#d2a8ff]">Battle Simulator</span>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="text-xs text-[#b1bac4] border border-[#30363d] rounded px-3 py-1 hover:border-[#8b949e] cursor-pointer">Reset</button>
          <button onClick={simulate} className="text-xs text-[#0d1117] bg-[#d2a8ff] rounded px-4 py-1 font-semibold hover:bg-[#b87aff] cursor-pointer">Simulate</button>
        </div>
      </div>

      {/* Results (Tribal Wars style) */}
      {result && (
        <div className="shrink-0 border-b border-[#30363d] bg-[#161b22] px-4 py-3 max-w-[800px] mx-auto">
          {/* Winner banner */}
          <div className={`text-center text-sm font-bold py-1.5 rounded mb-3 ${result.attackerWon ? "bg-[#1a3d1a] text-[#3fb950]" : "bg-[#3d1a1a] text-[#f85149]"}`}>
            {result.attackerWon ? "ATTACKER WINS" : "DEFENDER WINS"}
          </div>

          {/* Results table: icons on top, units/losses rows below */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="w-20"></th>
                  {ALL_UNITS.map(name => (
                    <th key={name} className="px-1 pb-1 text-center">
                      <img
                        src={`/images/units/${name.toLowerCase()}.jpg`}
                        alt={UNIT_DISPLAY[name]}
                        className="w-10 h-10 object-contain rounded mx-auto cursor-pointer hover:brightness-125 transition-[filter]"
                        onClick={() => openUnit(name)}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Attacker */}
                <ResultRow
                  label="Attacker"
                  labelColor="#f85149"
                  sublabel="Units"
                  units={attacker}
                  allUnits={ALL_UNITS}
                />
                <ResultRow
                  label=""
                  labelColor="#f85149"
                  sublabel="Losses"
                  units={attacker}
                  allUnits={ALL_UNITS}
                  survivors={result.attackerSurvivors}
                  isLossRow
                />
                {/* Defender */}
                <ResultRow
                  label="Defender"
                  labelColor="#3fb950"
                  sublabel="Units"
                  units={defender}
                  allUnits={ALL_UNITS}
                />
                <ResultRow
                  label=""
                  labelColor="#3fb950"
                  sublabel="Losses"
                  units={defender}
                  allUnits={ALL_UNITS}
                  survivors={result.defenderSurvivors}
                  isLossRow
                />
              </tbody>
            </table>
          </div>

          {/* Extra info row */}
          <div className="flex gap-6 mt-3 text-xs text-[#b1bac4]">
            {result.airDefenseLevelsDestroyed > 0 && (
              <span>Air Defense: {airDefenseLevel} → {result.newAirDefenseLevel} <span className="text-[#f85149]">(-{result.airDefenseLevelsDestroyed})</span></span>
            )}
            {(result.stolenMoney > 0 || result.stolenEnergy > 0 || result.stolenAmmo > 0) && (
              <span>
                Stolen: <span className="text-[#7ee787]">{result.stolenMoney.toLocaleString()}</span> / <span className="text-[#79c0ff]">{result.stolenEnergy.toLocaleString()}</span> / <span className="text-[#e3b341]">{result.stolenAmmo.toLocaleString()}</span>
              </span>
            )}
            {result.loyaltyDamage > 0 && (
              <span>Loyalty: <span className="text-[#f85149] font-semibold">-{result.loyaltyDamage}</span></span>
            )}
            {buildingDamageResult > 0 && (
              <span>Building: {targetBuildingLevel} → {targetBuildingLevel - buildingDamageResult} <span className="text-[#d2a8ff]">(-{buildingDamageResult})</span></span>
            )}
            {targetBuildingLevel > 0 && buildingDamageResult === 0 && (
              <span className="text-[#7d8590]">Building: no damage</span>
            )}
          </div>
        </div>
      )}

      {/* Input section */}
      <div className="px-4 py-3 max-w-[800px] mx-auto">
        {/* Defender city settings */}
        <div className="flex gap-4 mb-3 items-center">
          <span className="text-[10px] uppercase tracking-widest text-[#b1bac4]">Defender city:</span>
          <label className="flex items-center gap-1.5 text-xs text-[#c9d1d9]">
            Air Defense Lvl
            <input
              type="text" inputMode="numeric" min={0} max={20} value={airDefenseLevel}
              onChange={e => setAirDefenseLevel(Math.min(20, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-14 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-right text-xs text-[#c9d1d9] focus:border-[#d2a8ff] outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#7ee787]">
            Money
            <input
              type="text" inputMode="numeric" min={0} value={defMoney}
              onChange={e => setDefMoney(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-right text-xs text-[#c9d1d9] focus:border-[#d2a8ff] outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#79c0ff]">
            Energy
            <input
              type="text" inputMode="numeric" min={0} value={defEnergy}
              onChange={e => setDefEnergy(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-right text-xs text-[#c9d1d9] focus:border-[#d2a8ff] outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[#e3b341]">
            Ammo
            <input
              type="text" inputMode="numeric" min={0} value={defAmmo}
              onChange={e => setDefAmmo(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-right text-xs text-[#c9d1d9] focus:border-[#d2a8ff] outline-none"
            />
          </label>
        </div>
        <div className="flex gap-4 mb-3 items-center">
          <span className="text-[10px] uppercase tracking-widest text-[#d2a8ff]">Drone target:</span>
          <label className="flex items-center gap-1.5 text-xs text-[#c9d1d9]">
            Building level
            <input
              type="text" inputMode="numeric" min={0} max={30} value={targetBuildingLevel}
              onChange={e => setTargetBuildingLevel(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-14 bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-right text-xs text-[#c9d1d9] focus:border-[#d2a8ff] outline-none"
            />
          </label>
        </div>

        {/* Army inputs table */}
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#30363d]">
              <th className="text-left py-2 font-normal text-[#7d8590] text-[10px] uppercase w-[200px]">Unit</th>
              <th className="text-center py-2 font-normal text-[#f85149] text-[10px] uppercase">Attacker</th>
              <th className="text-center py-2 font-normal text-[#3fb950] text-[10px] uppercase">Defender</th>
            </tr>
          </thead>
          <tbody>
            {ALL_UNITS.map(name => (
              <tr key={name} className="border-b border-[#21262d]">
                <td className="py-1.5">
                  <span
                    className="flex items-center gap-2 text-[#c9d1d9] cursor-pointer hover:text-[#d2a8ff] transition-colors"
                    onClick={() => openUnit(name)}
                  >
                    <img
                      src={`/images/units/${name.toLowerCase()}.jpg`}
                      alt={UNIT_DISPLAY[name]}
                      className="w-10 h-10 object-contain rounded shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    {UNIT_DISPLAY[name]}
                  </span>
                </td>
                <td className="py-1.5 text-center">
                  <input
                    type="text" inputMode="numeric" min={0} value={attacker[name] || ""}
                    onChange={e => setUnit("atk", name, e.target.value)}
                    placeholder="0"
                    className="w-24 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-center text-xs text-[#c9d1d9] focus:border-[#d2a8ff] outline-none"
                  />
                </td>
                <td className="py-1.5 text-center">
                  <input
                    type="text" inputMode="numeric" min={0} value={defender[name] || ""}
                    onChange={e => setUnit("def", name, e.target.value)}
                    placeholder="0"
                    className="w-24 bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-center text-xs text-[#c9d1d9] focus:border-[#d2a8ff] outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Result row (used in the TW-style results table) ─────────────────────────

interface ResultRowProps {
  label: string;
  labelColor: string;
  sublabel: string;
  units: Record<UnitName, number>;
  allUnits: UnitName[];
  survivors?: { name: UnitName; quantity: number }[];
  isLossRow?: boolean;
}

function ResultRow({ label, labelColor, sublabel, units, allUnits, survivors, isLossRow }: ResultRowProps) {
  return (
    <tr className={isLossRow ? "border-b border-[#30363d]" : ""}>
      <td className="py-1 pr-2 text-right whitespace-nowrap">
        {label && <span className="font-semibold text-xs" style={{ color: labelColor }}>{label}</span>}
        <span className="text-[10px] text-[#7d8590] ml-1">{sublabel}:</span>
      </td>
      {allUnits.map(name => {
        const sent = units[name];
        if (isLossRow && survivors) {
          const survivor = survivors.find(u => u.name === name);
          const lost = survivor !== undefined ? sent - survivor.quantity : 0;
          return (
            <td key={name} className={`py-1 text-center font-semibold ${lost > 0 ? "text-[#f85149]" : "text-[#7d8590]"}`}>
              {sent > 0 && lost > 0 ? `-${lost.toLocaleString()}` : "0"}
            </td>
          );
        }
        return (
          <td key={name} className={`py-1 text-center ${sent > 0 ? "text-[#c9d1d9]" : "text-[#7d8590]"}`}>
            {sent > 0 ? sent.toLocaleString() : "0"}
          </td>
        );
      })}
    </tr>
  );
}
