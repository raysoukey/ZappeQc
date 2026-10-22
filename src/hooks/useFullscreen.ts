import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { REVEAL_HIDE_DELAY_MS } from "../layout";

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<number | null>(null);
  // État visé, mis à jour dès la demande : deux pressions rapides de F s'annulent
  // même si `setFullscreen` n'a pas encore répondu.
  const target = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const apply = useCallback(async (on: boolean) => {
    target.current = on;
    try {
      await getCurrentWindow().setFullscreen(on);
      setFullscreen(on);
      setRevealed(false);
    } catch (e) {
      target.current = !on;
      console.warn("Plein écran refusé :", e);
    }
  }, []);

  const toggle = useCallback(() => void apply(!target.current), [apply]);
  const exit = useCallback(() => {
    if (target.current) void apply(false);
  }, [apply]);

  const reveal = useCallback(() => {
    clearTimer();
    setRevealed(true);
  }, []);

  const hideSoon = useCallback(() => {
    clearTimer();
    timer.current = window.setTimeout(() => setRevealed(false), REVEAL_HIDE_DELAY_MS);
  }, []);

  useEffect(() => clearTimer, []);

  return { fullscreen, revealed, toggle, exit, reveal, hideSoon };
}
