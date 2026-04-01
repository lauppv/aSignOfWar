import { useState, useEffect } from "react";

interface QueueItem {
  id: string;
  label: string;
  finishAt: string;
}

interface Props {
  items: QueueItem[];
  onCancel: (id: string) => void;
}

function useCountdown(finishAt: string): string {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const diff = Math.max(0, new Date(finishAt).getTime() - Date.now());
      const s = Math.floor(diff / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      setRemaining(
        h > 0
          ? `${h}h ${m % 60}m ${s % 60}s`
          : m > 0
          ? `${m}m ${s % 60}s`
          : `${s}s`
      );
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [finishAt]);

  return remaining;
}

function QueueRow({ item, onCancel }: { item: QueueItem; onCancel: (id: string) => void }) {
  const remaining = useCountdown(item.finishAt);
  return (
    <div className="queue-row">
      <span className="queue-label">{item.label}</span>
      <span className="queue-timer">{remaining}</span>
      <button className="btn-cancel" onClick={() => onCancel(item.id)}>
        Cancel (75%)
      </button>
    </div>
  );
}

export default function QueueList({ items, onCancel }: Props) {
  if (items.length === 0) return <p className="empty">No active orders.</p>;
  return (
    <div className="queue-list">
      {items.map((item) => (
        <QueueRow key={item.id} item={item} onCancel={onCancel} />
      ))}
    </div>
  );
}
