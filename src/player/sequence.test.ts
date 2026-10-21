import { describe, expect, it } from "vitest";
import { Sequence } from "./sequence";

describe("Sequence", () => {
  it("seule la dernière demande est courante", () => {
    const s = new Sequence();
    const a = s.next();
    const b = s.next();
    expect(s.isCurrent(a)).toBe(false);
    expect(s.isCurrent(b)).toBe(true);
  });

  it("démarre sans demande courante", () => {
    expect(new Sequence().isCurrent(0)).toBe(false);
  });
});
