import { describe, expect, it } from "vitest";
import { RAIL_WIDTH, SIDEBAR_WIDTH, STRIP_WIDTH, playerRect, sidebarWidth } from "./layout";

const win = { width: 1280, height: 800 };

describe("playerRect", () => {
  it("barre ouverte", () => {
    expect(playerRect(win, { collapsed: false, fullscreen: false, revealed: false })).toEqual({
      x: SIDEBAR_WIDTH,
      y: 0,
      width: 1280 - SIDEBAR_WIDTH,
      height: 800,
    });
  });

  it("barre repliée", () => {
    expect(playerRect(win, { collapsed: true, fullscreen: false, revealed: false })).toEqual({
      x: RAIL_WIDTH,
      y: 0,
      width: 1280 - RAIL_WIDTH,
      height: 800,
    });
  });

  it("plein écran : seule la bande reste", () => {
    expect(playerRect(win, { collapsed: true, fullscreen: true, revealed: false })).toEqual({
      x: STRIP_WIDTH,
      y: 0,
      width: 1280 - STRIP_WIDTH,
      height: 800,
    });
  });

  it("plein écran révélé : la barre complète, même si elle était repliée", () => {
    expect(playerRect(win, { collapsed: true, fullscreen: true, revealed: true })).toEqual({
      x: SIDEBAR_WIDTH,
      y: 0,
      width: 1280 - SIDEBAR_WIDTH,
      height: 800,
    });
  });

  it("ne produit jamais de largeur ou hauteur négative", () => {
    const r = playerRect(
      { width: 200, height: 0 },
      { collapsed: false, fullscreen: false, revealed: false },
    );
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });

  it("arrondit en entiers", () => {
    const r = playerRect(
      { width: 1000.6, height: 700.4 },
      { collapsed: false, fullscreen: false, revealed: false },
    );
    expect(Number.isInteger(r.width)).toBe(true);
    expect(Number.isInteger(r.height)).toBe(true);
  });
});

describe("sidebarWidth", () => {
  it("suit les quatre états", () => {
    expect(sidebarWidth({ collapsed: false, fullscreen: false, revealed: false })).toBe(
      SIDEBAR_WIDTH,
    );
    expect(sidebarWidth({ collapsed: true, fullscreen: false, revealed: false })).toBe(RAIL_WIDTH);
    expect(sidebarWidth({ collapsed: false, fullscreen: true, revealed: false })).toBe(STRIP_WIDTH);
    expect(sidebarWidth({ collapsed: false, fullscreen: true, revealed: true })).toBe(
      SIDEBAR_WIDTH,
    );
  });
});
