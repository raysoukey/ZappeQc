import { describe, expect, it } from "vitest";
import { DEFAULT_ORDER } from "./channels";
import { DEFAULT_PREFS, applyPrefsAction, displayOrder, normalizePrefs, type Prefs } from "./prefs";

const base: Prefs = { ...DEFAULT_PREFS, order: [...DEFAULT_ORDER] };

describe("DEFAULT_PREFS", () => {
  it("contient toutes les chaînes, rien d'épinglé, barre ouverte", () => {
    expect(DEFAULT_PREFS.version).toBe(1);
    expect(DEFAULT_PREFS.lastChannelId).toBeNull();
    expect(DEFAULT_PREFS.order).toEqual([...DEFAULT_ORDER]);
    expect(DEFAULT_PREFS.pinned).toEqual([]);
    expect(DEFAULT_PREFS.sidebarCollapsed).toBe(false);
  });
});

describe("applyPrefsAction", () => {
  it("selectChannel mémorise la dernière chaîne", () => {
    expect(applyPrefsAction(base, { type: "selectChannel", id: "tva" }).lastChannelId).toBe("tva");
  });

  it("togglePin épingle puis désépingle", () => {
    const pinned = applyPrefsAction(base, { type: "togglePin", id: "noovo" });
    expect(pinned.pinned).toEqual(["noovo"]);
    expect(applyPrefsAction(pinned, { type: "togglePin", id: "noovo" }).pinned).toEqual([]);
  });

  it("setCollapsed change l'état de la barre", () => {
    expect(applyPrefsAction(base, { type: "setCollapsed", collapsed: true }).sidebarCollapsed).toBe(
      true,
    );
  });

  it("reorder déplace dans la liste affichée", () => {
    // affiché : ici-tele, tva, telequebec, noovo → déplacer noovo (3) en tête (0)
    const next = applyPrefsAction(base, { type: "reorder", from: 3, to: 0 });
    expect(displayOrder(next)).toEqual(["noovo", "ici-tele", "tva", "telequebec"]);
  });

  it("reorder qui entre dans la zone épinglée épingle l'élément", () => {
    const withPin = applyPrefsAction(base, { type: "togglePin", id: "tva" });
    // affiché : tva (épinglé) | ici-tele, telequebec, noovo → noovo (3) vers 0
    const next = applyPrefsAction(withPin, { type: "reorder", from: 3, to: 0 });
    expect(next.pinned).toEqual(["noovo", "tva"]);
    expect(displayOrder(next)).toEqual(["noovo", "tva", "ici-tele", "telequebec"]);
  });

  it("reorder qui sort de la zone épinglée désépingle l'élément", () => {
    const withPin = applyPrefsAction(base, { type: "togglePin", id: "tva" });
    // affiché : tva | ici-tele, telequebec, noovo → tva (0) vers 3
    const next = applyPrefsAction(withPin, { type: "reorder", from: 0, to: 3 });
    expect(next.pinned).toEqual([]);
    expect(displayOrder(next)).toEqual(["ici-tele", "telequebec", "noovo", "tva"]);
  });

  it("reorder avec un indice hors limites ne change rien", () => {
    expect(applyPrefsAction(base, { type: "reorder", from: 9, to: 0 })).toEqual(base);
    expect(applyPrefsAction(base, { type: "reorder", from: 0, to: -1 })).toEqual(base);
    expect(applyPrefsAction(base, { type: "reorder", from: 1, to: 1 })).toEqual(base);
  });
});

describe("displayOrder", () => {
  it("met les épinglés en tête, dans l'ordre de `order`", () => {
    const p: Prefs = { ...base, pinned: ["noovo", "tva"] };
    expect(displayOrder(p)).toEqual(["tva", "noovo", "ici-tele", "telequebec"]);
  });
});

describe("normalizePrefs", () => {
  it("renvoie les défauts pour undefined, null, une chaîne ou un tableau", () => {
    for (const raw of [undefined, null, "x", [], 3]) {
      expect(normalizePrefs(raw)).toEqual(DEFAULT_PREFS);
    }
  });

  it("complète les champs manquants", () => {
    expect(normalizePrefs({ lastChannelId: "tva" })).toEqual({
      ...DEFAULT_PREFS,
      lastChannelId: "tva",
    });
  });

  it("retire les ids inconnus et les doublons, et ajoute les chaînes manquantes à la fin", () => {
    const p = normalizePrefs({
      order: ["rdi", "tva", "tva", "noovo"],
      pinned: ["rdi", "noovo", "noovo"],
      lastChannelId: "rdi",
    });
    expect(p.order).toEqual(["tva", "noovo", "ici-tele", "telequebec"]);
    expect(p.pinned).toEqual(["noovo"]);
    expect(p.lastChannelId).toBeNull();
  });

  it("force sidebarCollapsed en booléen", () => {
    expect(normalizePrefs({ sidebarCollapsed: "oui" }).sidebarCollapsed).toBe(false);
    expect(normalizePrefs({ sidebarCollapsed: true }).sidebarCollapsed).toBe(true);
  });
});
