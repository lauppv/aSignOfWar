import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email:    z.string().email(),
  password: z.string().min(6).max(100),
  cityName: z.string().min(1).max(50),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
