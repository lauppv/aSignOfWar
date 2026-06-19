interface Props {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function CancelCommandConfirm({ open, pending, onConfirm, onBack }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onBack}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded p-5 w-[340px] text-xs"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-[#c9d1d9] mb-1">Are you sure you want to cancel this command?</div>
        <div className="text-[10px] text-[#7d8590] mb-4">
          Units will return home in the same time they've been travelling so far.
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onBack}
            className="px-3 py-1 text-[#b1bac4] border border-[#30363d] rounded hover:bg-[#1c2129]"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="px-3 py-1 text-[#f85149] border border-[#3d1a1a] rounded hover:bg-[#1f0e0e] disabled:opacity-40"
          >
            {pending ? "Cancelling..." : "Cancel command"}
          </button>
        </div>
      </div>
    </div>
  );
}
