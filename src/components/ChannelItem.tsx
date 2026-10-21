import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Channel, ChannelId } from "../channels";
import { AccountBadge } from "./AccountBadge";

interface Props {
  channel: Channel;
  index: number;
  selected: boolean;
  pinned: boolean;
  collapsed: boolean;
  onSelect(id: ChannelId): void;
  onTogglePin(id: ChannelId): void;
}

export function ChannelItem({
  channel,
  index,
  selected,
  pinned,
  collapsed,
  onSelect,
  onTogglePin,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: channel.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const title = collapsed ? `${index + 1}. ${channel.name}` : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={["channel", selected ? "selected" : "", isDragging ? "dragging" : ""].join(" ")}
    >
      <button
        type="button"
        className="channel-main"
        title={title}
        aria-label={collapsed ? channel.name : undefined}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(channel.id)}
      >
        <span className="monogram" style={{ background: channel.color }}>
          {channel.monogram}
        </span>
        {!collapsed && <span className="channel-name">{channel.name}</span>}
        {channel.requiresAccount && (
          <AccountBadge provider={channel.provider} compact={collapsed} />
        )}
      </button>
      {!collapsed && (
        <>
          <button
            type="button"
            className={pinned ? "pin pinned" : "pin"}
            title={pinned ? "Retirer des favoris" : "Épingler en favori"}
            aria-pressed={pinned}
            onClick={() => onTogglePin(channel.id)}
          >
            ★
          </button>
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="drag-handle"
            title="Déplacer (glisser, ou Espace puis flèches)"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        </>
      )}
    </li>
  );
}
