interface Props {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  message,
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  variant      = "danger",
  onConfirm,
  onCancel,
}: Props) {
  const confirmClasses =
    variant === "primary"
      ? "bg-[#238636] border border-[#2ea043] text-white hover:bg-[#2ea043]"
      : "bg-[#b62324] border border-[#da3633] text-white hover:bg-[#da3633]";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-lg w-[22vw] max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-4 text-sm text-[#c9d1d9] leading-relaxed">
          {message}
        </div>
        <div className="flex justify-end gap-2 px-3 py-2 border-t border-[#30363d]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-xs rounded bg-[#21262d] border border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1 text-xs rounded ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
