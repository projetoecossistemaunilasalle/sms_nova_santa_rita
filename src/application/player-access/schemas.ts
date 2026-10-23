import { z } from "zod";

const identifier = z.string().trim().min(1).max(128);

export const allocatePlayerSlotsSchema = z.object({
  classGroupId: identifier,
  count: z.coerce.number().int().min(1).max(100),
});

export const rotatePlayerCredentialSchema = z.object({
  playerSlotId: identifier,
});

const contentId = z.string().trim().min(1).max(100);
const contentIds = z
  .array(contentId)
  .max(256)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Não repita os conteúdos.",
  );

export const contentSelectionSchema = z
  .object({
    enabled_module_ids: contentIds.optional(),
    enabled_mission_ids: contentIds.optional(),
    activity_presets: z.record(contentId, contentId).nullable().optional(),
    options: z
      .record(contentId, z.union([z.boolean(), z.string().max(100)]))
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (selection) =>
      (selection.enabled_module_ids?.length ?? 0) +
        (selection.enabled_mission_ids?.length ?? 0) >
      0,
    "Selecione ao menos uma missão.",
  );

// Forms send a JSON selection; omission uses the class default, null means all.
const formContentSelection = z.preprocess((value) => {
  if (typeof value !== "string" || value.length > 65_536) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, contentSelectionSchema.nullable());

export const classSessionSchema = z
  .object({
    classGroupId: identifier,
    selection: formContentSelection.optional(),
    saveAsClassDefault: z
      .union([z.boolean(), z.enum(["on", "true", "off", "false"])])
      .transform(
        (value) => value === true || value === "on" || value === "true",
      )
      .default(false),
  })
  .refine(
    (input) => !input.saveAsClassDefault || input.selection !== undefined,
    {
      path: ["selection"],
      message: "Escolha o conteúdo antes de salvar o padrão da turma.",
    },
  );

export const classDefaultContentSchema = z.object({
  classGroupId: identifier,
  selection: formContentSelection,
});

export const playerCredentialTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
