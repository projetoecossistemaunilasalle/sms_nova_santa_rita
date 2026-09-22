import { z } from "zod";

export const runtimeModeSchema = z.enum(["demo", "server"]);

export type RuntimeMode = z.infer<typeof runtimeModeSchema>;

export function getRuntimeMode(
  environment: Record<string, string | undefined> = process.env,
): RuntimeMode {
  return runtimeModeSchema.parse(environment.APP_RUNTIME_MODE);
}

export function isDemoRuntime(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return getRuntimeMode(environment) === "demo";
}
