import { beforeEach, describe, expect, it } from "vitest";
import { loadAdvice, storeAdvice } from "./advice-store";

const item = (title: string) => ({ category: "documents" as const, priority: "should" as const, title, detail: "d", source: null });

describe("stored AI checklist items", () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v) };
  });
  it("keeps the first generated items for a trip and language", () => {
    storeAdvice("trip", { en: { items: [item("A"), item("B")] } });
    storeAdvice("trip", { en: { items: [item("C")] } });
    expect(loadAdvice("trip").en?.items.map((i) => i.title)).toEqual(["A", "B"]);
  });
  it("adds a new language without touching the other", () => {
    storeAdvice("trip", { en: { items: [item("A")] } });
    storeAdvice("trip", { ro: { items: [item("R")] } });
    expect(Object.keys(loadAdvice("trip")).sort()).toEqual(["en", "ro"]);
  });
});
