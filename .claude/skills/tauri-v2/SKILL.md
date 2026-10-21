---
name: tauri-v2
description: |
  Référence Tauri v2 (API JS @tauri-apps/api v2, capabilities/permissions, commandes Rust,
  plugin store) adaptée à ZappeQc : webviews enfants (multi-webview, feature `unstable`),
  repositionnement sur resize, WebviewWindow de repli, permissions core:webview/core:window.
  À consulter avant d'écrire ou modifier du code qui touche src-tauri/, tauri.conf.json,
  capabilities/*.json, ou tout import de @tauri-apps/api ou @tauri-apps/plugin-*. Tauri v2 a
  changé la plupart des API de v1 (plus de `tauri.conf.json > allowlist`, plus de
  `@tauri-apps/api/tauri`) : ne jamais se fier à la mémoire v1.
---

# Tauri v2 pour ZappeQc

Chemins d'import v2 (les chemins v1 `@tauri-apps/api/tauri` n'existent plus) :

```ts
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { Webview, getCurrentWebview } from "@tauri-apps/api/webview";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { listen, emit } from "@tauri-apps/api/event";
import { load, LazyStore } from "@tauri-apps/plugin-store";
```

## Webview enfant (cœur de ZappeQc)

Prérequis : `tauri = { version = "2", features = ["unstable"] }` dans `src-tauri/Cargo.toml`.
Sinon : rejet avec « unstable feature not supported ».

```ts
const main = getCurrentWindow(); // label "main" (tauri.conf.json)
const player = new Webview(main, "player", {
  url: "https://www.tvaplus.ca/...",
  x: 280,
  y: 0,
  width: 1000,
  height: 800, // pixels LOGIQUES
});
await player.once("tauri://created", () => {
  /* prête */
});
await player.once("tauri://error", (e) => console.error(e));
```

Règles :

1. Une seule webview par label ; avant d'en recréer une, `Webview.getByLabel("player")` puis
   `close()`.
2. La webview enfant ignore le CSS de l'interface. Sur `main.onResized(...)`, recalculer
   `x/y/width/height` depuis `(await main.innerSize()).toLogical(await main.scaleFactor())`
   et appeler `setPosition(new LogicalPosition(...))` + `setSize(new LogicalSize(...))`.
   Alternative : `setAutoResize(true)` (permission `allow-set-webview-auto-resize`) si la
   webview doit suivre la fenêtre entière.
3. Pour changer de chaîne, le plus simple est `close()` puis `new Webview(...)` avec la
   nouvelle URL ; il n'y a pas de `navigate()` côté JS dans l'API stable.
4. La webview enfant qui charge un site distant n'a **aucun accès IPC** (pas d'`invoke`),
   et c'est voulu. Ne pas ajouter `remote.urls` dans une capability pour un diffuseur.
5. Cookies et connexion persistent dans le dossier de données WebView2 de l'app
   (`%LOCALAPPDATA%\qc.zappe.app\EBWebView`). `clearAllBrowsingData()` pour réinitialiser.

Permissions requises dans `src-tauri/capabilities/default.json` (fenêtre `main`) :
`core:webview:allow-create-webview`, `allow-set-webview-position`, `allow-set-webview-size`,
`allow-webview-close`, `allow-webview-hide`, `allow-webview-show`, `allow-set-webview-focus`,
`allow-set-webview-auto-resize`. `core:default` couvre déjà `inner-size`, `scale-factor`,
`webview-position`, `webview-size`.

Détails de l'API (toutes les options et méthodes) : [references/webview-api.md](references/webview-api.md).

## Repli : WebviewWindow séparée (API stable)

```ts
const w = new WebviewWindow("chaine-tva", {
  url: "https://...",
  title: "TVA",
  width: 1280,
  height: 720,
});
w.once("tauri://created", () => {});
w.once("tauri://error", (e) => console.error(e));
```

Permission : `core:webview:allow-create-webview-window` (hors `core:webview:default`).

## Capabilities et permissions

- Fichiers dans `src-tauri/capabilities/*.json`, tous chargés par défaut. Champs : `identifier`,
  `windows` (labels, `"*"` = toutes), `permissions`, `platforms` (optionnel), `remote.urls`
  (optionnel, à éviter ici).
- `tauri-build` valide les identifiants à la compilation : une faute de frappe = erreur `cargo build`.
- Liste exacte des identifiants `core:webview:*`, `core:window:*`, `store:*` et contenu des
  ensembles `*:default` : [references/permissions.md](references/permissions.md).
- Source de vérité locale : `src-tauri/gen/schemas/desktop-schema.json` (généré au build,
  ignoré par Git). Pour vérifier un identifiant, chercher `"core:webview:` dans ce fichier.

## Commandes Rust et plugin store

Voir [references/commands-and-store.md](references/commands-and-store.md). Points saillants :

- `#[tauri::command] fn x(invoke_message: String)` ↔ `invoke("x", { invokeMessage })` (snake_case
  ↔ camelCase automatique). Dans `lib.rs` les commandes ne sont **pas** `pub` ; dans un module
  séparé elles le sont.
- Commandes `async` : pas de `&str` en paramètre, utiliser `String`.
- Enregistrer **toutes** les commandes dans un seul `generate_handler![a, b, c]`.
- Store : `const store = await load("zappeqc.json", { autoSave: true })` ; fichier dans le dossier
  de données de l'app ; `store:default` dans la capability ; plugin initialisé dans `lib.rs` via
  `tauri_plugin_store::Builder::default().build()`.

## tauri.conf.json (v2)

- `app.windows[]` : `label`, `title`, `width`, `height`, `minWidth`, `minHeight`, `center`,
  `devtools`, `additionalBrowserArgs` (Windows : args WebView2), `dataDirectory`, `incognito`.
- `app.security.csp` : `null` en dev ; définir une CSP avant la release (ne concerne que la
  webview de l'interface, pas les webviews enfants distantes).
- `app.withGlobalTauri: false` : utiliser les imports ES, jamais `window.__TAURI__`.
- `build.devUrl` (Vite, port 1420) et `build.frontendDist` (`../dist`).

## Débogage

- DevTools de la webview d'interface : `Ctrl+Shift+I` en dev ; clic droit → Inspecter.
- Logs Rust : terminal de `pnpm tauri dev` ; `$env:RUST_BACKTRACE=1` pour la trace.
- Protocole CDP pour le plugin chrome-devtools (toutes les webviews, y compris enfants) :
  lancer `.\scripts\dev-debug.ps1` (définit `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`).
- DevTools en build release : `pnpm tauri build --debug` ou feature Cargo `devtools`.

## Pièges fréquents (v1 → v2)

| v1                                  | v2                                                              |
| ----------------------------------- | --------------------------------------------------------------- |
| `tauri.conf.json > tauri.allowlist` | `src-tauri/capabilities/*.json`                                 |
| `@tauri-apps/api/tauri`             | `@tauri-apps/api/core`                                          |
| `appWindow` exporté                 | `getCurrentWindow()`                                            |
| `WebviewWindow` dans `window`       | `@tauri-apps/api/webviewWindow`                                 |
| `tauri::Window` dans une commande   | `tauri::WebviewWindow`                                          |
| `fs`, `dialog`, `shell` intégrés    | plugins séparés `@tauri-apps/plugin-*` + crate `tauri-plugin-*` |
