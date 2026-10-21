# ZappeQc — Interface v1 (barre de chaînes + lecteur)

Date : 2026-10-21. S'appuie sur `2026-10-21-zappeqc-architecture.md` (décisions de pile,
spike DRM, relevé des URL de direct).

## But

Première version utilisable : l'utilisateur ouvre ZappeQc, voit la liste des chaînes à gauche,
clique sur une chaîne et la page de direct du diffuseur s'affiche à droite dans une webview
enfant. La dernière chaîne regardée se rouvre au démarrage.

Fonctionnalités incluses dans la v1 :

- Liste compacte repliable (240 px, ou rail de 64 px avec monogrammes seuls).
- Plein écran.
- Raccourcis clavier de zapping.
- Favoris épinglés et ordre personnalisé par glisser-déposer.
- Badge « compte gratuit requis » sur ICI Télé et Noovo, et bouton « Effacer les données de
  navigation ».

Hors périmètre v1 : guide horaire, choix de la région ICI Télé, chaînes payantes, installateur,
icône, mise à jour automatique, détection des pannes ou du géoblocage.

## Architecture

- Une fenêtre `main`. La webview principale rend l'interface React.
- **Une seule** webview enfant, label `player`, créée avec `new Webview(main, "player", {...})`
  (feature Cargo `unstable`, déjà activée). Changer de chaîne = `close()` puis nouvelle
  création avec l'URL de la chaîne. Une seule webview à la fois : pas de son superposé, pas de
  quatre flux en parallèle.
- Aucun code Rust nouveau. Les permissions nécessaires sont déjà dans
  `src-tauri/capabilities/default.json` (`core:webview:allow-*`, `core:window:allow-set-fullscreen`,
  `store:default`).
- Logos : monogrammes texte sur fond coloré (ex. « TVA » sur bleu), jamais les logos officiels
  (marques déposées).

### Rectangle de la webview enfant

Calculé en pixels logiques depuis `(await main.innerSize()).toLogical(await main.scaleFactor())` :

| État                       | x   | y   | largeur | hauteur |
| -------------------------- | --- | --- | ------- | ------- |
| Barre ouverte              | 240 | 0   | W − 240 | H       |
| Barre repliée              | 64  | 0   | W − 64  | H       |
| Plein écran                | 6   | 0   | W − 6   | H       |
| Plein écran, barre révélée | 240 | 0   | W − 240 | H       |

La bande de 6 px en plein écran appartient à la webview principale : la survoler révèle la
barre (la webview enfant se rétrécit à 240 px). Quitter la bande la replie après 1,5 s.

Recalcul à chaque `main.onResized`, changement d'état de la barre ou du plein écran, via
`setPosition(new LogicalPosition(x, y))` et `setSize(new LogicalSize(w, h))`.

## Données

### `src/channels.ts`

```ts
export type ChannelId = "tva" | "telequebec" | "ici-tele" | "noovo";

export interface Channel {
  id: ChannelId;
  name: string; // « TVA », « Télé-Québec », « ICI Télé », « Noovo »
  monogram: string; // « TVA », « TQ », « ICI », « NV »
  color: string; // fond du monogramme
  url: string; // page de direct officielle
  provider: string; // « TVA+ », « Télé-Québec », « ICI TOU.TV », « Crave »
  requiresAccount: boolean;
}

export const CHANNELS: readonly Channel[];
export const DEFAULT_ORDER: readonly ChannelId[]; // ["ici-tele", "tva", "telequebec", "noovo"]
```

URL (relevées le 2026-10-21) :

| id           | url                                                            | requiresAccount |
| ------------ | -------------------------------------------------------------- | --------------- |
| `tva`        | `https://www.tvaplus.ca/tva/en-direct`                         | false           |
| `telequebec` | `https://telequebec.tv/regarder/en-direct/telequebec`          | false           |
| `ici-tele`   | `https://ici.tou.tv/chaine/ici-tele-montreal`                  | true            |
| `noovo`      | `https://www.crave.ca/fr/live?channel=noovo&group=allchannels` | true            |

