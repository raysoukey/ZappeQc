import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Channel, ChannelId } from "../channels";
import { ChannelItem } from "./ChannelItem";

interface Props {
  channels: Channel[];
  selectedId: ChannelId | null;
  pinned: ChannelId[];
  collapsed: boolean;
  onSelect(id: ChannelId): void;
  onTogglePin(id: ChannelId): void;
  onReorder(from: number, to: number): void;
}

export function ChannelList({
  channels,
  selectedId,
  pinned,
  collapsed,
  onSelect,
  onTogglePin,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = channels.map((c) => c.id);

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    onReorder(ids.indexOf(e.active.id as ChannelId), ids.indexOf(e.over.id as ChannelId));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="channel-list" aria-label="Chaînes">
          {channels.map((c, i) => (
            <ChannelItem
              key={c.id}
              channel={c}
              index={i}
              selected={c.id === selectedId}
              pinned={pinned.includes(c.id)}
              collapsed={collapsed}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
