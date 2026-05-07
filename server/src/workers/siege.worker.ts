import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis";
import { completeConquest } from "../services/siege.service";

// BullMQ worker pentru expiry-ul timer-ului de siege.
// Cand job-ul programat la siege.endsAt se executa, completeConquest verifica
// daca siege-ul e tot ACTIVE (defender-ul nu l-a spart intre timp) si transfera
// orasul. Daca siege-ul nu mai e activ, no-op silentios.
export const registerSiegeWorker = () => {
  new Worker<{ siegeId: string }>(
    "siege-timer",
    async (job) => {
      if (job.name === "expire") {
        await completeConquest(job.data.siegeId);
      }
    },
    { connection: createRedisConnection() }
  );
};
