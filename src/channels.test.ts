import { describe, expect, it } from "vitest";
import { CHANNELS, DEFAULT_ORDER, channelById, isChannelId } from "./channels";

describe("CHANNELS", () => {
  it("a des ids uniques", () => {
    const ids = CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("n'a que des URL https valides", () => {
    for (const c of CHANNELS) {
      expect(() => new URL(c.url)).not.toThrow();
      expect(c.url.startsWith("https://")).toBe(true);
    }
  });

  it("couvre toutes les chaînes une fois dans DEFAULT_ORDER", () => {
    expect([...DEFAULT_ORDER].sort()).toEqual(CHANNELS.map((c) => c.id).sort());
  });

  it("marque ICI Télé et Noovo comme exigeant un compte, pas TVA ni Télé-Québec", () => {
    expect(channelById("ici-tele").requiresAccount).toBe(true);
    expect(channelById("noovo").requiresAccount).toBe(true);
    expect(channelById("tva").requiresAccount).toBe(false);
    expect(channelById("telequebec").requiresAccount).toBe(false);
  });

  it("isChannelId reconnaît les ids connus seulement", () => {
    expect(isChannelId("tva")).toBe(true);
    expect(isChannelId("rdi")).toBe(false);
    expect(isChannelId(42)).toBe(false);
  });
});
