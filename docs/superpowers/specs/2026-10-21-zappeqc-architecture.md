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

Spike DRM du 2026-10-21 (code jeté, non commité) : webview enfant Tauri (`unstable`) créée
depuis React vers `https://www.tvaplus.ca/`, inspectée par CDP sur le port 9222.

| Test                                                      | Résultat                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Création d'une webview enfant à côté de l'interface React | OK, `tauri://created` reçu, redimensionnement sur `onResized` OK                                                                       |
| `requestMediaKeySystemAccess` dans la webview enfant      | `com.widevine.alpha` OK, `com.microsoft.playready` OK, `com.microsoft.playready.recommendation` OK                                     |
| Page de direct TVA (`/tva/en-direct`)                     | Lecteur video.js, bouton « Lire la vidéo », **aucune connexion exigée** (bandeau « prochainement »)                                    |
| Lecture de TVA Nouvelles en direct                        | OK : `readyState 4`, `paused false`, 512×288 après 64 s, aucune erreur, pas de session EME (flux non chiffré pour un visiteur anonyme) |
| UA de la webview                                          | `Chrome/155 … Edg/155` (WebView2), accepté par TVA+                                                                                    |

Conclusions :

- L'architecture « interface React + webview enfant » est validée sur Windows ; pas besoin du
  repli `WebviewWindow`.
- URL de direct TVA+ relevées dans le site : `/tva/en-direct`, `/tva-sports/en-direct`,
  `/tva-sports-2/en-direct` (les deux dernières exigent un abonnement).
- La résolution 512×288 est celle choisie par le lecteur adaptatif pour une zone de 1000 px ;
  à revérifier en plein écran lors du développement de l'interface.

### Relevé des directs (2026-10-21, même méthode : webview enfant WebView2 + CDP)

| Chaîne              | URL de direct                                                     | Compte                                                      | Lecture testée                                                 |
| ------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| TVA                 | `https://www.tvaplus.ca/tva/en-direct`                            | Aucun (TVA+ annonce que la connexion viendra)               | OK, 512×288 dans 1000 px, sans DRM                             |
| Télé-Québec         | `https://telequebec.tv/regarder/en-direct/telequebec`             | Aucun                                                       | OK, **1280×720 avec session DRM active** (`mediaKeys` vrai)    |
| ICI Télé (Montréal) | `https://ici.tou.tv/chaine/ici-tele-montreal`                     | Compte Radio-Canada gratuit (« Me connecter »)              | Non testée (connexion requise)                                 |
| ICI Télé (régions)  | `https://ici.tou.tv/chaine/ici-tele-<region>` (quebec, estrie, …) | Idem                                                        | Non testée                                                     |
| Noovo               | `https://www.crave.ca/fr/live?channel=noovo&group=allchannels`    | Compte Bell Média gratuit (noovo.ca fermé le 30 avril 2026) | Non testée ; identifiant `noovo` à confirmer une fois connecté |
| ICI RDI             | `https://ici.tou.tv/chaine/ici-rdi`                               | Abonnement ICI TOU.TV Extra                                 | Hors périmètre « gratuit »                                     |
| TVA Sports, LCN     | `/tva-sports/en-direct`, etc. sur TVA+                            | Abonnement                                                  | Hors périmètre « gratuit »                                     |

Notes :

- `telequebec.tv/en-direct` redirige vers `/en-direct/telequebec`, mais c'est `/regarder/en-direct/telequebec` qui porte le lecteur.
- `ici.radio-canada.ca/tele/en-direct` n'affiche rien d'utile ; la page officielle du direct est sur TOU.TV, section `/section/en-direct`.
- Télé-Québec et Radio-Canada affichent une bannière de témoins (cookies) au premier chargement ; l'utilisateur la ferme une fois, le choix est mémorisé dans le profil WebView2.
- Les connexions (Bell Média, Radio-Canada) se font dans la webview ; ZappeQc n'intervient pas.

## Hors périmètre de la première étape

Interface finale, guide horaire, favoris, raccourcis clavier, installateur MSI, icône.
