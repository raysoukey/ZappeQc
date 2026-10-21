import { useEffect, useRef, useState } from "react";
import "./App.css";
import { channelById, type ChannelId } from "./channels";
import { Sidebar } from "./components/Sidebar";
import { usePrefs } from "./hooks/usePrefs";
import type { LayoutState } from "./layout";
import { usePlayer } from "./player/usePlayer";
import { displayOrder } from "./prefs";

function App() {
  const { prefs, dispatch } = usePrefs();
  const [fullscreen] = useState(false); // remplacé par useFullscreen en tâche 8
  const [revealed] = useState(false);
  const layout: LayoutState = {
    collapsed: prefs?.sidebarCollapsed ?? false,
    fullscreen,
    revealed,
  };
  const player = usePlayer(layout);
  const openedLast = useRef(false);

  // Rouvrir la dernière chaîne une seule fois, quand les préférences sont chargées.
  useEffect(() => {
    if (prefs && !openedLast.current) {
      openedLast.current = true;
      if (prefs.lastChannelId) player.open(prefs.lastChannelId);
    }
  }, [prefs, player]);

  if (!prefs) return <div className="app" />;

  const shown = displayOrder(prefs).map(channelById);

  function select(id: ChannelId) {
    dispatch({ type: "selectChannel", id });
    player.open(id);
  }

  return (
    <div className="app">
      <Sidebar
        channels={shown}
        selectedId={player.state.channelId}
        pinned={prefs.pinned}
        collapsed={prefs.sidebarCollapsed}
        player={player.state}
        onSelect={select}
        onTogglePin={(id) => dispatch({ type: "togglePin", id })}
        onReorder={(from, to) => dispatch({ type: "reorder", from, to })}
        onToggleCollapsed={() =>
          dispatch({ type: "setCollapsed", collapsed: !prefs.sidebarCollapsed })
        }
        onToggleFullscreen={() => undefined}
        onRetry={player.retry}
        onClearData={player.clearData}
      />
      {player.state.status === "idle" && (
        <main className="welcome">
          <h2>Choisissez une chaîne</h2>
          <p>La page de direct du diffuseur s'ouvrira ici.</p>
        </main>
      )}
    </div>
  );
}

export default App;
