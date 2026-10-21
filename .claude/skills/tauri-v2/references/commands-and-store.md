# Commandes Rust et plugin store (Tauri v2)

Source : v2.tauri.app/develop/calling-rust/ et /plugin/store/ (2026-10-21).

## Commandes

```rust
// src-tauri/src/lib.rs — PAS `pub` ici ; `pub` si dans un module (ex. commands.rs)
#[tauri::command]
fn ma_commande(invoke_message: String) -> Result<String, String> {
    if invoke_message.is_empty() {
        return Err("vide".into());
    }
    Ok(format!("reçu : {invoke_message}"))
}

#[tauri::command]
async fn longue(
    valeur: String,
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, MonEtat>,
) -> Result<String, String> {
    Ok(valeur) // async : pas de `&str` en paramètre
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(MonEtat::default())
        .invoke_handler(tauri::generate_handler![ma_commande, longue]) // UN seul appel
        .run(tauri::generate_context!())
        .expect("erreur au démarrage");
}
```

```ts
import { invoke } from "@tauri-apps/api/core";
const r = await invoke<string>("ma_commande", { invokeMessage: "allo" }); // snake ↔ camel
try {
  await invoke("longue", { valeur: "x" });
} catch (e) {
  /* e = la String d'Err */
}
```

- Les erreurs doivent être sérialisables : `Result<T, String>` ou un type qui implémente
  `serde::Serialize`.
- Flux volumineux : `tauri::ipc::Channel<T>` côté Rust, `new Channel<T>()` côté TS.
- Toute commande custom est automatiquement permise pour les fenêtres de l'app (pas de
  permission à déclarer) sauf si on ajoute un plugin avec son propre ACL.

## Plugin store

Installation (déjà fait dans ZappeQc) :

- `Cargo.toml` : `tauri-plugin-store = "2"` ; `package.json` : `@tauri-apps/plugin-store`.
- `lib.rs` : `.plugin(tauri_plugin_store::Builder::default().build())`.
- Capability : `"store:default"`.

```ts
import { load, LazyStore } from "@tauri-apps/plugin-store";

const store = await load("zappeqc.json", { autoSave: true }); // autoSave: délai 100 ms par défaut
await store.set("favoris", ["tva", "ici"]);
const favoris = await store.get<string[]>("favoris");
await store.save(); // explicite si autoSave: false

const lazy = new LazyStore("zappeqc.json"); // charge au premier accès
```

- Fichier dans le dossier de données de l'app (`%APPDATA%\qc.zappe.app\` sur Windows).
- Valeurs sérialisables JSON uniquement.
- Toutes les méthodes sont asynchrones ; `load()` avec le même nom renvoie la même instance.
