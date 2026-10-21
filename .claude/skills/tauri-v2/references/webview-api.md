# API Webview et Window (@tauri-apps/api v2)

Source : v2.tauri.app/reference/javascript/api/namespacewebview/ et namespacewindow/ (2026-10-21).

## Webview

Constructeur : `new Webview(window: Window, label: string, options: WebviewOptions)`.
Label : alphanumérique, `-`, `/`, `:`, `_`. Requiert la feature Cargo `unstable`.

### WebviewOptions

| Option                      | Type                       | Défaut | Note                                       |
| --------------------------- | -------------------------- | ------ | ------------------------------------------ |
| `url`                       | string                     | —      | URL distante, `data:`, ou chemin local     |
| `x`, `y`, `width`, `height` | number                     | —      | **requis**, pixels logiques                |
| `transparent`               | boolean                    | —      |                                            |
| `focus`                     | boolean                    | —      |                                            |
| `dragDropEnabled`           | boolean                    | true   |                                            |
| `userAgent`                 | string                     | —      | utile si un diffuseur bloque un UA inconnu |
| `incognito`                 | boolean                    | —      |                                            |
| `proxyUrl`                  | string                     | —      |                                            |
| `zoomHotkeysEnabled`        | boolean                    | —      |                                            |
| `useHttpsScheme`            | boolean                    | false  |                                            |
| `devtools`                  | boolean                    | true   |                                            |
| `backgroundColor`           | Color                      | —      |                                            |
| `backgroundThrottling`      | BackgroundThrottlingPolicy | —      |                                            |
| `javascriptDisabled`        | boolean                    | —      |                                            |
| `dataDirectory`             | string                     | —      | dossier profil WebView2                    |
| `dataStoreIdentifier`       | number[]                   | —      |                                            |
| `generalAutofillEnabled`    | boolean                    | true   |                                            |

### Méthodes

```ts
setPosition(p: PhysicalPosition | LogicalPosition): Promise<void>
setSize(s: PhysicalSize | LogicalSize): Promise<void>
position(): Promise<PhysicalPosition>
size(): Promise<PhysicalSize>
show() / hide() / setFocus() / close(): Promise<void>
reparent(window: string | Window | WebviewWindow): Promise<void>
setAutoResize(auto: boolean): Promise<void>
setZoom(factor: number): Promise<void>
setBackgroundColor(c: Color | null): Promise<void>
clearAllBrowsingData(): Promise<void>
listen<T>(event, handler): Promise<UnlistenFn>
once<T>(event, handler): Promise<UnlistenFn>
emit<T>(event, payload?): Promise<void>
emitTo<T>(target, event, payload?): Promise<void>
onDragDropEvent(handler): Promise<UnlistenFn>
```

Statiques : `Webview.getByLabel(label): Promise<Webview | null>`, `Webview.getAll()`,
`Webview.getCurrent()`. Fonctions : `getCurrentWebview()`, `getAllWebviews()`.

Événements intégrés : `tauri://created`, `tauri://error`.

### Exemple complet : webview enfant qui suit la zone droite

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Webview } from "@tauri-apps/api/webview";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

const SIDEBAR = 280;

async function logicalInner() {
  const win = getCurrentWindow();
  const [size, scale] = await Promise.all([win.innerSize(), win.scaleFactor()]);
  return size.toLogical(scale);
}

export async function openPlayer(url: string) {
  const win = getCurrentWindow();
  const existing = await Webview.getByLabel("player");
  if (existing) await existing.close();
  const { width, height } = await logicalInner();
  const wv = new Webview(win, "player", { url, x: SIDEBAR, y: 0, width: width - SIDEBAR, height });
  await wv.once("tauri://error", (e) => console.error("webview", e));
  const unlisten = await win.onResized(async () => {
    const { width, height } = await logicalInner();
    await wv.setPosition(new LogicalPosition(SIDEBAR, 0));
    await wv.setSize(new LogicalSize(width - SIDEBAR, height));
  });
  return { webview: wv, dispose: unlisten };
}
```

## Window

```ts
const win = getCurrentWindow();
await win.innerSize(); // PhysicalSize
await win.outerSize();
await win.scaleFactor(); // number
(await win.innerSize()).toLogical(await win.scaleFactor()); // LogicalSize
await win.isFullscreen();
await win.isFocused();
await win.isVisible();
await win.isMaximized();
await win.setTitle("...");
await win.setFullscreen(true);
await win.maximize();
await win.center();
const un = await win.onResized(({ payload }) => {}); // payload: PhysicalSize
const un2 = await win.onFocusChanged(({ payload }) => {}); // payload: boolean
```

Les méthodes de modification exigent une permission `core:window:allow-set-*` ; les lectures
(`inner-size`, `scale-factor`, `is-*`) sont dans `core:window:default`.

## WebviewWindow (fenêtre + webview, API stable)

```ts
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
const w = new WebviewWindow("label", {
  url: "https://...",
  title: "...",
  width: 1280,
  height: 720,
});
w.once("tauri://created", () => {});
w.once("tauri://error", (e) => {});
WebviewWindow.getByLabel("label");
WebviewWindow.getAll();
```

Options = WindowOptions ∪ WebviewOptions. Permission : `core:webview:allow-create-webview-window`.
