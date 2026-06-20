import { Worker } from "bullmq";
import { createRedisConnection } from "../core/redis";
import { completeConquest } from "../modules/siege/siege.service";

// BullMQ worker for the siege timer expiry.
// When the job scheduled at siege.endsAt runs, completeConquest checks whether
// the siege is still ACTIVE (the defender didn't break it in the meantime) and
// transfers the city. If the siege is no longer active, it's a silent no-op.
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
