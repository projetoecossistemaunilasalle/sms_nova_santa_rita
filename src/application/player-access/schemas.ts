import { z } from "zod";

const identifier = z.string().trim().min(1).max(128);

export const allocatePlayerSlotsSchema = z.object({
  classGroupId: identifier,
  count: z.coerce.number().int().min(1).max(100),
});

export const rotatePlayerCredentialSchema = z.object({
  playerSlotId: identifier,
});

export const classSessionSchema = z.object({
  classGroupId: identifier,
});

export const playerCredentialTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
