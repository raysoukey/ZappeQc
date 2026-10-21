import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { REVEAL_HIDE_DELAY_MS } from "../layout";

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const apply = useCallback(async (on: boolean) => {
    try {
      await getCurrentWindow().setFullscreen(on);
      setFullscreen(on);
      setRevealed(false);
    } catch (e) {
      console.warn("Plein écran refusé :", e);
    }
  }, []);

  const toggle = useCallback(() => void apply(!fullscreen), [apply, fullscreen]);
  const exit = useCallback(() => {
    if (fullscreen) void apply(false);
  }, [apply, fullscreen]);

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