### Préférences — `zappeqc.json` (plugin store, `autoSave: true`)

```ts
export interface Prefs {
  version: 1;
  lastChannelId: ChannelId | null;
  order: ChannelId[]; // ordre complet, toutes les chaînes présentes une fois
  pinned: ChannelId[]; // favoris, affichés en tête dans l'ordre de `order`
  sidebarCollapsed: boolean;
}
```

`src/prefs.ts` expose un réducteur pur (`applyPrefsAction(prefs, action)`) et des valeurs par
défaut (`DEFAULT_PREFS`). Les actions : `selectChannel`, `togglePin`, `reorder(from, to)`,
`setCollapsed`. Toute lecture du store passe par `normalizePrefs(unknown)` qui complète les
champs manquants et retire les ids inconnus (robuste aux versions futures de `CHANNELS`).

Liste affichée = `pinned` (dans l'ordre de `order`) puis le reste de `order`.

## Composants et modules

```
src/
├── main.tsx, App.tsx          App assemble Sidebar + hooks ; aucune logique métier
├── channels.ts                table statique
├── prefs.ts                   types, défauts, réducteur pur, normalizePrefs
├── layout.ts                  playerRect(windowSize, {collapsed, fullscreen, revealed}) — pur
├── store.ts                   loadPrefs()/savePrefs() sur @tauri-apps/plugin-store
├── player/usePlayer.ts        cycle de vie de la webview enfant (open, resize, close, retry)
├── hooks/useKeyboard.ts       raccourcis clavier
├── hooks/useFullscreen.ts     setFullscreen + bande de révélation
└── components/
    ├── Sidebar.tsx            en-tête, liste, pied
    ├── ChannelList.tsx        dnd-kit sortable, épingler, sélection
    ├── ChannelItem.tsx        monogramme, nom, badge compte, état sélectionné
    ├── AccountBadge.tsx       « Compte gratuit requis » + infobulle
    └── PlayerError.tsx        message + « Réessayer »
```

### Flux principal

1. `App` charge les préférences (`loadPrefs`), normalise, puis `usePlayer.open(lastChannelId)`
   si non nul.
2. Clic sur une chaîne → `dispatch(selectChannel(id))` → `usePlayer.open(id)` : ferme la webview
   `player` existante si présente (`Webview.getByLabel`), crée la nouvelle avec l'URL, écoute
   `tauri://created` et `tauri://error`.
3. `main.onResized`, repli de la barre, plein écran → `usePlayer.relayout()` applique
   `playerRect(...)`.
4. Épingler / réordonner → réducteur → `savePrefs` (débounce du store).

### Raccourcis (actifs quand la webview principale a le focus)

| Touche                        | Action                                        |
| ----------------------------- | --------------------------------------------- |
| `F`, double-clic sur la barre | Basculer plein écran                          |
| `Échap`                       | Quitter le plein écran                        |
| `↑` / `↓`                     | Chaîne précédente / suivante (liste affichée) |
| `1` à `9`                     | N-ième chaîne de la liste affichée            |
| `Ctrl+B`                      | Replier / déplier la barre                    |

Limite connue : quand l'utilisateur clique dans le lecteur du diffuseur, le clavier va à la
webview enfant. Les raccourcis reprennent dès qu'il clique sur la barre ou sur la bande de
gauche en plein écran. Une infobulle sur l'en-tête de la barre l'explique.

### Effacer les données de navigation

Bouton dans le pied de la barre. Confirmation inline (« Vous serez déconnecté des sites des
diffuseurs. Confirmer ? »), puis `player.clearAllBrowsingData()` sur la webview enfant courante
et rechargement de la chaîne. Désactivé s'il n'y a pas de webview ouverte.

## Gestion des erreurs

- `tauri://error` à la création → `PlayerError` dans la zone de la barre avec « Réessayer »
  (ferme et recrée).
- Échec de `close()` d'une webview orpheline → ignoré, on tente la création ; si elle échoue
  parce que le label existe, on réessaie une fois après `getByLabel().close()`.
- Les demandes d'ouverture sont **sérialisées** (une création de webview à la fois, file
  `Serial`) et une demande remplacée avant son tour est sautée (`Sequence`). Un réessai seul ne
  suffit pas : deux créations concurrentes se disputent le label `player`. La répétition clavier
  (`e.repeat`) est ignorée pour le zapping, et un événement déjà consommé par le tri clavier de
  dnd-kit (`defaultPrevented`) n'est pas interprété comme raccourci.
