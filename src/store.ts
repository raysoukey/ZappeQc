import { load, type Store } from "@tauri-apps/plugin-store";
import { DEFAULT_PREFS, normalizePrefs, type Prefs } from "./prefs";

const FILE = "zappeqc.json";
const KEY = "prefs";

let storePromise: Promise<Store> | null = null;

function store(): Promise<Store> {
  storePromise ??= load(FILE, { autoSave: true });
  return storePromise;
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await (await store()).get<unknown>(KEY);
    return normalizePrefs(raw);
  } catch (e) {
    console.warn("Préférences illisibles, retour aux défauts :", e);
    storePromise = null;
    return { ...DEFAULT_PREFS, order: [...DEFAULT_PREFS.order] };
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  try {
    await (await store()).set(KEY, prefs);
  } catch (e) {
    console.warn("Échec de sauvegarde des préférences :", e);
  }
}
