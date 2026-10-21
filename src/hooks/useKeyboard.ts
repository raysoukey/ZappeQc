import { useEffect } from "react";
import { keyToAction, type KeyAction } from "../keyboard";

export function useKeyboard(onAction: (action: KeyAction) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const action = keyToAction({
        key: e.key,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        targetTag: target?.tagName ?? "BODY",
      });
      if (!action) return;
      e.preventDefault();
      onAction(action);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAction]);
}
