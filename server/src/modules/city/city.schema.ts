import { z } from "zod";

export const renameCitySchema = z.object({
  name: z.string().trim().min(1).max(50),
});
