import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { channelById, type ChannelId } from "../channels";
import { playerRect, type LayoutState } from "../layout";
import { clearPlayerData, openPlayer, relayoutPlayer, windowLogicalSize } from "./playerWebview";
import { Sequence } from "./sequence";
import { Serial } from "./serial";

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
  const queue = useRef(new Serial());
  const relayoutSeq = useRef(new Sequence());

  // Dernière disposition connue, lue par `open` et par le repositionnement.
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Dernier gagnant : un repositionnement dépassé par un plus récent est abandonné
  // avant d'appeler la webview (plusieurs resize rapprochés pendant un redimensionnement).
  const relayout = useCallback(async () => {
    const n = relayoutSeq.current.next();
    const size = await windowLogicalSize();
    if (!relayoutSeq.current.isCurrent(n)) return;
    await relayoutPlayer(playerRect(size, layoutRef.current));
  }, []);

  const open = useCallback(
    (id: ChannelId) => {
      const n = seq.current.next();
      setState({ channelId: id, status: "loading", error: null });
      // Une création à la fois : deux demandes rapprochées ne se disputent pas le label `player`.
      void queue.current.run(async () => {
        if (!seq.current.isCurrent(n)) return; // demande déjà remplacée, on ne touche pas à la webview
        try {
          const rect = playerRect(await windowLogicalSize(), layoutRef.current);
          await openPlayer(channelById(id).url, rect);
          // La disposition a pu changer pendant la création.
          await relayout();
          if (seq.current.isCurrent(n)) setState({ channelId: id, status: "ready", error: null });
        } catch (e) {
          if (seq.current.isCurrent(n))
            setState({ channelId: id, status: "error", error: String(e) });
        }
      });
    },
    [relayout],
  );

  const retry = useCallback(() => {
    if (state.channelId) open(state.channelId);
  }, [open, state.channelId]);

  const clearData = useCallback(async () => {
    await clearPlayerData();
    if (state.channelId) open(state.channelId);
  }, [open, state.channelId]);

  // Un seul abonnement au redimensionnement de la fenêtre pour toute la vie du hook.
  useEffect(() => {
    let active = true;
    const unlisten = getCurrentWindow().onResized(() => {
      if (active) void relayout();
    });
    return () => {
      active = false;
      void unlisten.then((fn) => fn());
    };
  }, [relayout]);

  // Repositionner à chaque changement de disposition.
  useEffect(() => {
    void relayout();
  }, [relayout, layout.collapsed, layout.fullscreen, layout.revealed]);

  // Identité stable : les consommateurs peuvent dépendre de l'objet sans se réabonner à chaque rendu.
  return useMemo(() => ({ state, open, retry, clearData }), [state, open, retry, clearData]);
}
