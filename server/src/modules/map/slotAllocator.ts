// Before, each register did a SELECT on all cities to find out which slots were occupied.
// With 5 users/sec we had 10 full table scans/sec + a race condition (2 users picking the same slot).
// The allocator keeps everything in memory and serializes requests through an async mutex.
import prisma from "../../core/db";
import { MAP_SIZE, pickFreeSlotNear } from "./map.service";

const slotIndex = (x: number, y: number) => y * MAP_SIZE + x;

class SlotAllocator {
  private occupied: Set<number> | null = null;
  private queue: (() => void)[] = [];
  private locked = false;

  // Loads once from the DB on the first call; after that everything is in RAM
  async init(): Promise<void> {
    const cities = await prisma.city.findMany({ select: { x: true, y: true } });
    this.occupied = new Set(cities.map(c => slotIndex(c.x, c.y)));
  }

  // Async mutex — only one call at a time can allocate slots.
  // Without this, 5 simultaneous registrations read the same snapshot and picked the same coordinates.
  private async withLock<T>(fn: (occupied: Set<number>) => T): Promise<T> {
    if (!this.occupied) await this.init();

    await new Promise<void>(resolve => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });

    try {
      return fn(this.occupied!);
    } finally {
      if (this.queue.length > 0) {
        this.queue.shift()!();
      } else {
        this.locked = false;
      }
    }
  }

  // For the starter city — allocates a single slot
  async allocateSlot(
    originX: number,
    originY: number
  ): Promise<{ x: number; y: number }> {
    return this.withLock(occupied => {
      const slot = pickFreeSlotNear(originX, originY, occupied);
      occupied.add(slotIndex(slot.x, slot.y));
      return slot;
    });
  }

  // For ghost cities — allocates N slots in a single pass through the lock
  async allocateSlots(
    originX: number,
    originY: number,
    count: number
  ): Promise<{ x: number; y: number }[]> {
    return this.withLock(occupied => {
      const slots: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const slot = pickFreeSlotNear(originX, originY, occupied);
        occupied.add(slotIndex(slot.x, slot.y));
        slots.push(slot);
      }
      return slots;
    });
  }

  getOccupiedCount(): number {
    return this.occupied?.size ?? 0;
  }

  // If a city is deleted (conquest, etc), we free the slot so it can be reused
  releaseSlot(x: number, y: number): void {
    this.occupied?.delete(slotIndex(x, y));
  }
}

export const slotAllocator = new SlotAllocator();
