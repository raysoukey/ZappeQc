# Permissions Tauri v2 utiles à ZappeQc

Extrait de `src-tauri/gen/schemas/desktop-schema.json` (tauri 2.12, store 2.5, 2026-10-21).
Chaque `allow-x` a un `deny-x` symétrique (omis ici).

## Ensembles par défaut

- `core:default` = `core:path:default`, `core:event:default`, `core:window:default`,
  `core:webview:default`, `core:app:default`, `core:image:default`, `core:resources:default`,
  `core:menu:default`, `core:tray:default`.
- `core:window:default` = lectures seulement : `get-all-windows`, `scale-factor`,
  `inner-position`, `outer-position`, `inner-size`, `outer-size`, `is-fullscreen`,
  `is-minimized`, `is-maximized`, `is-focused`, `is-decorated`, `is-resizable`,
  `is-maximizable`, `is-minimizable`, `is-closable`, `is-visible`, `is-enabled`, `title`,
  `current-monitor`, `primary-monitor`, `monitor-from-point`, `available-monitors`,
  `cursor-position`, `theme`, `is-always-on-top`, `activity-name`, `scene-identifier`,
  `internal-toggle-maximize`.
- `core:webview:default` = `get-all-webviews`, `webview-position`, `webview-size`,
  `internal-toggle-devtools`. **Rien pour créer, déplacer, redimensionner ou fermer.**
- `store:default` = toutes les opérations (`load`, `get-store`, `set`, `get`, `has`, `delete`,
  `clear`, `reset`, `keys`, `values`, `entries`, `length`, `reload`, `save`).

## core:webview:allow-\*

`clear-all-browsing-data`, `create-webview`, `create-webview-window`, `get-all-webviews`,
`internal-toggle-devtools`, `print`, `reparent`, `set-webview-auto-resize`,
`set-webview-background-color`, `set-webview-focus`, `set-webview-position`,
`set-webview-size`, `set-webview-zoom`, `webview-close`, `webview-hide`, `webview-position`,
`webview-show`, `webview-size`.

## core:window:allow-\* (modifications, hors défaut)

`center`, `close`, `create`, `destroy`, `hide`, `show`, `maximize`, `unmaximize`, `minimize`,
`unminimize`, `toggle-maximize`, `set-always-on-top`, `set-always-on-bottom`,
`set-background-color`, `set-closable`, `set-content-protected`, `set-decorations`,
`set-effects`, `set-enabled`, `set-focus`, `set-focusable`, `set-fullscreen`,
`set-fullscreen-on-monitor`, `set-icon`, `set-ignore-cursor-events`, `set-max-size`,
`set-min-size`, `set-maximizable`, `set-minimizable`, `set-position`, `set-progress-bar`,
`set-resizable`, `set-shadow`, `set-simple-fullscreen`, `set-size`, `set-size-constraints`,
`set-skip-taskbar`, `set-theme`, `set-title`, `set-title-bar-style`,
`set-visible-on-all-workspaces`, `start-dragging`, `start-resize-dragging`,
`request-user-attention`, `set-cursor-*`, `set-badge-*`, `set-overlay-icon`.

## Format d'un fichier capability

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "…",
  "windows": ["main"],
  "permissions": ["core:default", "core:webview:allow-create-webview", "store:default"]
}
```

Champs optionnels : `platforms: ["windows"]`, `remote: { "urls": ["https://*.example.com"] }`
(donne l'IPC à du contenu distant — à ne pas faire pour les sites des diffuseurs), `webviews`
(labels de webviews, en plus de `windows`).
