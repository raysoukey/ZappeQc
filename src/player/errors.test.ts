import { describe, expect, it } from "vitest";
import { isLabelConflict } from "./errors";

describe("isLabelConflict", () => {
  it("reconnaît l'erreur Tauri « a webview with label `player` already exists »", () => {
    expect(isLabelConflict(new Error("a webview with label `player` already exists"))).toBe(true);
    expect(isLabelConflict("A webview with label player ALREADY EXISTS")).toBe(true);
  });
  it("ne confond pas les autres erreurs", () => {
    expect(isLabelConflict(new Error("unstable feature not supported"))).toBe(false);
    expect(isLabelConflict(undefined)).toBe(false);
  });
});
