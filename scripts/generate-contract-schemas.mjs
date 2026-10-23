import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";
import { z } from "zod";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = new URL("../contracts/schemas/v2/", import.meta.url);
const server = await createServer({
  root,
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
});

// Zod refinements are not emitted by toJSONSchema. Preserve their transport
// equivalents and annotate the byte/depth limits that need validator extensions.
function addTransportConstraints(node, limits, root = node) {
  if (typeof node !== "object" || node === null) return;
  if (Array.isArray(node)) {
    node.forEach((value) => addTransportConstraints(value, limits, root));
    return;
  }
  const properties = node.properties;
  if (properties) {
    const dereference = (value) =>
      value?.$ref?.startsWith("#/$defs/")
        ? root.$defs[value.$ref.slice("#/$defs/".length)]
        : value;
    if (dereference(properties.schema_version)?.const === 3) {
      node["x-state-max-serialized-utf8-bytes"] = limits.state;
      node["x-state-max-depth"] = 32;
    }
    if (dereference(properties.manifest_version)?.const === 1) {
      node["x-manifest-max-serialized-utf8-bytes"] = limits.manifest;
    }
    for (const key of [
      "enabled_module_ids",
      "enabled_mission_ids",
      "effective_mission_ids",
      "acknowledged_event_ids",
    ]) {
      if (properties[key]) properties[key].uniqueItems = true;
    }
    if (properties.mission_ids && properties.presets && properties.options) {
      properties.mission_ids.uniqueItems = true;
    }
    if (properties.metricas) properties.metricas.maxProperties = 32;
    const eventProperties = dereference(
      dereference(properties.events)?.items,
    )?.properties;
    if (eventProperties) {
      properties.events["x-uniqueBy"] = [
        "request_id",
        "client_event_id",
      ].filter((key) => key in eventProperties);
    }
    for (const key of ["title", "summary", "label"]) {
      if (dereference(properties[key])?.type === "string")
        properties[key].pattern = "\\S";
    }
  }
  Object.values(node).forEach((value) =>
    addTransportConstraints(value, limits, root),
  );
}

try {
  const {
    contractSchemasV2,
    GAME_STATE_MAX_UTF8_BYTES,
    CONTENT_MANIFEST_MAX_UTF8_BYTES,
  } = await server.ssrLoadModule("/src/contracts/v2/schemas.ts");
  await mkdir(output, { recursive: true });
  for (const [name, schema] of Object.entries(contractSchemasV2)) {
    const jsonSchema = z.toJSONSchema(schema, {
      target: "draft-2020-12",
      reused: "ref",
    });
    addTransportConstraints(jsonSchema, {
      state: GAME_STATE_MAX_UTF8_BYTES,
      manifest: CONTENT_MANIFEST_MAX_UTF8_BYTES,
    });
    await writeFile(
      new URL(`${name}.v2.schema.json`, output),
      `${JSON.stringify(jsonSchema, null, 2)}\n`,
    );
  }
  console.log(`Generated ${Object.keys(contractSchemasV2).length} V2 schemas.`);
} finally {
  await server.close();
}
