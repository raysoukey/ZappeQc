import { useState } from "react";
import type { Channel, ChannelId } from "../channels";
import type { PlayerState } from "../player/usePlayer";
import { ChannelList } from "./ChannelList";
import { PlayerError } from "./PlayerError";

export interface SidebarProps {
  channels: Channel[];
  selectedId: ChannelId | null;
  pinned: ChannelId[];
  collapsed: boolean;
  player: PlayerState;
  onSelect(id: ChannelId): void;
  onTogglePin(id: ChannelId): void;
  onReorder(from: number, to: number): void;
  onToggleCollapsed(): void;
  onToggleFullscreen(): void;
  onRetry(): void;
  onClearData(): Promise<void>;
}

const SHORTCUTS_HELP =
  "Raccourcis : F plein écran, Échap quitter, ↑/↓ changer de chaîne, 1-9 chaîne directe, Ctrl+B replier. " +
  "Ils fonctionnent quand cette barre a le focus : cliquez-la après avoir cliqué dans le lecteur.";

export function Sidebar(p: SidebarProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  async function clearData() {
    setClearing(true);
    setClearError(null);
    try {
      await p.onClearData();
    } catch (e) {
      setClearError(String(e));
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <aside
      className={p.collapsed ? "sidebar collapsed" : "sidebar"}
      title={p.collapsed ? SHORTCUTS_HELP : undefined}
    >
      <header
        className="sidebar-header"
        onDoubleClick={p.onToggleFullscreen}
        title={SHORTCUTS_HELP}
      >
        {!p.collapsed && <h1>ZappeQc</h1>}
        <button
          type="button"
          className="collapse"
          onClick={p.onToggleCollapsed}
          onDoubleClick={(e) => e.stopPropagation()}
          title={p.collapsed ? "Déplier la barre (Ctrl+B)" : "Replier la barre (Ctrl+B)"}
          aria-label={p.collapsed ? "Déplier" : "Replier"}
        >
          {p.collapsed ? "›" : "‹"}
        </button>
      </header>

      <ChannelList
        channels={p.channels}
        selectedId={p.selectedId}
        pinned={p.pinned}
        collapsed={p.collapsed}
        onSelect={p.onSelect}
        onTogglePin={p.onTogglePin}
        onReorder={p.onReorder}
      />

      {p.player.status === "error" && !p.collapsed && (
        <PlayerError message={p.player.error ?? "Erreur inconnue"} onRetry={p.onRetry} />
      )}

      {p.collapsed && p.player.status === "loading" && (
        <span className="rail-status" title="Chargement…" aria-label="Chargement…">
          …
        </span>
      )}
      {p.collapsed && p.player.status === "error" && (
        <button
          type="button"
          className="rail-error"
          title={`Impossible d'ouvrir le lecteur : ${p.player.error ?? "erreur inconnue"}. Cliquer pour réessayer.`}
          aria-label="Erreur du lecteur, réessayer"
          onClick={p.onRetry}
        >
          !
        </button>
      )}

      {!p.collapsed && (
        <footer className="sidebar-footer">
          {p.player.status === "loading" && <p className="status">Chargement…</p>}
          {confirmClear ? (
            <div className="confirm">
              <p>Vous serez déconnecté des sites des diffuseurs. Confirmer ?</p>
              <button type="button" onClick={clearData} disabled={clearing}>
                {clearing ? "Effacement…" : "Confirmer"}
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} disabled={clearing}>
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="clear-data"
              disabled={p.player.status !== "ready"}
              onClick={() => setConfirmClear(true)}
              title="Supprime témoins et connexions des sites des diffuseurs"
            >
              Effacer les données de navigation
            </button>
          )}
          {clearError && (
            <p className="footer-error" role="alert">
              Effacement impossible : {clearError}
            </p>
          )}
        </footer>
      )}
    </aside>
  );
}
