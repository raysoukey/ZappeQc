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
  /** Touche maintenue enfoncée (répétition automatique). */
  repeat?: boolean;
  /** Un autre composant (ex. tri clavier de dnd-kit) a déjà consommé l'événement. */
  defaultPrevented?: boolean;
}

const TEXT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function keyToAction(i: KeyInput): KeyAction | null {
  if (i.defaultPrevented || i.altKey || i.metaKey) return null;
  if (i.key === "Escape") return { type: "exitFullscreen" };
  if (TEXT_TAGS.has(i.targetTag.toUpperCase())) return null;
  if (i.ctrlKey) return i.key.toLowerCase() === "b" ? { type: "toggleCollapsed" } : null;
  if (i.key.toLowerCase() === "f") return { type: "toggleFullscreen" };
  if (i.repeat) return null; // une pression = un zap
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
