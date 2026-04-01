import { useState } from "react";
import type { Building, UnitName } from "../types/index.ts";

interface UnitDef {
  name: UnitName;
  label: string;
  costMoney: number;
  costEnergy: number;
  costAmmo: number;
  population: number;
  requiresHQ?: number;
  requiresMilitaryBase?: number;
}

const ALL_UNITS: UnitDef[] = [
  { name: "LIGHT_INFANTRY",     label: "Light Infantry",     costMoney: 60,  costEnergy: 30,  costAmmo: 40,  population: 1 },
  { name: "DEFENDER_INFANTRY",  label: "Defender Infantry",  costMoney: 30,  costEnergy: 30,  costAmmo: 70,  population: 1,  requiresHQ: 5 },
  { name: "ANTI_TANK_INFANTRY", label: "Anti-Tank Infantry", costMoney: 50,  costEnergy: 30,  costAmmo: 10,  population: 1 },
  { name: "SNIPER",             label: "Sniper",             costMoney: 100, costEnergy: 30,  costAmmo: 60,  population: 1,  requiresHQ: 10, requiresMilitaryBase: 10 },
  { name: "SPECIAL_FORCES",     label: "Special Forces",     costMoney: 250, costEnergy: 100, costAmmo: 150, population: 5,  requiresHQ: 15, requiresMilitaryBase: 10 },
  { name: "RAIDER",             label: "Raider",             costMoney: 125, costEnergy: 100, costAmmo: 250, population: 4,  requiresHQ: 10 },
  { name: "TANK",               label: "Tank",               costMoney: 200, costEnergy: 150, costAmmo: 600, population: 6,  requiresHQ: 20, requiresMilitaryBase: 15 },
  { name: "MISSILE_LAUNCHER",   label: "Missile Launcher",   costMoney: 300, costEnergy: 200, costAmmo: 200, population: 5,  requiresHQ: 20, requiresMilitaryBase: 15 },
  { name: "DRONE",              label: "Drone",              costMoney: 320, costEnergy: 400, costAmmo: 100, population: 8,  requiresHQ: 20, requiresMilitaryBase: 20 },
];

interface Resources { money: number; energy: number; ammo: number; }

interface Props {
  buildings: Building[];
  population: number;
  maxPopulation: number;
  resources: Resources;
  onRecruit: (unitName: UnitName, quantity: number) => void;
  recruitError: string | null;
}

export default function RecruitPanel({ buildings, population, maxPopulation, resources, onRecruit, recruitError }: Props) {
  const [quantities, setQuantities] = useState<Partial<Record<UnitName, number>>>({});

  const hqLevel = buildings.find((b) => b.name === "HEADQUARTERS")?.level ?? 0;
  const mbLevel = buildings.find((b) => b.name === "MILITARY_BASE")?.level ?? 0;

  const availablePop = maxPopulation - population;

  function isUnlocked(u: UnitDef): boolean {
    if (mbLevel === 0) return false;
    if (u.requiresHQ && hqLevel < u.requiresHQ) return false;
    if (u.requiresMilitaryBase && mbLevel < u.requiresMilitaryBase) return false;
    return true;
  }

  function canAfford(u: UnitDef, qty: number): boolean {
    return (
      resources.money  >= u.costMoney  * qty &&
      resources.energy >= u.costEnergy * qty &&
      resources.ammo   >= u.costAmmo   * qty &&
      availablePop     >= u.population * qty
    );
  }

  return (
    <div className="recruit-panel">
      {recruitError && <p className="error">{recruitError}</p>}
      <p className="pop-info">Available population: {availablePop}</p>
      {ALL_UNITS.map((u) => {
        const unlocked = isUnlocked(u);
        const qty = quantities[u.name] ?? 1;
        const affordable = canAfford(u, qty);

        return (
          <div key={u.name} className={`recruit-row ${!unlocked ? "locked" : ""}`}>
            <img
              src={`/images/units/${u.name.toLowerCase()}.jpg`}
              alt={u.label}
            />
            <div className="recruit-info">
              <span className="unit-name">{u.label}</span>
              <span className="unit-cost">
                {u.costMoney}M / {u.costEnergy}E / {u.costAmmo}A · pop {u.population}
              </span>
              {!unlocked && (
                <span className="locked-hint">
                  Requires HQ {u.requiresHQ ?? 0}
                  {u.requiresMilitaryBase ? ` + MB ${u.requiresMilitaryBase}` : ""}
                </span>
              )}
            </div>
            {unlocked && (
              <div className="recruit-controls">
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [u.name]: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                />
                <button
                  disabled={!affordable}
                  onClick={() => onRecruit(u.name, qty)}
                >
                  Recruit
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
