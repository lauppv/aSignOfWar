// Inchide un dropdown/meniu cand utilizatorul da click in afara sau apasa Escape.
// Folosit de ResourceBar pentru city switcher si settings dropdown.
// As fi putut folosi Radix/HeadlessUI <Popover>, dar un hook e mai lejer si am doar
// 2 dropdown-uri in toata aplicatia — nu merita o dependinta de librarie. YAGNI.

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
