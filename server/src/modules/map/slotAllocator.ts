// Inainte fiecare register facea SELECT pe toate orasele ca sa afle ce sloturi sunt ocupate.
// Cu 5 useri/sec aveam 10 full table scans/sec + race condition (2 useri alegeau acelasi slot).
// Allocator-ul tine totul in memorie si serializeaza cererile printr-un mutex async.
import prisma from "../../core/db";
import { MAP_SIZE, pickFreeSlotNear } from "./map.service";

const slotIndex = (x: number, y: number) => y * MAP_SIZE + x;

class SlotAllocator {
  private occupied: Set<number> | null = null;
  private queue: (() => void)[] = [];
  private locked = false;

  // Incarca o singura data din DB la primul apel, dupa aia totul e in RAM
  async init(): Promise<void> {
    const cities = await prisma.city.findMany({ select: { x: true, y: true } });
    this.occupied = new Set(cities.map(c => slotIndex(c.x, c.y)));
  }

  // Mutex async — un singur apel la un moment dat poate aloca sloturi.
  // Fara asta, 5 registrari simultane citeau acelasi snapshot si alegeau aceleasi coordonate.
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

  // Pentru starter city — aloca un singur slot
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

  // Pentru ghost cities — aloca N sloturi dintr-o singura trecere prin lock
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

  // Daca un oras e sters (cucerire, etc), eliberam slotul ca sa poata fi refolosit
  releaseSlot(x: number, y: number): void {
    this.occupied?.delete(slotIndex(x, y));
  }
}

export const slotAllocator = new SlotAllocator();
