import { describe, expect, it } from "vitest";
import { pickLanguage } from "./i18n";
import en from "@/locales/en.json";
import ro from "@/locales/ro.json";

const keys = (o: object, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe("language choice", () => {
  it("saved choice wins", () => expect(pickLanguage("en", "ro-RO")).toBe("en"));
  it("Romanian phone defaults to Romanian", () => expect(pickLanguage(null, "ro-RO")).toBe("ro"));
  it("other phones default to English", () => expect(pickLanguage(null, "de-DE")).toBe("en"));
});

describe("locale files", () => {
  it("Romanian has every English key", () => expect(keys(ro).sort()).toEqual(keys(en).sort()));
  it("Romanian uses comma-below ș/ț, never cedilla ş/ţ", () => expect(JSON.stringify(ro)).not.toMatch(/[şţŞŢ]/));
});
