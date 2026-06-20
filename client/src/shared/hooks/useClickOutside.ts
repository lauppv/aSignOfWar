// Closes a dropdown/menu when the user clicks outside or presses Escape.
// Used by ResourceBar for the city switcher and settings dropdown.
// I could have used Radix/HeadlessUI <Popover>, but a hook is lighter and I only have
// 2 dropdowns in the whole app — not worth a library dependency. YAGNI.

import { useEffect, type RefObject } from "react";

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [ref, open, onClose]);
}
