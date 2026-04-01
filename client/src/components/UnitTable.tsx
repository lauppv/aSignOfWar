import type { Unit } from "../types/index.ts";

const UNIT_LABELS: Record<Unit["name"], string> = {
  LIGHT_INFANTRY:     "Light Infantry",
  DEFENDER_INFANTRY:  "Defender Infantry",
  ANTI_TANK_INFANTRY: "Anti-Tank Infantry",
  SNIPER:             "Sniper",
  SPECIAL_FORCES:     "Special Forces",
  RAIDER:             "Raider",
  TANK:               "Tank",
  MISSILE_LAUNCHER:   "Missile Launcher",
  DRONE:              "Drone",
  GOVERNOR:           "Governor",
};

interface Props {
  units: Unit[];
}

export default function UnitTable({ units }: Props) {
  const present = units.filter((u) => u.quantity > 0);
  if (present.length === 0) return <p className="empty">No units in city.</p>;

  return (
    <div className="unit-table">
      {present.map((u) => (
        <div key={u.id} className="unit-row">
          <img
            src={`/images/units/${u.name.toLowerCase()}.jpg`}
            alt={UNIT_LABELS[u.name]}
          />
          <span className="unit-name">{UNIT_LABELS[u.name]}</span>
          <span className="unit-count">{u.quantity.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
