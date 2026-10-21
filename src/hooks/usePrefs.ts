import { useCallback, useEffect, useRef, useState } from "react";
import { applyPrefsAction, type Prefs, type PrefsAction } from "../prefs";
import { loadPrefs, savePrefs } from "../store";

/** Charge les préférences au montage, applique les actions et sauvegarde après chaque changement. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadPrefs().then((p) => {
      if (!cancelled) {
        loaded.current = true;
        setPrefs(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (prefs && loaded.current) void savePrefs(prefs);
  }, [prefs]);

  const dispatch = useCallback((action: PrefsAction) => {
    setPrefs((p) => (p ? applyPrefsAction(p, action) : p));
  }, []);

  return { prefs, dispatch };
}
