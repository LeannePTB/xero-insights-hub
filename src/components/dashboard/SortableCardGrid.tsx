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
import { Button } from "@/components/ui/button";
import { groupedCardIds, canReorderCards, smallCardRowSizes, isFixedCardGroup } from "./dashboard-card-layout";

export type SortableCard = { id: string; node: ReactNode; fullWidth?: boolean; group?: string; groupLabel?: string };

function SortableItem({ id, children, stretch, fixed }: { id: string; children: ReactNode; stretch?: boolean; fixed?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: fixed });
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
      // Only cards sharing a row stretch to equal height; a card alone in its row
      // always grows to fit its content so nothing below can overlap it.
      className={`relative min-w-0 ${stretch ? "flex flex-col [&>div:last-child]:flex-1 [&>section:last-child]:flex-1" : ""}`}
    >
      {!fixed && <Button
        variant="ghost" size="icon-sm"
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute right-3 top-3 z-10 grid h-7 w-7 cursor-grab touch-none place-items-center rounded-md bg-muted/70 text-muted-foreground opacity-60 transition-opacity hover:bg-muted hover:opacity-100 active:cursor-grabbing focus:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </Button>}
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
    return groupedCardIds(cards, savedOrder);
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

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    if (!canReorderCards(cards, String(active.id), String(over.id))) return;
    const oldIdx = localOrder.indexOf(String(active.id));
    const newIdx = localOrder.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(localOrder, oldIdx, newIdx);
    setLocalOrder(next);
    onOrderChange(next);
  }

  const ordered = groupedCardIds(cards, localOrder).flatMap(id => { const c = cards.find(c => c.id === id); return c ? [c] : []; });
  const sections: { key: string; label?: string; rows: SortableCard[][] }[] = [];
  for (const card of ordered) {
    let section = sections.at(-1);
    if (!section || section.key !== (card.group ?? 'cards')) {
      section = { key: card.group ?? 'cards', label: card.groupLabel, rows: [] };
      sections.push(section);
    }
    const last = section.rows.at(-1);
    if (card.fullWidth || !last || last[0]?.fullWidth) section.rows.push([card]);
    else last.push(card);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localOrder} strategy={rectSortingStrategy}>
        <div className="space-y-6">
          {sections.map((section, sectionIndex) => <section key={`${section.key}:${sectionIndex}`}>
            {section.label && <h2 className="mb-3 border-b border-border pb-2 font-display text-base font-semibold">{section.label}</h2>}
            <div className="space-y-4">
              {section.rows.flatMap((run, index) => {
                const sizes = run[0]?.fullWidth ? [1] : smallCardRowSizes(run.length);
                let offset = 0;
                return sizes.map((size, rowIndex) => {
                  const row = run.slice(offset, offset + size); offset += size;
                  const columns = size === 3 ? 'lg:grid-cols-3' : size === 2 ? 'lg:grid-cols-2' : '';
                  const fixed = isFixedCardGroup(section.key);
                  return <div key={`${index}:${rowIndex}`} className={`grid grid-cols-1 ${fixed ? 'items-start' : 'items-stretch'} gap-4 ${columns}`}>
                    {row.map(card => <SortableItem key={card.id} id={card.id} fixed={fixed} stretch={!fixed && row.length > 1}>{card.node}</SortableItem>)}
                  </div>;
                });
              })}
            </div>
          </section>)}
        </div>
      </SortableContext>
    </DndContext>
  );
}
