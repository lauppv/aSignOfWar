import type { Building, BuildingUpgradeOrder } from "../types/index.ts";

const BUILDING_LABELS: Record<Building["name"], string> = {
  HEADQUARTERS:    "Headquarters",
  BANK:            "Bank",
  POWER_PLANT:     "Power Plant",
  WEAPONS_FACTORY: "Weapons Factory",
  HOUSING:         "Housing",
  WAREHOUSE:       "Warehouse",
  MILITARY_BASE:   "Military Base",
  HARBOR:          "Harbor",
  AIR_DEFENSE:     "Air Defense",
};

const MAX_LEVELS: Record<Building["name"], number> = {
  HEADQUARTERS: 30, BANK: 30, POWER_PLANT: 30, WEAPONS_FACTORY: 30,
  HOUSING: 30, WAREHOUSE: 30, MILITARY_BASE: 25, HARBOR: 25, AIR_DEFENSE: 20,
};

interface Resources { money: number; energy: number; ammo: number; }

interface Props {
  buildings: Building[];
  orders: BuildingUpgradeOrder[];
  resources: Resources;
  onUpgrade: (buildingId: string) => void;
  upgradeError: string | null;
}

export default function BuildingList({ buildings, orders, onUpgrade, upgradeError }: Props) {
  const inQueue = new Set(orders.map((o) => o.buildingName));

  return (
    <div className="building-list">
      {upgradeError && <p className="error">{upgradeError}</p>}
      {buildings.map((b) => {
        const maxLevel = MAX_LEVELS[b.name];
        const isMaxed = b.level >= maxLevel;
        const isQueued = inQueue.has(b.name);

        return (
          <div key={b.id} className="building-card">
            <img
              src={`/images/buildings/${b.name.toLowerCase()}.jpg`}
              alt={BUILDING_LABELS[b.name]}
            />
            <div className="building-info">
              <span className="building-name">{BUILDING_LABELS[b.name]}</span>
              <span className="building-level">
                Level {b.level}{isMaxed ? " (max)" : ""}
              </span>
            </div>
            <button
              className="btn-upgrade"
              disabled={isMaxed || isQueued}
              onClick={() => onUpgrade(b.id)}
            >
              {isMaxed ? "Max" : isQueued ? "Queued" : `→ lvl ${b.level + 1}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
