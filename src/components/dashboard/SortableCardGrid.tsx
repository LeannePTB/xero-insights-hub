import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export type SortableCard = { id: string; node: ReactNode; fullWidth?: boolean };

function SortableItem({ id, children, fullWidth }: { id: string; children: ReactNode; fullWidth?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as const;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative${fullWidth ? " [column-span:all]" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute right-3 top-3 z-10 grid h-7 w-7 cursor-grab touch-none place-items-center rounded-md bg-muted/70 text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100 active:cursor-grabbing focus:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

export function SortableCardGrid({
  cards,
  savedOrder,
  onOrderChange,
}: {
  cards: SortableCard[];
  savedOrder: string[];
  onOrderChange: (order: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards.map((c) => c.id).join("|")]);

  const initial = useMemo(() => {
    const known = new Set(cardIds);
    const sorted = savedOrder.filter((id) => known.has(id));
    const extras = cardIds.filter((id) => !sorted.includes(id));
    return [...sorted, ...extras];
  }, [cardIds, savedOrder.join("|")]);

  const [localOrder, setLocalOrder] = useState<string[]>(initial);

  // Only reset local order when the saved order from the server actually
  // changes, or when the set of cards changes. Do NOT reset on every parent
  // re-render — that was clobbering the user's drag before the debounced save
  // landed.
  const savedKey = useRef(savedOrder.join("|"));
  const cardsKey = useRef(cardIds.join("|"));
  useEffect(() => {
    const sKey = savedOrder.join("|");
    const cKey = cardIds.join("|");
    if (sKey !== savedKey.current || cKey !== cardsKey.current) {
      savedKey.current = sKey;
      cardsKey.current = cKey;
      setLocalOrder(initial);
    }
  }, [initial, savedOrder, cardIds]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c.node])), [cards]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = localOrder.indexOf(String(active.id));
    const newIdx = localOrder.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(localOrder, oldIdx, newIdx);
    setLocalOrder(next);
    onOrderChange(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localOrder} strategy={rectSortingStrategy}>
        <div className="columns-1 gap-6 lg:columns-2 [&>*]:mb-6 [&>*]:break-inside-avoid">
          {localOrder.map((id) => {
            const card = cards.find((c) => c.id === id);
            const node = cardById.get(id);
            if (!node) return null;
            return (
              <SortableItem key={id} id={id} fullWidth={card?.fullWidth}>
                {node}
              </SortableItem>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
