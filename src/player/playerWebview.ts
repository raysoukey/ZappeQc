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
