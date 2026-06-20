import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

function setup(open: boolean) {
  const inside = document.createElement("div");
  const outside = document.createElement("div");
  document.body.append(inside, outside);
  const ref = { current: inside } as RefObject<HTMLElement>;
  const onClose = vi.fn();
  const result = renderHook(() => useClickOutside(ref, open, onClose));
  return { inside, outside, onClose, ...result };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useClickOutside", () => {
  it("closes on a mousedown outside the ref", () => {
    const { outside, onClose } = setup(true);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("ignores a mousedown inside the ref", () => {
    const { inside, onClose } = setup(true);
    inside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape but ignores other keys", () => {
    const { onClose } = setup(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onClose).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("attaches no listeners while closed", () => {
    const { outside, onClose } = setup(false);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("detaches listeners on unmount", () => {
    const { outside, onClose, unmount } = setup(true);
    unmount();
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
