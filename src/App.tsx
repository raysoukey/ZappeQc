import { useCallback, useEffect, useMemo, useRef } from "react";
import "./App.css";
import { channelById, type ChannelId } from "./channels";
import { Sidebar } from "./components/Sidebar";
import { useFullscreen } from "./hooks/useFullscreen";
import { useKeyboard } from "./hooks/useKeyboard";
import { usePrefs } from "./hooks/usePrefs";
import { channelForDigit, nextChannel, type KeyAction } from "./keyboard";
import type { LayoutState } from "./layout";
import { usePlayer } from "./player/usePlayer";
import { displayOrder } from "./prefs";

function App() {
  const { prefs, dispatch } = usePrefs();
  const fs = useFullscreen();
  const layout: LayoutState = {
    collapsed: prefs?.sidebarCollapsed ?? false,
    fullscreen: fs.fullscreen,
    revealed: fs.revealed,
  };
  const player = usePlayer(layout);
  const openedLast = useRef(false);

  useEffect(() => {
    if (prefs && !openedLast.current) {
      openedLast.current = true;
      if (prefs.lastChannelId) player.open(prefs.lastChannelId);
    }
  }, [prefs, player]);

  const shownIds = useMemo(() => (prefs ? displayOrder(prefs) : []), [prefs]);

  const select = useCallback(
    (id: ChannelId) => {
      dispatch({ type: "selectChannel", id });
      player.open(id);
    },
    [dispatch, player],
  );

  const onKey = useCallback(
    (a: KeyAction) => {
      switch (a.type) {
        case "toggleFullscreen":
          return fs.toggle();
        case "exitFullscreen":
          return fs.exit();
        case "toggleCollapsed":
          return dispatch({
            type: "setCollapsed",
            collapsed: !(prefs?.sidebarCollapsed ?? false),
          });
        case "step": {
          const id = nextChannel(shownIds, player.state.channelId, a.delta);
          if (id) select(id);
          return;
        }
        case "digit": {
          const id = channelForDigit(shownIds, a.index);
          if (id) select(id);
          return;
        }
      }
    },
    [dispatch, fs, player.state.channelId, prefs?.sidebarCollapsed, select, shownIds],
  );
  useKeyboard(onKey);

  if (!prefs) return <div className="app" />;

  const showStripOnly = fs.fullscreen && !fs.revealed;

  return (
    <div className="app">
      {showStripOnly ? (
        <div
          className="strip"
          onMouseEnter={fs.reveal}
          title="Afficher les chaînes (Échap : quitter le plein écran)"
        />
      ) : (
        <div
          onMouseLeave={fs.fullscreen ? fs.hideSoon : undefined}
          onMouseEnter={fs.fullscreen ? fs.reveal : undefined}
        >
          <Sidebar
            channels={shownIds.map(channelById)}
            selectedId={player.state.channelId}
            pinned={prefs.pinned}
            collapsed={prefs.sidebarCollapsed && !fs.fullscreen}
            player={player.state}
            onSelect={select}
            onTogglePin={(id) => dispatch({ type: "togglePin", id })}
            onReorder={(from, to) => dispatch({ type: "reorder", from, to })}
            onToggleCollapsed={() =>
              dispatch({ type: "setCollapsed", collapsed: !prefs.sidebarCollapsed })
            }
            onToggleFullscreen={fs.toggle}
            onRetry={player.retry}
            onClearData={player.clearData}
          />
        </div>
      )}
      {player.state.status === "idle" && !fs.fullscreen && (
        <main className="welcome">
          <h2>Choisissez une chaîne</h2>
          <p>La page de direct du diffuseur s'ouvrira ici.</p>
        </main>
      )}
    </div>
  );
}

export default App;
