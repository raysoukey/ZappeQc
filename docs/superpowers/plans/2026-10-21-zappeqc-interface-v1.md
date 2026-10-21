# Interface v1 ZappeQc — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Barre de chaînes repliable à gauche, page de direct du diffuseur dans une webview enfant à droite, avec plein écran, raccourcis clavier, favoris réordonnables, badge « compte requis » et effacement des données de navigation.

**Architecture:** L'interface React vit dans la webview principale de la fenêtre `main`. Une seule webview enfant Tauri (label `player`) charge l'URL de direct de la chaîne choisie ; changer de chaîne la ferme et la recrée. Toute la logique (table des chaînes, préférences, rectangle de la webview, mappage clavier) est dans des modules purs testés par Vitest ; les hooks React ne font que brancher ces modules sur l'API Tauri et sur l'état.

**Tech Stack:** Tauri v2 (`@tauri-apps/api` 2.12, feature `unstable`), `@tauri-apps/plugin-store` 2.5, React 19, Vite 8, TypeScript 6 strict, Vitest 5, `@dnd-kit/core` 6 + `@dnd-kit/sortable` 10 + `@dnd-kit/utilities` 3, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-21-zappeqc-interface-design.md` (et `2026-10-21-zappeqc-architecture.md` pour la pile et le relevé des URL).

## Global Constraints

- Windows seulement ; WebView2 ; feature Cargo `unstable` déjà active ; **aucun code Rust nouveau**.
- Une seule webview enfant à la fois, label `player`.
- Jamais d'extraction de flux ni de contournement DRM ; on charge les pages officielles telles quelles.
- Logos : monogrammes texte sur fond coloré, jamais les logos officiels.
- Libellés d'interface en français québécois.
- Largeurs : barre ouverte `240`, rail replié `64`, bande de révélation en plein écran `6` (pixels logiques).
- Préférences dans `zappeqc.json` (plugin store, `autoSave: true`), clé `prefs`, `version: 1`.
- Tests Vitest uniquement sur la logique pure (`src/**/*.test.ts`), pas de test de rendu.
- Commandes : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm tauri dev` (toujours en arrière-plan), `.\scripts\dev-debug.ps1` pour l'inspection CDP.
- Raccourcis exacts : `F` / double-clic en-tête = plein écran ; `Échap` = quitter ; `↑`/`↓` = chaîne précédente/suivante ; `1`–`9` = N-ième chaîne ; `Ctrl+B` = replier.
- Délai de masquage de la barre révélée en plein écran : `1500` ms.

## Review Focus

1. Préférences enregistrées par une version future contenant un id de chaîne inconnu ou un doublon : l'app doit démarrer avec la liste complète et sans doublon (test dans la tâche 2).
2. Fenêtre plus étroite que la barre (ex. 200 px pendant un redimensionnement) : le rectangle de la webview ne doit jamais avoir de largeur négative (test dans la tâche 3).
3. Glisser-déposer avec un indice hors limites (dnd-kit peut émettre `over === null`) : les préférences restent inchangées (test dans la tâche 2).
4. Frappe d'un raccourci pendant que le focus est dans un champ texte (le bouton de confirmation ou un futur champ) : le raccourci ne doit pas agir (test dans la tâche 8).
5. Deux clics rapides sur deux chaînes : seule la dernière demande doit s'appliquer, la première création de webview ne doit pas écraser l'état (garde de séquence testée dans la tâche 5).

---

### Task 1: Vitest et table des chaînes

**Files:**

- Modify: `vite.config.ts`
- Create: `src/channels.ts`
- Test: `src/channels.test.ts`

**Interfaces:**

- Produces: `type ChannelId = "tva" | "telequebec" | "ici-tele" | "noovo"`, `interface Channel`, `CHANNELS: readonly Channel[]`, `DEFAULT_ORDER: readonly ChannelId[]`, `channelById(id: ChannelId): Channel`, `isChannelId(x: unknown): x is ChannelId`.

- [ ] **Step 1: Activer Vitest dans la config Vite**

Remplacer la première ligne de `vite.config.ts` et ajouter le bloc `test` :

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },

  // (le reste du fichier — clearScreen, server — reste identique)
```

- [ ] **Step 2: Écrire le test qui échoue**

`src/channels.test.ts` :

```ts
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
```

- [ ] **Step 3: Vérifier que le test échoue**

Run: `pnpm test`
Expected: FAIL, `Cannot find module './channels'` (ou équivalent).

- [ ] **Step 4: Écrire `src/channels.ts`**

```ts
export type ChannelId = "tva" | "telequebec" | "ici-tele" | "noovo";

export interface Channel {
  id: ChannelId;
  name: string;
  monogram: string;
  color: string;
  url: string;
  provider: string;
  requiresAccount: boolean;
}

// URL relevées le 2026-10-21 (voir spec d'architecture, section « Relevé des directs »).
export const CHANNELS: readonly Channel[] = [
  {
    id: "ici-tele",
    name: "ICI Télé",
    monogram: "ICI",
    color: "#e4002b",
    url: "https://ici.tou.tv/chaine/ici-tele-montreal",
    provider: "ICI TOU.TV",
    requiresAccount: true,
  },
  {
    id: "tva",
    name: "TVA",
    monogram: "TVA",
    color: "#0a66c2",
    url: "https://www.tvaplus.ca/tva/en-direct",
    provider: "TVA+",
    requiresAccount: false,
  },
  {
    id: "telequebec",
    name: "Télé-Québec",
    monogram: "TQ",
    color: "#ff6a13",
    url: "https://telequebec.tv/regarder/en-direct/telequebec",
    provider: "Télé-Québec",
    requiresAccount: false,
  },
  {
    id: "noovo",
    name: "Noovo",
    monogram: "NV",
    color: "#7a3ff2",
    url: "https://www.crave.ca/fr/live?channel=noovo&group=allchannels",
    provider: "Crave",
    requiresAccount: true,
  },
];

