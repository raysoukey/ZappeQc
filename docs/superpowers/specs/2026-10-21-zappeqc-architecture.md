# ZappeQc — Architecture et décisions fondatrices

Date : 2026-10-21

## But

Application de bureau Windows pour regarder gratuitement les chaînes québécoises en direct
(TVA, Noovo, Télé-Québec, ICI Télé, et d'autres plus tard) en intégrant les lecteurs web
officiels des diffuseurs.

## Décisions

| Sujet             | Décision                                             | Raison                                                                                                           |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Accès aux chaînes | Intégrer les lecteurs web officiels dans une webview | Légal, DRM géré par le navigateur, rien à scraper ni maintenir                                                   |
| Plateforme        | Windows seulement                                    | WebView2 (Edge) inclut Widevine ; Linux/macOS n'ont pas d'équivalent simple                                      |
| Coquille native   | Tauri v2                                             | WebView2 sous le capot, exécutable léger. Electron stock n'a pas Widevine (fork castLabs + signature VMP requis) |
| Interface         | React 19 + Vite + TypeScript                         | Gabarit par défaut de create-tauri-app, le mieux documenté                                                       |
| Persistance       | tauri-plugin-store                                   | Favoris et dernière chaîne ; pas de backend                                                                      |
| Dépôt             | Git local seulement                                  | Remote plus tard                                                                                                 |

## Architecture cible

- Une fenêtre Tauri (`main`). La webview principale affiche l'interface React : liste de chaînes,
  favoris, barre d'outils.
- Une **webview enfant** (`new Webview(window, label, { url, x, y, width, height })`) occupe la
  zone droite et charge la page « en direct » du diffuseur sélectionné. Nécessite la feature Cargo
  `unstable`.
- Repli stable si le multi-webview pose problème : une `WebviewWindow` séparée par chaîne, la
  fenêtre principale servant de télécommande.
- Les connexions aux comptes gratuits des diffuseurs se font dans la webview, comme dans un
  navigateur ; les cookies WebView2 persistent dans le dossier de données de l'app.

## Risques identifiés

1. **Widevine dans une webview enfant Tauri** : WebView2 le supporte, mais il faut confirmer
   qu'un lecteur TVA+ ou ICI Télé lit réellement dans l'app.
2. **URL des directs** : `noovo.ca/direct` redirige vers `crave.ca/fr/noovo` ;
   `ici.radio-canada.ca/tele/direct` renvoie 404 ; `telequebec.tv/en-direct` est une page de
   vidéo sur demande. Les vraies URL doivent être relevées dans un navigateur.
3. **Géoblocage Canada** : attendu, à ne pas « déboguer ».

## Validations

_(À remplir après le spike DRM.)_

| Date | Test                                 | Résultat |
| ---- | ------------------------------------ | -------- |
|      | Lecture TVA+ dans une webview enfant |          |

## Hors périmètre de la première étape

Interface finale, guide horaire, favoris, raccourcis clavier, installateur MSI, icône.
