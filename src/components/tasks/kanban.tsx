"use client"

import { useId, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Over,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export type KanbanColumn = { id: string; label: string; header?: React.ReactNode }
type Layout = Record<string, string[]>

/**
 * Drag-and-drop board shared by the project board (columns = project status) and the task board
 * (columns = task status). Pointer + keyboard (grip button: space to lift, arrows to move, space to drop,
 * esc to cancel) with screen-reader announcements. Moves show immediately; `onMove` resolving false rolls back.
 * `reorder = false`: only moving to another column counts (the list keeps its own sort order).
 */
export function Kanban<T extends { id: string }>({
  columns,
  items,
  columnOf,
  itemLabel,
  renderCard,
  onMove,
  disabled = false,
  reorder = true,
  noun = "item",
  emptyText = "Nothing here",
  className,
}: {
  columns: KanbanColumn[]
  /** In display order; grouped into columns with `columnOf`. */
  items: T[]
  columnOf: (item: T) => string
  itemLabel: (item: T) => string
  /** `handle` is the drag grip (null when disabled); put it somewhere in the card. */
  renderCard: (item: T, handle: React.ReactNode) => React.ReactNode
  onMove: (item: T, column: string, index: number) => Promise<boolean>
  disabled?: boolean
  reorder?: boolean
  noun?: string
  emptyText?: string
  className?: string
}) {
  const group = (list: T[]): Layout =>
    Object.fromEntries(columns.map((c) => [c.id, list.filter((i) => columnOf(i) === c.id).map((i) => i.id)]))

  // Local layout so drops show instantly; reset whenever fresh items arrive from the server.
  // Cards stay in their own column while dragging (moving them mid-drag re-measures the active node and makes
  // keyboard moves skip columns); the target column shows an insertion marker instead.
  const [source, setSource] = useState(items)
  const [layout, setLayout] = useState(() => group(items))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [target, setTarget] = useState<{ column: string; index: number } | null>(null)
  if (source !== items) {
    setSource(items)
    setLayout(group(items))
  }

  const byId = new Map(items.map((i) => [i.id, i]))
  const label = (id: UniqueIdentifier) => {
    const item = byId.get(String(id))
    return item ? itemLabel(item) : noun
  }
  const columnName = (id: string) => columns.find((c) => c.id === id)?.label ?? id
  const findColumn = (id: UniqueIdentifier) =>
    String(id) in layout ? String(id) : Object.keys(layout).find((k) => layout[k].includes(String(id)))

  /** Drop target for `over`: the column, and the index the active card would take there (arrayMove semantics). */
  function dropTarget(activeKey: UniqueIdentifier, over: Over | null) {
    if (!over) return null
    const column = findColumn(over.id)
    if (!column) return null
    const list = layout[column]
    const overIndex = list.indexOf(String(over.id))
    const sameColumn = list.includes(String(activeKey))
    const index = overIndex >= 0 ? overIndex : sameColumn ? list.length - 1 : list.length
    return { column, index }
  }
  const where = (activeKey: UniqueIdentifier, over: Over | null) => {
    const t = dropTarget(activeKey, over)
    if (!t) return "no column"
    const size = layout[t.column].length + (layout[t.column].includes(String(activeKey)) ? 0 : 1)
    return `${columnName(t.column)}, position ${t.index + 1} of ${size}`
  }

  const dndId = useId() // stable ids for the SR instructions (no hydration mismatch)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${label(active.id)} in ${columnName(findColumn(active.id) ?? "")}. Use the arrow keys to move it.`,
    // Over itself = no news (keeps "Picked up…" audible at the start).
    onDragOver: ({ active, over }) =>
      over?.id === active.id ? undefined : `${label(active.id)} is over ${where(active.id, over)}.`,
    onDragEnd: ({ active, over }) => `${label(active.id)} dropped in ${where(active.id, over)}.`,
    onDragCancel: ({ active }) => `Move cancelled. ${label(active.id)} is back where it started.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    setTarget(null)
    const from = findColumn(active.id)
    const t = dropTarget(active.id, over)
    const item = byId.get(String(active.id))
    if (!from || !t || !item) return
    const oldIndex = layout[from].indexOf(String(active.id))
    if (from === t.column && (!reorder || t.index === oldIndex)) return

    const before = layout
    const next = { ...layout, [from]: layout[from].filter((i) => i !== active.id) }
    next[t.column] = [...next[t.column].slice(0, t.index), String(active.id), ...next[t.column].slice(t.index)]
    setLayout(next)
    void onMove(item, t.column, t.index).then((ok) => {
      if (!ok) setLayout(before)
    })
  }

  const active = activeId ? byId.get(activeId) : undefined

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: `To move this ${noun}, press space or enter to pick it up, use the arrow keys to move it between columns and positions, press space or enter to drop it, or escape to cancel.`,
        },
      }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragOver={({ active, over }) => {
        const t = dropTarget(active.id, over)
        setTarget(t && t.column !== findColumn(active.id) ? t : null)
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setTarget(null)
      }}
    >
      <div
        className={cn(
          // Phones: columns scroll sideways and snap; wider screens: one row of equal columns.
          // `relative` keeps sr-only text in off-screen columns inside the scroller (else it widens the page).
          "relative -mx-4 grid snap-x snap-mandatory auto-cols-[minmax(17rem,85%)] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:auto-cols-[minmax(15rem,1fr)] sm:px-0",
          className
        )}
      >
        {columns.map((c) => (
          <Column key={c.id} column={c} count={layout[c.id]?.length ?? 0} targeted={target?.column === c.id}>
            <SortableContext id={c.id} items={layout[c.id] ?? []} strategy={verticalListSortingStrategy}>
              {(layout[c.id] ?? []).map((id, i) => {
                const item = byId.get(id)
                return item ? (
                  <SortableCard
                    key={id}
                    id={id}
                    label={itemLabel(item)}
                    disabled={disabled}
                    markBefore={target?.column === c.id && target.index === i}
                  >
                    {(handle) => renderCard(item, handle)}
                  </SortableCard>
                ) : null
              })}
            </SortableContext>
            {target?.column === c.id && target.index >= (layout[c.id]?.length ?? 0) && <Marker />}
            {(layout[c.id]?.length ?? 0) === 0 && !(target?.column === c.id) && (
              <li className="text-muted-foreground grid min-h-20 place-items-center rounded-lg border border-dashed text-xs">
                {emptyText}
              </li>
            )}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          // No rotate/scale here: the overlay's rect is the collision rect, and the keyboard getter measures it.
          <div className="ring-brand/60 cursor-grabbing rounded-lg shadow-lg ring-2">
            {renderCard(active, <Grip />)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  column,
  count,
  targeted,
  children,
}: {
  column: KanbanColumn
  count: number
  targeted: boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: column.id })
  return (
    <section
      aria-label={`${column.label}, ${count}`}
      className={cn(
        "bg-muted/40 flex min-w-0 snap-start flex-col rounded-xl border p-2 transition-colors",
        targeted && "border-brand/60 bg-brand-soft/40"
      )}
    >
      <header className="flex items-center gap-2 px-1.5 pt-1 pb-2">
        {column.header ?? <h3 className="eyebrow text-foreground">{column.label}</h3>}
        <span className="text-muted-foreground ms-auto font-mono text-xs tabular-nums">{count}</span>
      </header>
      <ul ref={setNodeRef} className="grid min-h-20 flex-1 content-start gap-2">
        {children}
      </ul>
    </section>
  )
}

/** Where a card from another column will land. */
function Marker() {
  return <li aria-hidden className="bg-brand h-0.5 list-none rounded-full" />
}

function Grip() {
  return <GripVertical aria-hidden className="size-4" />
}

function SortableCard({
  id,
  label,
  disabled,
  markBefore,
  children,
}: {
  id: string
  label: string
  disabled: boolean
  markBefore: boolean
  children: (handle: React.ReactNode) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })
  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Move ${label}`}
      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 -m-1 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md outline-none focus-visible:ring-3 active:cursor-grabbing pointer-coarse:size-9"
    >
      <Grip />
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("list-none", isDragging && "opacity-40")}
    >
      {markBefore && <span aria-hidden className="bg-brand -mt-1 mb-1 block h-0.5 rounded-full" />}
      {children(handle)}
    </li>
  )
}
