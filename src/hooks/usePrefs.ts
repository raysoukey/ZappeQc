import { useCallback, useEffect, useRef, useState } from "react";
import { applyPrefsAction, type Prefs, type PrefsAction } from "../prefs";
import { loadPrefs, savePrefs } from "../store";

/** Charge les préférences au montage, applique les actions et sauvegarde chaque changement. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  // Dernier objet chargé ou sauvegardé : on n'écrit que si l'état a vraiment changé,
  // donc jamais au simple démarrage.
  const persisted = useRef<Prefs | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPrefs().then((p) => {
      if (!cancelled) {
        persisted.current = p;
        setPrefs(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (prefs && prefs !== persisted.current) {
      persisted.current = prefs;
      void savePrefs(prefs);
    }
  }, [prefs]);

  const dispatch = useCallback((action: PrefsAction) => {
    setPrefs((p) => (p ? applyPrefsAction(p, action) : p));
  }, []);

  return { prefs, dispatch };
}
