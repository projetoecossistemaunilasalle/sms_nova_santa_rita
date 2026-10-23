import { describe, expect, it } from "vitest";
import {
  matchesPlayerNumber,
  updateFilterQuery,
} from "@/components/portal/portal-filters";

describe("persistent portal filters", () => {
  it("preserves unrelated query parameters", () => {
    expect(
      updateFilterQuery("organization=school-a&new=1", { q: "Carla" }),
    ).toBe("?organization=school-a&new=1&q=Carla");
  });

  it("clears several filters together without leaving a query delimiter", () => {
    expect(
      updateFilterQuery("q=Carla&status=ACTIVE&organization=a", {
        q: "",
        status: "all",
        organization: "",
      }),
    ).toBe("");
  });

  it("encodes user input as data rather than extra query parameters", () => {
    const query = updateFilterQuery("", { q: "São & status=INACTIVE" });
    expect(new URLSearchParams(query).get("q")).toBe("São & status=INACTIVE");
    expect(new URLSearchParams(query).has("status")).toBe(false);
  });

  it("replaces duplicate filter values", () => {
    expect(updateFilterQuery("q=old&q=older", { q: "new" })).toBe("?q=new");
  });
});

describe("exact player lookup", () => {
  it("supports empty, padded and whitespace-wrapped numbers", () => {
    expect(matchesPlayerNumber(7, "")).toBe(true);
    expect(matchesPlayerNumber(7, " 07 ")).toBe(true);
    expect(matchesPlayerNumber(17, "7")).toBe(false);
  });

  it("rejects malformed and unmatched numbers", () => {
    for (const query of ["1e0", "-1", "1.0", "abc", "2"]) {
      expect(matchesPlayerNumber(1, query)).toBe(false);
    }
  });
});
