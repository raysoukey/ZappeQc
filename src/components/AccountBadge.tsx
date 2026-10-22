interface Props {
  provider: string;
  compact: boolean;
}

export function AccountBadge({ provider, compact }: Props) {
  const title = `Compte gratuit requis chez ${provider}. La connexion se fait dans le lecteur.`;
  return (
    <span
      className={compact ? "badge badge-dot" : "badge"}
      role="img"
      title={title}
      aria-label={title}
    >
      {compact ? "" : "Compte"}
    </span>
  );
}
