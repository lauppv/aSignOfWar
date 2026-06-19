import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/core/db", () => ({
  default: { city: { findMany: vi.fn().mockResolvedValue([]) } },
}));

// Deterministic allocator: always hands out the lowest free x in row 0.
vi.mock("../../../src/modules/map/map.service", () => {
  const MAP_SIZE = 300;
  return {
    MAP_SIZE,
    pickFreeSlotNear: (
      _ox: number,
      _oy: number,
      occupied: Set<number>
    ) => {
      let x = 0;
      while (occupied.has(x)) x++;
      return { x, y: 0 };
    },
  };
});

import { slotAllocator } from "../../../src/modules/map/slotAllocator";

describe("slotAllocator", () => {
  it("walks the allocate/release lifecycle deterministically", async () => {
    expect(slotAllocator.getOccupiedCount()).toBe(0);

    const first = await slotAllocator.allocateSlot(10, 10);
    expect(first).toEqual({ x: 0, y: 0 });
    expect(slotAllocator.getOccupiedCount()).toBe(1);

    const second = await slotAllocator.allocateSlot(10, 10);
    expect(second).toEqual({ x: 1, y: 0 });
    expect(slotAllocator.getOccupiedCount()).toBe(2);

    const batch = await slotAllocator.allocateSlots(10, 10, 3);
    expect(batch).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(slotAllocator.getOccupiedCount()).toBe(5);

    slotAllocator.releaseSlot(0, 0);
    expect(slotAllocator.getOccupiedCount()).toBe(4);
  });

  it("serializes concurrent allocations through the mutex (no duplicate slots)", async () => {
    const before = slotAllocator.getOccupiedCount();
    const results = await Promise.all([
      slotAllocator.allocateSlot(5, 5),
      slotAllocator.allocateSlot(5, 5),
      slotAllocator.allocateSlot(5, 5),
    ]);
    const xs = results.map((r) => r.x);
    expect(new Set(xs).size).toBe(3);
    expect(slotAllocator.getOccupiedCount()).toBe(before + 3);
  });
});
