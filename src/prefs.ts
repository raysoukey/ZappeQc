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
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_PREFS, order: [...DEFAULT_ORDER] };
  }
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
