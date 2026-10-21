interface Props {
  message: string;
  onRetry(): void;
}

export function PlayerError({ message, onRetry }: Props) {
  return (
    <div className="player-error" role="alert">
      <p>Impossible d'ouvrir le lecteur.</p>
      <p className="player-error-detail">{message}</p>
      <button type="button" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  );
}
