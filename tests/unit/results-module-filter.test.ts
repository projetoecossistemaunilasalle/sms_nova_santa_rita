import { describe, expect, it } from "vitest";
import {
  buildModuleOptions,
  mapModuleTotals,
  metricLabel,
  metricNote,
  parseModuleParam,
  resultsHref,
  UNATTRIBUTED_MODULE_LABEL,
} from "@/components/portal/results-helpers";

describe("module filter param", () => {
  it("accepts a stable module id and ignores anything else", () => {
    expect(parseModuleParam("modulo_1")).toBe("modulo_1");
    expect(parseModuleParam(["modulo_1", "outro"])).toBe("modulo_1");
    expect(parseModuleParam("Módulo 1")).toBeUndefined();
    expect(parseModuleParam("a/../b")).toBeUndefined();
    expect(parseModuleParam("")).toBeUndefined();
    expect(parseModuleParam(undefined)).toBeUndefined();
    expect(parseModuleParam(null)).toBeUndefined();
    expect(parseModuleParam("a".repeat(65))).toBeUndefined();
  });

  it("builds shareable hrefs only when a module is selected", () => {
    expect(resultsHref("/portal/resultados/c1")).toBe("/portal/resultados/c1");
    expect(resultsHref("/portal/resultados/c1", "m1")).toBe(
      "/portal/resultados/c1?modulo=m1",
    );
  });
});

describe("module options and totals", () => {
  const manifestModules = [
    { id: "m1", label: "Respeito" },
    { id: "m2", label: "Empatia" },
  ];

  it("keeps manifest order and appends modules known only from totals", () => {
    const options = buildModuleOptions(
      manifestModules,
      [{ moduleId: "antigo" }, { moduleId: null }, { moduleId: "m2" }],
      "selecionado",
    );
    expect(options.map((item) => item.id)).toEqual([
      "m1",
      "m2",
      "antigo",
      "selecionado",
    ]);
    expect(options[2]?.label).toBe("antigo");
  });

  it("maps totals to labelled rows, unattributed time last", () => {
    const options = buildModuleOptions(manifestModules, []);
    const rows = mapModuleTotals(
      [
        { moduleId: null, totalActiveMs: 5000, resultCount: 0 },
        { moduleId: "m2", totalActiveMs: 2000, resultCount: 3 },
        { moduleId: "m1", totalActiveMs: 1000, resultCount: 1 },
      ],
      options,
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Respeito",
      "Empatia",
      UNATTRIBUTED_MODULE_LABEL,
    ]);
    expect(rows[1]).toMatchObject({ totalActiveMs: 2000, resultCount: 3 });
  });
});

describe("metric labels", () => {
  it("prefers the manifest label and falls back to a readable key", () => {
    expect(
      metricLabel("situacoes_classificadas", {
        situacoes_classificadas: "Situações classificadas",
      }),
    ).toBe("Situações classificadas");
    expect(metricLabel("tentativas_extras", {})).toBe("tentativas extras");
  });

  it("never describes classified situations as correct answers", () => {
    const note = metricNote("situacoes_classificadas");
    expect(note).toContain("não indica");
    expect(note).not.toMatch(/acerto/i);
    expect(metricNote("outra_metrica")).toBeUndefined();
  });
});