export const DEFAULT_ORDER: readonly ChannelId[] = CHANNELS.map((c) => c.id);

const BY_ID = new Map<ChannelId, Channel>(CHANNELS.map((c) => [c.id, c]));

export function channelById(id: ChannelId): Channel {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Chaîne inconnue : ${id}`);
  return c;
}

export function isChannelId(x: unknown): x is ChannelId {
  return typeof x === "string" && BY_ID.has(x as ChannelId);
}
```

- [ ] **Step 5: Vérifier que les tests passent**

Run: `pnpm test`
Expected: PASS, 5 tests.

- [ ] **Step 6: Lint, format, commit**

```bash
pnpm lint && pnpm format:check
git add vite.config.ts src/channels.ts src/channels.test.ts
git commit -m "Table des chaînes et configuration Vitest"
```

---

### Task 2: Préférences (types, défauts, réducteur, normalisation)

**Files:**

- Create: `src/prefs.ts`
- Test: `src/prefs.test.ts`

**Interfaces:**

- Consumes: `ChannelId`, `DEFAULT_ORDER`, `isChannelId` (tâche 1).
- Produces: `interface Prefs`, `DEFAULT_PREFS`, `type PrefsAction`, `applyPrefsAction(prefs, action): Prefs`, `displayOrder(prefs): ChannelId[]`, `normalizePrefs(raw: unknown): Prefs`.

- [ ] **Step 1: Écrire les tests qui échouent**

`src/prefs.test.ts` :

```ts
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
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `pnpm test`
Expected: FAIL, `Cannot find module './prefs'`.

- [ ] **Step 3: Écrire `src/prefs.ts`**

```ts
import { DEFAULT_ORDER, isChannelId, type ChannelId } from "./channels";

export interface Prefs {
  version: 1;
  lastChannelId: ChannelId | null;
  order: ChannelId[];
  pinned: ChannelId[];
  sidebarCollapsed: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  version: 1,
  lastChannelId: null,
  order: [...DEFAULT_ORDER],
  pinned: [],
  sidebarCollapsed: false,
};

export type PrefsAction =
  | { type: "selectChannel"; id: ChannelId }
  | { type: "togglePin"; id: ChannelId }
  | { type: "reorder"; from: number; to: number }
  | { type: "setCollapsed"; collapsed: boolean };

/** Liste affichée : épinglés d'abord (dans l'ordre de `order`), puis les autres. */
export function displayOrder(prefs: Prefs): ChannelId[] {
  const pinned = prefs.order.filter((id) => prefs.pinned.includes(id));
  const rest = prefs.order.filter((id) => !prefs.pinned.includes(id));
  return [...pinned, ...rest];
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function applyPrefsAction(prefs: Prefs, action: PrefsAction): Prefs {
  switch (action.type) {
    case "selectChannel":
      return { ...prefs, lastChannelId: action.id };
    case "togglePin":
      return {
        ...prefs,
        pinned: prefs.pinned.includes(action.id)
          ? prefs.pinned.filter((id) => id !== action.id)
          : [...prefs.pinned, action.id],
      };
    case "setCollapsed":
      return { ...prefs, sidebarCollapsed: action.collapsed };
    case "reorder": {
      const shown = displayOrder(prefs);
      const { from, to } = action;
      const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < shown.length;
      if (!inRange(from) || !inRange(to) || from === to) return prefs;
      let pinnedCount = prefs.pinned.length;
      if (from < pinnedCount && to >= pinnedCount) pinnedCount -= 1;
      else if (from >= pinnedCount && to < pinnedCount) pinnedCount += 1;
      const moved = move(shown, from, to);
      return { ...prefs, order: moved, pinned: moved.slice(0, pinnedCount) };
    }
  }
}

function uniqueKnown(raw: unknown): ChannelId[] {
  if (!Array.isArray(raw)) return [];
  const out: ChannelId[] = [];
  for (const x of raw) if (isChannelId(x) && !out.includes(x)) out.push(x);
  return out;
}

export function normalizePrefs(raw: unknown): Prefs {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { ...DEFAULT_PREFS, order: [...DEFAULT_ORDER] };
  const r = raw as Record<string, unknown>;
  const order = uniqueKnown(r.order);
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  const pinned = uniqueKnown(r.pinned).filter((id) => order.includes(id));
  return {
    version: 1,
    lastChannelId: isChannelId(r.lastChannelId) ? r.lastChannelId : null,
    order,
    pinned,
    sidebarCollapsed: r.sidebarCollapsed === true,
  };
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm test`
Expected: PASS (tests des tâches 1 et 2).

- [ ] **Step 5: Lint, format, commit**

```bash
pnpm lint && pnpm format:check
git add src/prefs.ts src/prefs.test.ts
git commit -m "Préférences : réducteur pur et normalisation"
```

---

### Task 3: Rectangle de la webview enfant

**Files:**

- Create: `src/layout.ts`
- Test: `src/layout.test.ts`

**Interfaces:**

- Produces: `interface Size { width: number; height: number }`, `interface Rect { x; y; width; height }`, `interface LayoutState { collapsed: boolean; fullscreen: boolean; revealed: boolean }`, constantes `SIDEBAR_WIDTH = 240`, `RAIL_WIDTH = 64`, `STRIP_WIDTH = 6`, `REVEAL_HIDE_DELAY_MS = 1500`, `sidebarWidth(state): number`, `playerRect(win: Size, state: LayoutState): Rect`.

- [ ] **Step 1: Écrire les tests qui échouent**

`src/layout.test.ts` :

```ts
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
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `pnpm test`
Expected: FAIL, `Cannot find module './layout'`.

- [ ] **Step 3: Écrire `src/layout.ts`**

```ts
export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutState {
  collapsed: boolean;
  fullscreen: boolean;
  revealed: boolean;
}

export const SIDEBAR_WIDTH = 240;
export const RAIL_WIDTH = 64;
export const STRIP_WIDTH = 6;
export const REVEAL_HIDE_DELAY_MS = 1500;

export function sidebarWidth(state: LayoutState): number {
  if (state.fullscreen) return state.revealed ? SIDEBAR_WIDTH : STRIP_WIDTH;
  return state.collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH;
}

export function playerRect(win: Size, state: LayoutState): Rect {
  const x = sidebarWidth(state);
  return {
    x,
    y: 0,
    width: Math.max(0, Math.round(win.width - x)),
    height: Math.max(0, Math.round(win.height)),
  };
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Lint, format, commit**

```bash
pnpm lint && pnpm format:check
git add src/layout.ts src/layout.test.ts
git commit -m "Calcul du rectangle de la webview enfant"
```

---

### Task 4: Persistance des préférences (plugin store)

**Files:**

- Create: `src/store.ts`

**Interfaces:**

- Consumes: `Prefs`, `DEFAULT_PREFS`, `normalizePrefs` (tâche 2).
- Produces: `loadPrefs(): Promise<Prefs>`, `savePrefs(prefs: Prefs): Promise<void>`.

Pas de test unitaire : ce module n'existe que pour parler au runtime Tauri. Toute logique est dans `normalizePrefs` (déjà testée).

- [ ] **Step 1: Écrire `src/store.ts`**

```ts
import { load, type Store } from "@tauri-apps/plugin-store";
import { DEFAULT_PREFS, normalizePrefs, type Prefs } from "./prefs";

const FILE = "zappeqc.json";
const KEY = "prefs";

let storePromise: Promise<Store> | null = null;

function store(): Promise<Store> {
  storePromise ??= load(FILE, { autoSave: true });
  return storePromise;
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await (await store()).get<unknown>(KEY);
    return normalizePrefs(raw);
  } catch (e) {
    console.warn("Préférences illisibles, retour aux défauts :", e);
    storePromise = null;
    return { ...DEFAULT_PREFS, order: [...DEFAULT_PREFS.order] };
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  try {
    await (await store()).set(KEY, prefs);
  } catch (e) {
    console.warn("Échec de sauvegarde des préférences :", e);
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/store.ts
git commit -m "Persistance des préférences via le plugin store"
```

---

### Task 5: Cycle de vie de la webview enfant

**Files:**

- Create: `src/player/playerWebview.ts`
- Create: `src/player/sequence.ts`
- Create: `src/player/usePlayer.ts`
- Test: `src/player/sequence.test.ts`

**Interfaces:**

- Consumes: `Rect`, `Size`, `LayoutState`, `playerRect` (tâche 3) ; `ChannelId`, `channelById` (tâche 1).
- Produces:
  - `playerWebview.ts` : `PLAYER_LABEL = "player"`, `windowLogicalSize(): Promise<Size>`, `openPlayer(url: string, rect: Rect): Promise<void>`, `relayoutPlayer(rect: Rect): Promise<void>`, `closePlayer(): Promise<void>`, `clearPlayerData(): Promise<void>`, `hasPlayer(): Promise<boolean>`.
  - `sequence.ts` : `class Sequence { next(): number; isCurrent(n: number): boolean }`.
  - `usePlayer.ts` : `type PlayerStatus = "idle" | "loading" | "ready" | "error"`, `interface PlayerState { channelId: ChannelId | null; status: PlayerStatus; error: string | null }`, `usePlayer(layout: LayoutState): { state: PlayerState; open(id: ChannelId): void; retry(): void; clearData(): Promise<void> }`.

- [ ] **Step 1: Test de la garde de séquence (échoue)**

`src/player/sequence.test.ts` :

```ts
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
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm test`
Expected: FAIL, `Cannot find module './sequence'`.

- [ ] **Step 3: Écrire `src/player/sequence.ts`**

```ts
/** Garde contre les résultats périmés : seule la dernière demande compte. */
export class Sequence {
  private current = 0;

  next(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(n: number): boolean {
    return n !== 0 && n === this.current;
  }
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Écrire `src/player/playerWebview.ts` (adaptateur Tauri, non testé)**

```ts
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Rect, Size } from "../layout";

export const PLAYER_LABEL = "player";

export async function windowLogicalSize(): Promise<Size> {
  const win = getCurrentWindow();
  const [physical, scale] = await Promise.all([win.innerSize(), win.scaleFactor()]);
  const logical = physical.toLogical(scale);
  return { width: logical.width, height: logical.height };
}

export async function hasPlayer(): Promise<boolean> {
  return (await Webview.getByLabel(PLAYER_LABEL)) !== null;
}

export async function closePlayer(): Promise<void> {
  const existing = await Webview.getByLabel(PLAYER_LABEL);
  if (!existing) return;
  try {
    await existing.close();
  } catch (e) {
    console.warn("Fermeture de la webview player ignorée :", e);
  }
}

/** Crée la webview enfant ; résout sur tauri://created, rejette sur tauri://error. */
export async function openPlayer(url: string, rect: Rect): Promise<void> {
  await closePlayer();
  await new Promise<void>((resolve, reject) => {
    const wv = new Webview(getCurrentWindow(), PLAYER_LABEL, { url, ...rect });
    void wv.once("tauri://created", () => resolve());
    void wv.once<unknown>("tauri://error", (e) => reject(new Error(String(e.payload))));
  });
}

export async function relayoutPlayer(rect: Rect): Promise<void> {
  const wv = await Webview.getByLabel(PLAYER_LABEL);
  if (!wv) return;
  await wv.setPosition(new LogicalPosition(rect.x, rect.y));
  await wv.setSize(new LogicalSize(rect.width, rect.height));
}

export async function clearPlayerData(): Promise<void> {
  const wv = await Webview.getByLabel(PLAYER_LABEL);
  if (!wv) return;
  await wv.clearAllBrowsingData();
}
```

- [ ] **Step 6: Écrire `src/player/usePlayer.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { channelById, type ChannelId } from "../channels";
import { playerRect, type LayoutState } from "../layout";
import { clearPlayerData, openPlayer, relayoutPlayer, windowLogicalSize } from "./playerWebview";
import { Sequence } from "./sequence";

export type PlayerStatus = "idle" | "loading" | "ready" | "error";

export interface PlayerState {
  channelId: ChannelId | null;
  status: PlayerStatus;
  error: string | null;
}

const IDLE: PlayerState = { channelId: null, status: "idle", error: null };

export function usePlayer(layout: LayoutState) {
  const [state, setState] = useState<PlayerState>(IDLE);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const seq = useRef(new Sequence());

  const open = useCallback((id: ChannelId) => {
    const n = seq.current.next();
    setState({ channelId: id, status: "loading", error: null });
    void (async () => {
      try {
        const rect = playerRect(await windowLogicalSize(), layoutRef.current);
        await openPlayer(channelById(id).url, rect);
        if (seq.current.isCurrent(n)) setState({ channelId: id, status: "ready", error: null });
      } catch (e) {
        if (seq.current.isCurrent(n))
          setState({ channelId: id, status: "error", error: String(e) });
      }
    })();
  }, []);

  const retry = useCallback(() => {
    if (state.channelId) open(state.channelId);
  }, [open, state.channelId]);

  const clearData = useCallback(async () => {
    await clearPlayerData();
    if (state.channelId) open(state.channelId);
  }, [open, state.channelId]);

  // Repositionner la webview à chaque changement de disposition ou de taille de fenêtre.
  useEffect(() => {
    let cancelled = false;
    const relayout = async () => {
      const rect = playerRect(await windowLogicalSize(), layoutRef.current);
      if (!cancelled) await relayoutPlayer(rect);
    };
    void relayout();
    const unlisten = getCurrentWindow().onResized(() => void relayout());
    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn());
    };
  }, [layout.collapsed, layout.fullscreen, layout.revealed]);

  return { state, open, retry, clearData };
}
```

- [ ] **Step 7: Compilation, lint, commit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: aucune erreur, tests PASS.

```bash
git add src/player
git commit -m "Cycle de vie de la webview enfant (usePlayer)"
```

---

### Task 6: Composants de la barre de chaînes

**Files:**

- Create: `src/components/ChannelItem.tsx`
- Create: `src/components/AccountBadge.tsx`
- Create: `src/components/ChannelList.tsx`
- Create: `src/components/PlayerError.tsx`
- Create: `src/components/Sidebar.tsx`
- Modify: `src/App.css` (remplacer entièrement)

**Interfaces:**

- Consumes: `Channel`, `ChannelId` (tâche 1) ; `PlayerState` (tâche 5) ; `SIDEBAR_WIDTH`, `RAIL_WIDTH` (tâche 3).
- Produces: `Sidebar` avec les props ci-dessous (utilisées par `App` en tâche 7).

```ts
export interface SidebarProps {
  channels: Channel[]; // déjà dans l'ordre d'affichage
  selectedId: ChannelId | null;
  pinned: ChannelId[];
  collapsed: boolean;
  player: PlayerState;
  onSelect(id: ChannelId): void;
  onTogglePin(id: ChannelId): void;
  onReorder(from: number, to: number): void;
  onToggleCollapsed(): void;
  onToggleFullscreen(): void;
  onRetry(): void;
  onClearData(): Promise<void>;
}
```

- [ ] **Step 1: Installer dnd-kit**

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: `src/components/AccountBadge.tsx`**

```tsx
interface Props {
  provider: string;
  compact: boolean;
}

export function AccountBadge({ provider, compact }: Props) {
  const title = `Compte gratuit requis chez ${provider}. La connexion se fait dans le lecteur.`;
  return (
    <span className={compact ? "badge badge-dot" : "badge"} title={title} aria-label={title}>
      {compact ? "" : "Compte"}
    </span>
  );
}
```

- [ ] **Step 3: `src/components/ChannelItem.tsx` (élément triable)**

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Channel, ChannelId } from "../channels";
import { AccountBadge } from "./AccountBadge";

interface Props {
  channel: Channel;
  index: number;
  selected: boolean;
  pinned: boolean;
  collapsed: boolean;
  onSelect(id: ChannelId): void;
  onTogglePin(id: ChannelId): void;
}

export function ChannelItem({
  channel,
  index,
  selected,
  pinned,
  collapsed,
  onSelect,
  onTogglePin,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: channel.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const title = collapsed ? `${index + 1}. ${channel.name}` : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={["channel", selected ? "selected" : "", isDragging ? "dragging" : ""].join(" ")}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="channel-main"
        title={title}
        onClick={() => onSelect(channel.id)}
      >
        <span className="monogram" style={{ background: channel.color }}>
          {channel.monogram}
        </span>
        {!collapsed && <span className="channel-name">{channel.name}</span>}
        {channel.requiresAccount && (
          <AccountBadge provider={channel.provider} compact={collapsed} />
        )}
      </button>
      {!collapsed && (
        <button
          type="button"
          className={pinned ? "pin pinned" : "pin"}
          title={pinned ? "Retirer des favoris" : "Épingler en favori"}
          aria-pressed={pinned}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(channel.id);
          }}
        >
          ★
        </button>
      )}
    </li>
  );
}
```

- [ ] **Step 4: `src/components/ChannelList.tsx`**

```tsx
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Channel, ChannelId } from "../channels";
import { ChannelItem } from "./ChannelItem";

interface Props {
  channels: Channel[];
  selectedId: ChannelId | null;
  pinned: ChannelId[];
  collapsed: boolean;
  onSelect(id: ChannelId): void;
  onTogglePin(id: ChannelId): void;
  onReorder(from: number, to: number): void;
}

export function ChannelList({
  channels,
  selectedId,
  pinned,
  collapsed,
  onSelect,
  onTogglePin,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = channels.map((c) => c.id);

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    onReorder(ids.indexOf(e.active.id as ChannelId), ids.indexOf(e.over.id as ChannelId));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="channel-list" aria-label="Chaînes">
          {channels.map((c, i) => (
            <ChannelItem
              key={c.id}
              channel={c}
              index={i}
              selected={c.id === selectedId}
              pinned={pinned.includes(c.id)}
              collapsed={collapsed}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 5: `src/components/PlayerError.tsx`**

```tsx
interface Props {
  message: string;
  onRetry(): void;
}

export function PlayerError({ message, onRetry }: Props) {
  return (
    <div className="player-error" role="alert">
      <p>Impossible d'ouvrir le lecteur.</p>
      <p className="player-error-detail">{message}</p>
      <button type="button" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}
```

- [ ] **Step 6: `src/components/Sidebar.tsx`**

```tsx
import { useState } from "react";
import type { Channel, ChannelId } from "../channels";
import type { PlayerState } from "../player/usePlayer";
import { ChannelList } from "./ChannelList";
import { PlayerError } from "./PlayerError";

export interface SidebarProps {
  channels: Channel[];
  selectedId: ChannelId | null;
  pinned: ChannelId[];
  collapsed: boolean;
  player: PlayerState;
  onSelect(id: ChannelId): void;
  onTogglePin(id: ChannelId): void;
  onReorder(from: number, to: number): void;
  onToggleCollapsed(): void;
  onToggleFullscreen(): void;
  onRetry(): void;
  onClearData(): Promise<void>;
}

const SHORTCUTS_HELP =
  "Raccourcis : F plein écran, Échap quitter, ↑/↓ changer de chaîne, 1-9 chaîne directe, Ctrl+B replier. " +
  "Ils fonctionnent quand cette barre a le focus : cliquez-la après avoir cliqué dans le lecteur.";

export function Sidebar(p: SidebarProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function clearData() {
    setClearing(true);
    try {
      await p.onClearData();
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <aside
      className={p.collapsed ? "sidebar collapsed" : "sidebar"}
      title={p.collapsed ? SHORTCUTS_HELP : undefined}
    >
      <header
        className="sidebar-header"
        onDoubleClick={p.onToggleFullscreen}
        title={SHORTCUTS_HELP}
      >
        {!p.collapsed && <h1>ZappeQc</h1>}
        <button
          type="button"
          className="collapse"
          onClick={p.onToggleCollapsed}
          title={p.collapsed ? "Déplier la barre (Ctrl+B)" : "Replier la barre (Ctrl+B)"}
          aria-label={p.collapsed ? "Déplier" : "Replier"}
        >
          {p.collapsed ? "›" : "‹"}
        </button>
      </header>

      <ChannelList
        channels={p.channels}
        selectedId={p.selectedId}
        pinned={p.pinned}
        collapsed={p.collapsed}
        onSelect={p.onSelect}
        onTogglePin={p.onTogglePin}
        onReorder={p.onReorder}
      />

      {p.player.status === "error" && !p.collapsed && (
        <PlayerError message={p.player.error ?? "Erreur inconnue"} onRetry={p.onRetry} />
      )}

      {!p.collapsed && (
        <footer className="sidebar-footer">
          {p.player.status === "loading" && <p className="status">Chargement…</p>}
          {confirmClear ? (
            <div className="confirm">
              <p>Vous serez déconnecté des sites des diffuseurs. Confirmer ?</p>
              <button type="button" onClick={clearData} disabled={clearing}>
                {clearing ? "Effacement…" : "Confirmer"}
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} disabled={clearing}>
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="clear-data"
              disabled={p.player.status !== "ready"}
              onClick={() => setConfirmClear(true)}
              title="Supprime témoins et connexions des sites des diffuseurs"
            >
              Effacer les données de navigation
            </button>
          )}
        </footer>
      )}
    </aside>
  );
}
```

- [ ] **Step 7: Remplacer `src/App.css`**

```css
:root {
  font-family: system-ui, "Segoe UI", sans-serif;
  color: #f3f3f3;
  background-color: #121212;
  color-scheme: dark;
  --sidebar: 240px;
  --rail: 64px;
  --strip: 6px;
  --accent: #4da3ff;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  overflow: hidden;
  user-select: none;
}

.app {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: var(--sidebar);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #181818;
  border-right: 1px solid #2a2a2a;
}

.sidebar.collapsed {
  width: var(--rail);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a2a;
}

.sidebar.collapsed .sidebar-header {
  justify-content: center;
}

.sidebar-header h1 {
  font-size: 1.1rem;
  margin: 0;
}

button {
  font: inherit;
  color: inherit;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

.collapse {
  padding: 2px 8px;
}

.channel-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
}

.channel {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
}

.channel.selected .channel-main {
  background: #2d3b4f;
  outline: 1px solid var(--accent);
}

.channel.dragging {
  opacity: 0.7;
}

.channel-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  padding: 6px;
  text-align: left;
}

.sidebar.collapsed .channel-main {
  justify-content: center;
  padding: 6px 0;
}

.monogram {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.8rem;
  color: #fff;
  flex-shrink: 0;
}

.channel-name {
  flex: 1;
}

.badge {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: #4a3b00;
  color: #ffd866;
}

.badge-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  margin-left: -10px;
  align-self: flex-start;
}

.pin {
  background: transparent;
  border: none;
  color: #666;
  padding: 4px 6px;
}

.pin.pinned {
  color: #ffd866;
}

.player-error {
  margin: 8px;
  padding: 10px;
  border: 1px solid #7a2e2e;
  border-radius: 8px;
  background: #2a1515;
  font-size: 0.9rem;
}

.player-error-detail {
  color: #bbb;
  font-size: 0.8rem;
  word-break: break-word;
}

.sidebar-footer {
  padding: 10px;
  border-top: 1px solid #2a2a2a;
  font-size: 0.85rem;
}

.sidebar-footer .status {
  margin: 0 0 8px;
  color: #aaa;
}

.confirm {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.clear-data {
  width: 100%;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #aaa;
}

.strip {
  width: var(--strip);
  height: 100%;
  background: #181818;
  cursor: pointer;
}
```

- [ ] **Step 8: Compilation, lint, commit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm format:check`
Expected: aucune erreur (les composants ne sont pas encore utilisés ; `tsc` les vérifie quand même).

```bash
git add package.json pnpm-lock.yaml src/components src/App.css
git commit -m "Composants de la barre de chaînes"
```

---

### Task 7: Assemblage dans App (préférences, sélection, repli)

**Files:**

- Modify: `src/App.tsx` (remplacer entièrement)
- Create: `src/hooks/usePrefs.ts`

**Interfaces:**

- Consumes: tout ce qui précède.
- Produces: `usePrefs(): { prefs: Prefs | null; dispatch(action: PrefsAction): void }` ; `App` rend `Sidebar` et une zone d'accueil.

- [ ] **Step 1: `src/hooks/usePrefs.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { applyPrefsAction, type Prefs, type PrefsAction } from "../prefs";
import { loadPrefs, savePrefs } from "../store";

/** Charge les préférences au montage, applique les actions et sauvegarde après chaque changement. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadPrefs().then((p) => {
      if (!cancelled) {
        loaded.current = true;
        setPrefs(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (prefs && loaded.current) void savePrefs(prefs);
  }, [prefs]);

  const dispatch = useCallback((action: PrefsAction) => {
    setPrefs((p) => (p ? applyPrefsAction(p, action) : p));
  }, []);

  return { prefs, dispatch };
}
```

- [ ] **Step 2: Remplacer `src/App.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { channelById, type ChannelId } from "./channels";
import { Sidebar } from "./components/Sidebar";
import { usePrefs } from "./hooks/usePrefs";
import type { LayoutState } from "./layout";
import { usePlayer } from "./player/usePlayer";
import { displayOrder } from "./prefs";

function App() {
  const { prefs, dispatch } = usePrefs();
  const [fullscreen] = useState(false); // remplacé par useFullscreen en tâche 8
  const [revealed] = useState(false);
  const layout: LayoutState = { collapsed: prefs?.sidebarCollapsed ?? false, fullscreen, revealed };
  const player = usePlayer(layout);
  const openedLast = useRef(false);

  // Rouvrir la dernière chaîne une seule fois, quand les préférences sont chargées.
  useEffect(() => {
    if (prefs && !openedLast.current) {
      openedLast.current = true;
      if (prefs.lastChannelId) player.open(prefs.lastChannelId);
    }
  }, [prefs, player]);

  if (!prefs) return <div className="app" />;

  const shown = displayOrder(prefs).map(channelById);

  function select(id: ChannelId) {
    dispatch({ type: "selectChannel", id });
    player.open(id);
  }

  return (
    <div className="app">
      <Sidebar
        channels={shown}
        selectedId={player.state.channelId}
        pinned={prefs.pinned}
        collapsed={prefs.sidebarCollapsed}
        player={player.state}
        onSelect={select}
        onTogglePin={(id) => dispatch({ type: "togglePin", id })}
        onReorder={(from, to) => dispatch({ type: "reorder", from, to })}
        onToggleCollapsed={() =>
          dispatch({ type: "setCollapsed", collapsed: !prefs.sidebarCollapsed })
        }
        onToggleFullscreen={() => undefined}
        onRetry={player.retry}
        onClearData={player.clearData}
      />
      {player.state.status === "idle" && (
        <main className="welcome">
          <h2>Choisissez une chaîne</h2>
          <p>La page de direct du diffuseur s'ouvrira ici.</p>
        </main>
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Vérification manuelle**

Run (arrière-plan) : `.\scripts\dev-debug.ps1`
Attendu, dans la fenêtre : barre à gauche avec 4 chaînes, zone d'accueil à droite. Clic sur TVA → la page TVA+ apparaît à droite, le bouton « Effacer les données » devient actif. Clic sur Télé-Québec → la webview est remplacée. Bouton `‹` → rail de 64 px, la webview s'élargit. Fermer l'app, relancer → Télé-Québec se rouvre, barre dans l'état laissé. Épingler Noovo → il passe en tête ; glisser une chaîne → l'ordre persiste après relance.

Preuve CDP : `curl -s http://127.0.0.1:9222/json` montre une page `localhost:1420` et une page du diffuseur.

- [ ] **Step 4: Lint, format, commit**

```bash
pnpm lint && pnpm format:check && pnpm test
git add src/App.tsx src/hooks/usePrefs.ts
git commit -m "Assemblage de l'interface : sélection, repli, préférences"
```

---

### Task 8: Plein écran et raccourcis clavier

**Files:**

- Create: `src/hooks/useFullscreen.ts`
- Create: `src/keyboard.ts`
- Create: `src/hooks/useKeyboard.ts`
- Modify: `src/App.tsx`
- Test: `src/keyboard.test.ts`

**Interfaces:**

- Produces:
  - `keyboard.ts` : `type KeyAction = { type: "toggleFullscreen" } | { type: "exitFullscreen" } | { type: "step"; delta: 1 | -1 } | { type: "digit"; index: number } | { type: "toggleCollapsed" }`, `interface KeyInput { key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; targetTag: string }`, `keyToAction(input: KeyInput): KeyAction | null`, `nextChannel(shown: ChannelId[], current: ChannelId | null, delta: 1 | -1): ChannelId | null`, `channelForDigit(shown: ChannelId[], index: number): ChannelId | null`.
  - `useFullscreen()` : `{ fullscreen: boolean; revealed: boolean; toggle(): void; exit(): void; reveal(): void; hideSoon(): void }`.
  - `useKeyboard(handlers)` : branche `keydown` sur `window`.

- [ ] **Step 1: Tests du mappage clavier (échouent)**

`src/keyboard.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import type { ChannelId } from "./channels";
import { channelForDigit, keyToAction, nextChannel } from "./keyboard";

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
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm test`
Expected: FAIL, `Cannot find module './keyboard'`.

- [ ] **Step 3: Écrire `src/keyboard.ts`**

```ts
import type { ChannelId } from "./channels";

export type KeyAction =
  | { type: "toggleFullscreen" }
  | { type: "exitFullscreen" }
  | { type: "step"; delta: 1 | -1 }
  | { type: "digit"; index: number }
  | { type: "toggleCollapsed" };

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  targetTag: string;
}

const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function keyToAction(i: KeyInput): KeyAction | null {
  if (i.altKey || i.metaKey) return null;
  if (i.key === "Escape") return { type: "exitFullscreen" };
  if (TEXT_TAGS.has(i.targetTag.toUpperCase())) return null;
  if (i.ctrlKey) return i.key.toLowerCase() === "b" ? { type: "toggleCollapsed" } : null;
  if (i.key.toLowerCase() === "f") return { type: "toggleFullscreen" };
  if (i.key === "ArrowUp") return { type: "step", delta: -1 };
  if (i.key === "ArrowDown") return { type: "step", delta: 1 };
  if (/^[1-9]$/.test(i.key)) return { type: "digit", index: Number(i.key) - 1 };
  return null;
}

export function nextChannel(
  shown: ChannelId[],
  current: ChannelId | null,
  delta: 1 | -1,
): ChannelId | null {
  if (shown.length === 0) return null;
  const i = current ? shown.indexOf(current) : -1;
  if (i === -1) return shown[0];
  return shown[(i + delta + shown.length) % shown.length];
}

export function channelForDigit(shown: ChannelId[], index: number): ChannelId | null {
  return shown[index] ?? null;
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: `src/hooks/useFullscreen.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { REVEAL_HIDE_DELAY_MS } from "../layout";

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const apply = useCallback(async (on: boolean) => {
    try {
      await getCurrentWindow().setFullscreen(on);
      setFullscreen(on);
      setRevealed(false);
    } catch (e) {
      console.warn("Plein écran refusé :", e);
    }
  }, []);

  const toggle = useCallback(() => void apply(!fullscreen), [apply, fullscreen]);
  const exit = useCallback(() => {
    if (fullscreen) void apply(false);
  }, [apply, fullscreen]);

  const reveal = useCallback(() => {
    clearTimer();
    setRevealed(true);
  }, []);

  const hideSoon = useCallback(() => {
    clearTimer();
    timer.current = window.setTimeout(() => setRevealed(false), REVEAL_HIDE_DELAY_MS);
  }, []);

  useEffect(() => clearTimer, []);

  return { fullscreen, revealed, toggle, exit, reveal, hideSoon };
}
```

- [ ] **Step 6: `src/hooks/useKeyboard.ts`**

```ts
import { useEffect } from "react";
import { keyToAction, type KeyAction } from "../keyboard";

export function useKeyboard(onAction: (action: KeyAction) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const action = keyToAction({
        key: e.key,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        targetTag: target?.tagName ?? "BODY",
      });
      if (!action) return;
      e.preventDefault();
      onAction(action);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAction]);
}
```

- [ ] **Step 7: Brancher dans `src/App.tsx`**

Remplacer les deux `useState` de plein écran, ajouter les hooks et la bande de révélation. Fichier complet :

```tsx
import { useCallback, useEffect, useRef } from "react";
import "./App.css";
import { channelById, type ChannelId } from "./channels";
import { Sidebar } from "./components/Sidebar";
import { useFullscreen } from "./hooks/useFullscreen";
import { useKeyboard } from "./hooks/useKeyboard";
import { usePrefs } from "./hooks/usePrefs";
import { channelForDigit, nextChannel, type KeyAction } from "./keyboard";
import type { LayoutState } from "./layout";
import { usePlayer } from "./player/usePlayer";
import { displayOrder } from "./prefs";

function App() {
  const { prefs, dispatch } = usePrefs();
  const fs = useFullscreen();
  const layout: LayoutState = {
    collapsed: prefs?.sidebarCollapsed ?? false,
    fullscreen: fs.fullscreen,
    revealed: fs.revealed,
  };
  const player = usePlayer(layout);
  const openedLast = useRef(false);

  useEffect(() => {
    if (prefs && !openedLast.current) {
      openedLast.current = true;
      if (prefs.lastChannelId) player.open(prefs.lastChannelId);
    }
  }, [prefs, player]);

  const shownIds = prefs ? displayOrder(prefs) : [];

  const select = useCallback(
    (id: ChannelId) => {
      dispatch({ type: "selectChannel", id });
      player.open(id);
    },
    [dispatch, player],
  );

  const onKey = useCallback(
    (a: KeyAction) => {
      switch (a.type) {
        case "toggleFullscreen":
          return fs.toggle();
        case "exitFullscreen":
          return fs.exit();
        case "toggleCollapsed":
          return dispatch({ type: "setCollapsed", collapsed: !(prefs?.sidebarCollapsed ?? false) });
        case "step": {
          const id = nextChannel(shownIds, player.state.channelId, a.delta);
          if (id) select(id);
          return;
        }
        case "digit": {
          const id = channelForDigit(shownIds, a.index);
          if (id) select(id);
          return;
        }
      }
    },
    [dispatch, fs, player.state.channelId, prefs?.sidebarCollapsed, select, shownIds],
  );
  useKeyboard(onKey);

  if (!prefs) return <div className="app" />;

  const showStripOnly = fs.fullscreen && !fs.revealed;

  return (
    <div className="app">
      {showStripOnly ? (
        <div
          className="strip"
          onMouseEnter={fs.reveal}
          title="Afficher les chaînes (Échap : quitter le plein écran)"
        />
      ) : (
        <div
          onMouseLeave={fs.fullscreen ? fs.hideSoon : undefined}
          onMouseEnter={fs.fullscreen ? fs.reveal : undefined}
        >
          <Sidebar
            channels={shownIds.map(channelById)}
            selectedId={player.state.channelId}
            pinned={prefs.pinned}
            collapsed={prefs.sidebarCollapsed && !fs.fullscreen}
            player={player.state}
            onSelect={select}
            onTogglePin={(id) => dispatch({ type: "togglePin", id })}
            onReorder={(from, to) => dispatch({ type: "reorder", from, to })}
            onToggleCollapsed={() =>
              dispatch({ type: "setCollapsed", collapsed: !prefs.sidebarCollapsed })
            }
            onToggleFullscreen={fs.toggle}
            onRetry={player.retry}
            onClearData={player.clearData}
          />
        </div>
      )}
      {player.state.status === "idle" && !fs.fullscreen && (
        <main className="welcome">
          <h2>Choisissez une chaîne</h2>
          <p>La page de direct du diffuseur s'ouvrira ici.</p>
        </main>
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 8: Vérification manuelle**

Run (arrière-plan) : `.\scripts\dev-debug.ps1`
Attendu : `F` (barre focalisée) → fenêtre plein écran, seule une bande de 6 px reste à gauche, la webview couvre le reste. Souris sur la bande → la barre complète apparaît ; souris hors de la barre → elle se replie après 1,5 s. `Échap` → retour à la fenêtre normale avec l'état de barre d'avant. `↓` passe à la chaîne suivante, `2` ouvre la deuxième, `Ctrl+B` replie. Après un clic dans le lecteur, les touches n'agissent plus jusqu'à un clic sur la barre (comportement attendu, documenté dans l'infobulle de l'en-tête).

- [ ] **Step 9: Lint, format, tests, commit**

```bash
pnpm lint && pnpm format:check && pnpm test
git add src/keyboard.ts src/keyboard.test.ts src/hooks src/App.tsx
git commit -m "Plein écran avec bande de révélation et raccourcis clavier"
```

---

### Task 9: Vérification de bout en bout et documentation

**Files:**

- Modify: `CLAUDE.md` (section « Structure » et « État du projet »)
- Modify: `docs/superpowers/specs/2026-10-21-zappeqc-interface-design.md` (section « Validations » à ajouter)

- [ ] **Step 1: Scénario complet avec preuves CDP**

Run (arrière-plan) : `.\scripts\dev-debug.ps1`, puis depuis Bash :

```bash
curl -s http://127.0.0.1:9222/json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s))if(p.type==="page")console.log(p.title,"|",p.url)})'
```

Scénario, en notant le résultat de chaque étape :

1. Supprimer `%APPDATA%\qc.zappe.app\zappeqc.json` s'il existe, lancer → zone d'accueil, aucune page diffuseur dans la liste CDP.
2. Clic TVA → une page `tvaplus.ca` apparaît dans la liste CDP ; lecture possible via le bouton du lecteur.
3. Clic Télé-Québec → la page `tvaplus.ca` disparaît, `telequebec.tv` apparaît (une seule webview enfant).
4. Épingler Noovo, glisser Télé-Québec en dernier, replier la barre.
5. `F`, bande, `Échap`.
6. Fermer l'app, relancer → Télé-Québec rouverte, Noovo en tête, barre repliée.
7. « Effacer les données de navigation » → confirmation → la page se recharge ; sur ICI Télé, l'état « Me connecter » réapparaît.
8. Redimensionner la fenêtre au minimum (960×600) → la webview suit, pas de bande noire.

- [ ] **Step 2: Consigner dans la spec d'interface**

Ajouter à la fin de `docs/superpowers/specs/2026-10-21-zappeqc-interface-design.md` :

```markdown
## Validations

| Date       | Étape du scénario | Résultat                           |
| ---------- | ----------------- | ---------------------------------- |
| AAAA-MM-JJ | 1 à 8             | (OK / écart constaté et correctif) |
```

avec une ligne par étape, remplie avec les résultats réels.

- [ ] **Step 3: Mettre à jour `CLAUDE.md`**

Dans « Structure », remplacer la ligne `src/` par :

```
src/                    interface React : channels.ts (table), prefs.ts (réducteur), layout.ts (rectangle),
                        keyboard.ts (raccourcis), store.ts (plugin store), player/ (webview enfant),
                        hooks/ (usePrefs, useFullscreen, useKeyboard), components/ (Sidebar…)
```

Dans « État du projet », ajouter : « Interface v1 livrée (spec `2026-10-21-zappeqc-interface-design.md`). »

- [ ] **Step 4: Commit final**

```bash
pnpm lint && pnpm format:check && pnpm test
git add CLAUDE.md docs
git commit -m "Interface v1 : validation de bout en bout et documentation"
```
