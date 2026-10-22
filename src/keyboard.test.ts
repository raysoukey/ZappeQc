import { describe, expect, it } from "vitest";
import type { ChannelId } from "./channels";
import { channelForDigit, digitLabel, keyToAction, nextChannel } from "./keyboard";

const k = (key: string, extra: Partial<Parameters<typeof keyToAction>[0]> = {}) =>
  keyToAction({ key, ctrlKey: false, altKey: false, metaKey: false, targetTag: "BODY", ...extra });

describe("keyToAction", () => {
  it("F et f basculent le plein écran", () => {
    expect(k("f")).toEqual({ type: "toggleFullscreen" });
    expect(k("F")).toEqual({ type: "toggleFullscreen" });
  });
  it("Échap quitte le plein écran", () => {
    expect(k("Escape")).toEqual({ type: "exitFullscreen" });
  });
  it("flèches haut/bas", () => {
    expect(k("ArrowUp")).toEqual({ type: "step", delta: -1 });
    expect(k("ArrowDown")).toEqual({ type: "step", delta: 1 });
  });
  it("chiffres 1 à 9 → indice 0 à 8, 0 ignoré", () => {
    expect(k("1")).toEqual({ type: "digit", index: 0 });
    expect(k("9")).toEqual({ type: "digit", index: 8 });
    expect(k("0")).toBeNull();
  });
  it("Ctrl+B replie, B seul ne fait rien", () => {
    expect(k("b", { ctrlKey: true })).toEqual({ type: "toggleCollapsed" });
    expect(k("b")).toBeNull();
  });
  it("ignore les raccourcis dans un champ texte", () => {
    expect(k("f", { targetTag: "INPUT" })).toBeNull();
    expect(k("f", { targetTag: "TEXTAREA" })).toBeNull();
    expect(k("Escape", { targetTag: "INPUT" })).toEqual({ type: "exitFullscreen" });
  });
  it("ignore les combinaisons avec Alt ou Meta", () => {
    expect(k("f", { altKey: true })).toBeNull();
    expect(k("f", { metaKey: true })).toBeNull();
  });
});

const shown: ChannelId[] = ["ici-tele", "tva", "telequebec", "noovo"];

describe("nextChannel", () => {
  it("avance et recule avec bouclage", () => {
    expect(nextChannel(shown, "tva", 1)).toBe("telequebec");
    expect(nextChannel(shown, "noovo", 1)).toBe("ici-tele");
    expect(nextChannel(shown, "ici-tele", -1)).toBe("noovo");
  });
  it("sans chaîne courante, prend la première", () => {
    expect(nextChannel(shown, null, 1)).toBe("ici-tele");
    expect(nextChannel(shown, null, -1)).toBe("ici-tele");
  });
  it("liste vide → null", () => {
    expect(nextChannel([], null, 1)).toBeNull();
  });
});

describe("channelForDigit", () => {
  it("renvoie la chaîne à l'indice ou null hors limites", () => {
    expect(channelForDigit(shown, 1)).toBe("tva");
    expect(channelForDigit(shown, 7)).toBeNull();
  });
});

describe("keyToAction — répétition et événements déjà traités", () => {
  it("ignore la répétition clavier pour le zapping, pas pour le plein écran", () => {
    expect(k("ArrowDown", { repeat: true })).toBeNull();
    expect(k("3", { repeat: true })).toBeNull();
    expect(k("f", { repeat: true })).toEqual({ type: "toggleFullscreen" });
  });
  it("ignore un événement déjà consommé (defaultPrevented) par un autre composant", () => {
    expect(k("ArrowDown", { defaultPrevented: true })).toBeNull();
    expect(k("f", { defaultPrevented: true })).toBeNull();
  });
});

describe("digitLabel", () => {
  it("donne 1 à 9 pour les indices 0 à 8, rien au-delà", () => {
    expect(digitLabel(0)).toBe("1");
    expect(digitLabel(8)).toBe("9");
    expect(digitLabel(9)).toBeNull();
    expect(digitLabel(-1)).toBeNull();
  });
});
