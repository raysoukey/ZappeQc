import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { channelById, type ChannelId } from "../channels";
import { playerRect, type LayoutState } from "../layout";
import { clearPlayerData, openPlayer, relayoutPlayer, windowLogicalSize } from "./playerWebview";
import { Sequence } from "./sequence";

export type PlayerStatus = "idle" | "loading" | "ready" | "error";

export interface PlayerState {
  channelId: ChannelId | null;
  status: PlayerStatus;
  error: string | null;
}

const IDLE: PlayerState = { channelId: null, status: "idle", error: null };

export function usePlayer(layout: LayoutState) {
  const [state, setState] = useState<PlayerState>(IDLE);
  const layoutRef = useRef(layout);
  const seq = useRef(new Sequence());

  // Dernière disposition connue, lue par `open` et par le repositionnement.
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const open = useCallback((id: ChannelId) => {
    const n = seq.current.next();
    setState({ channelId: id, status: "loading", error: null });
    void (async () => {
      try {
        const rect = playerRect(await windowLogicalSize(), layoutRef.current);
        await openPlayer(channelById(id).url, rect);
        if (seq.current.isCurrent(n)) setState({ channelId: id, status: "ready", error: null });
      } catch (e) {
        if (seq.current.isCurrent(n))
          setState({ channelId: id, status: "error", error: String(e) });
      }
    })();
  }, []);

  const retry = useCallback(() => {
    if (state.channelId) open(state.channelId);
  }, [open, state.channelId]);

  const clearData = useCallback(async () => {
    await clearPlayerData();
    if (state.channelId) open(state.channelId);
  }, [open, state.channelId]);

  // Repositionner la webview à chaque changement de disposition ou de taille de fenêtre.
  useEffect(() => {
    let cancelled = false;
    const relayout = async () => {
      const rect = playerRect(await windowLogicalSize(), layoutRef.current);
      if (!cancelled) await relayoutPlayer(rect);
    };
    void relayout();
    const unlisten = getCurrentWindow().onResized(() => void relayout());
    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn());
    };
  }, [layout.collapsed, layout.fullscreen, layout.revealed]);

  return { state, open, retry, clearData };
}