- Store illisible (JSON corrompu) → `DEFAULT_PREFS`, avertissement en console, le fichier est
  réécrit à la prochaine sauvegarde.
- Les erreurs côté diffuseur (connexion requise, panne, géoblocage) restent affichées dans la
  page du diffuseur ; ZappeQc n'intervient pas.

## Tests (Vitest, logique pure seulement)

- `channels.test.ts` : ids uniques, URL `https` valides, `DEFAULT_ORDER` couvre toutes les
  chaînes une fois.
- `prefs.test.ts` : défauts, `togglePin`, `reorder`, `selectChannel`, `normalizePrefs` avec
  champs manquants, ids inconnus, JSON invalide.
- `layout.test.ts` : les quatre états du tableau des rectangles, dont fenêtre plus petite que
  le minimum.
- Vérification manuelle de l'interface : `scripts/dev-debug.ps1` + captures CDP (page
  principale et webview enfant), scénario : démarrage sans préférences → clic TVA → repli →
  plein écran → Échap → relance et retour sur TVA.

## Dépendances ajoutées

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` pour le glisser-déposer.
- Rien côté Rust.

## Validations

Scénario de bout en bout du 2026-10-21, exécuté sur l'app en dev (`scripts/dev-debug.ps1`) et
piloté par CDP sur le port 9222 (clics et touches simulés, tailles lues dans chaque webview).

| Date       | Étape du scénario                 | Résultat                                                                                                                                                                                                   |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-21 | 1. Démarrage sans préférences     | OK : zone d'accueil, aucune page diffuseur dans la liste CDP                                                                                                                                               |
| 2026-10-21 | 2. Clic TVA                       | OK : page `tvaplus.ca/tva/en-direct` créée, bouton « Effacer » actif                                                                                                                                       |
| 2026-10-21 | 3. Clic Télé-Québec               | OK : page TVA disparue, `telequebec.tv` présente (une seule webview enfant), 1040×800 pour une fenêtre 1280×800                                                                                            |
| 2026-10-21 | 4. Épingler Noovo, replier        | OK : Noovo en tête, rail de 64 px, `zappeqc.json` écrit (pinned, sidebarCollapsed). Glisser-déposer non simulé par CDP ; réducteur couvert par `prefs.test.ts`                                             |
| 2026-10-21 | 5. F, bande, Échap                | OK : plein écran 1920×1080, enfant 1914 px ; survol bande → enfant 1680 px ; Échap → 1280×800, enfant 1040 px                                                                                              |
| 2026-10-21 | 5b. ↓, 3, Ctrl+B                  | OK : ↓ boucle de Télé-Québec (dernière) à Noovo (première) ; 3 → TVA ; Ctrl+B → repli                                                                                                                      |
| 2026-10-21 | 6. Relance                        | OK : Télé-Québec rouverte, Noovo épinglé, état de barre conservé                                                                                                                                           |
| 2026-10-21 | 7. Effacer les données (ICI Télé) | OK : confirmation affichée, page rechargée, bouton « Me connecter » de nouveau visible                                                                                                                     |
| 2026-10-21 | 8. Fenêtre au minimum             | Vérifié indirectement : les transitions plein écran (1280→1920→1280) passent par `onResized` et repositionnent la webview sans bande noire. Redimensionnement manuel à 960×600 à refaire par l'utilisateur |
