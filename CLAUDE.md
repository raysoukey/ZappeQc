# ZappeQc

Application de bureau **Windows** pour regarder gratuitement les chaînes québécoises en direct
(TVA, Noovo, Télé-Québec, ICI Télé, …). Elle intègre les **lecteurs web officiels** des diffuseurs
dans une webview : la liste des chaînes à gauche, le lecteur du diffuseur à droite.

**Règle d'or :** on charge les pages officielles des diffuseurs, point. Jamais d'extraction de flux
HLS/DASH, jamais de contournement de DRM, de pubs ou de connexion. Si une chaîne ne lit pas,
c'est le diffuseur qu'on respecte, pas un obstacle à contourner.

## Pile

- Tauri v2 (Rust, coquille native) + WebView2 (Edge Chromium, Widevine inclus) — Windows seulement.
- React 19 + Vite + TypeScript, gestion de paquets **pnpm**.
- `tauri-plugin-store` pour la persistance locale (favoris, dernière chaîne). Pas de backend.
- Feature Cargo `unstable` activée : nécessaire pour créer des **webviews enfants** dans la fenêtre.

## Commandes

| Quoi                                    | Commande                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Lancer l'app en dev                     | `pnpm tauri dev` — **toujours en arrière-plan** (ouvre une fenêtre GUI)                                           |
| Lancer avec port de débogage WebView2   | `.\scripts\dev-debug.ps1` (arrière-plan), puis serveur MCP `zappeqc-devtools` (`.mcp.json`, attaché au port 9222) |
| Compiler le Rust sans ouvrir de fenêtre | `cargo build --manifest-path src-tauri/Cargo.toml`                                                                |
| Lint / format                           | `pnpm lint`, `pnpm format`, `pnpm format:check`                                                                   |
| Tests (logique uniquement)              | `pnpm test` (Vitest)                                                                                              |
| Format Rust                             | `cargo fmt --manifest-path src-tauri/Cargo.toml`                                                                  |
| Build release                           | `pnpm tauri build`                                                                                                |

Un hook PostToolUse reformate automatiquement chaque fichier modifié (prettier / rustfmt) :
inutile de lancer le format à la main après une édition.

## Structure

```
src/                    interface React (composants, hooks, src/channels.ts = table des chaînes)
src-tauri/              coquille Rust : lib.rs, tauri.conf.json, capabilities/default.json
scripts/                scripts PowerShell utilitaires (dev-debug.ps1)
docs/superpowers/specs/ specs de conception (une par fonctionnalité)
docs/superpowers/plans/ plans d'implémentation
.claude/                settings projet, hooks, skills locaux (tauri-v2)
```

## Conventions

- Composants fonctionnels uniquement ; un fichier = une responsabilité ; fichiers courts.
- Libellés d'interface en **français québécois** (« Chaînes », « Favoris », « En direct »).
- Tests Vitest pour la logique (table des chaînes, persistance, positionnement de la webview),
  pas pour le rendu.
- TypeScript strict ; pas de `any`.
- Rust minimal : la logique vit côté TypeScript, Rust ne fait que la coquille et les plugins.

## Pièges connus

- **Webview enfant** : `new Webview(window, label, { url, x, y, width, height })` depuis
  `@tauri-apps/api/webview`. Sans la feature `unstable` dans `Cargo.toml`, l'appel échoue avec
  « unstable feature not supported ». Les permissions `core:webview:*` correspondantes sont dans
  `capabilities/default.json`.
- La webview enfant ne suit **pas** la mise en page CSS : il faut la repositionner (`setPosition`,
  `setSize`) à chaque `resize` de la fenêtre, en pixels logiques.
- Les sites des diffuseurs sont **géobloqués au Canada** : un refus de lecture hors Canada n'est
  pas un bogue de l'app.
- Chaque diffuseur a sa propre page de direct et elles changent : `noovo.ca/direct` redirige
  maintenant vers `crave.ca/fr/noovo`. Les URL de `src/channels.ts` se valident dans Edge, pas
  par devinette.
- Repli si le multi-webview pose problème : une `WebviewWindow` séparée par chaîne (API stable).
- Avant de coder une fonctionnalité Tauri, consulter le skill local `tauri-v2` (`.claude/skills/tauri-v2`).

## État du projet

Voir `docs/superpowers/specs/2026-10-21-zappeqc-architecture.md` pour les décisions et la
section « Validations » (résultat du spike DRM).
