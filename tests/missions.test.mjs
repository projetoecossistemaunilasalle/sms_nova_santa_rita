import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/config/missions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { MISSOES, TOTAL_MINIGAMES } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("landing catalog matches Heroes_Trial@84e44ca mission and activity IDs", () => {
  assert.deepEqual(
    MISSOES.map(({ id, atividadeId }) => [id, atividadeId]),
    [
      ["lia_memory", "lia_memory"],
      ["pingpong_soccer", "pingpong_defense"],
      ["respect_also_cares", "comfort_traffic_light"],
      ["when_play_stops_being_play", null],
      ["brushing_teeth", "brushing_teeth_practice"],
      ["smile_kit", "smile_kit_selection"],
    ],
  );
  assert.equal(TOTAL_MINIGAMES, 5);
});

test("each mission has distinct, complete presentation content", () => {
  assert.equal(new Set(MISSOES.map(({ id }) => id)).size, MISSOES.length);
  for (const mission of MISSOES) {
    for (const field of ["titulo", "texto", "lugar", "atividade", "cor", "icone"]) {
      assert.ok(mission[field].trim(), `${mission.id}: missing ${field}`);
    }
  }
  assert.equal(MISSOES.find(({ id }) => id === "brushing_teeth").lugar, "Banheiro");
  assert.equal(MISSOES.find(({ id }) => id === "smile_kit").lugar, "Refeitório");
});
