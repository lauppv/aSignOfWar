// One-off: re-queue ATTACK commands stuck in TRAVELING with arrivalAt in the past.
// Cause: the worker crashed on ghost cities because of syncResources, which assumed
// the BANK/POWER_PLANT/etc. buildings existed. Now that the bug is fixed, we re-queue
// them with delay 0 so they're processed immediately.
// Run with: npx tsx scripts/resolve-stuck-commands.ts

import prisma from "../src/core/db";
import { commandQueue } from "../src/core/queue";

async function main() {
  const stuck = await prisma.command.findMany({
    where: { status: "TRAVELING", arrivalAt: { lt: new Date() } },
    select: { id: true, type: true, arrivalAt: true },
  });

  console.log(`Found ${stuck.length} stuck commands`);
  for (const c of stuck) {
    await commandQueue.add("arrive", { commandId: c.id }, { delay: 0 });
    console.log(`  re-queued ${c.type} ${c.id} (arrivalAt was ${c.arrivalAt.toISOString()})`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
