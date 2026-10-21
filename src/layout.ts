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
