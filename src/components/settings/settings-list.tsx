"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Messages } from "@/lib/i18n"
import type { SettingsSection } from "@/lib/settings"

export type SettingsTableRow = {
  id: string
  order?: number
  canDelete?: boolean
  cells: React.ReactNode[]
  searchText: string
}

type Props = {
  section: SettingsSection
  rows: SettingsTableRow[]
  columns: string[]
  messages: Messages
  canEdit: boolean
  canDelete: boolean
  canTranslate: boolean
  translating: boolean
  onEdit: (id: string) => void
  onDelete: (ids: string[]) => void
  onTranslate: (ids: string[]) => void
  onReorder: (activeId: string, overId: string) => void
}

export function SettingsList({
  section,
  rows,
  columns,
  messages,
  canEdit,
  canDelete,
  canTranslate,
  translating,
  onEdit,
  onDelete,
  onTranslate,
  onReorder,
}: Props) {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const pageIds = pageRows.map((row) => row.id)
  const pageIdKey = pageIds.join("\u0000")
  const availableIds = new Set(rows.map((row) => row.id))
  const validSelectedIds = new Set([...selectedIds].filter((id) => availableIds.has(id)))
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => validSelectedIds.has(id))
  const partiallySelected = pageIds.some((id) => validSelectedIds.has(id)) && !allPageSelected
  const isLocalizedSection = section !== "users"

  React.useEffect(() => {
    const currentPageIds = pageIdKey ? pageIdKey.split("\u0000") : []
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedIds((current) => current.size ? new Set() : current)
        return
      }

      const target = event.target as HTMLElement | null
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']")
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && !isTyping) {
        event.preventDefault()
        setSelectedIds((current) => {
          const next = new Set(current)
          currentPageIds.forEach((id) => next.add(id))
          return next
        })
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [pageIdKey])

  function togglePage(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      pageIds.forEach((id) => checked ? next.add(id) : next.delete(id))
      return next
    })
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (section === "unit-types" && over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id))
    }
  }

  return (
    <div className="space-y-3">
      {validSelectedIds.size === 0 ? (
        <p className="text-xs text-muted-foreground">{messages.selectionShortcut}</p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">№</TableHead>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={(checked) => togglePage(checked === true)}
                    aria-label={messages.selectAllPage}
                  />
                </TableHead>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                {(canEdit || canDelete) ? (
                  <TableHead className="w-24 text-right">{messages.actions}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 2 + (canEdit || canDelete ? 1 : 0)} className="h-28 text-center text-muted-foreground">
                    {messages.noRecords}
                  </TableCell>
                </TableRow>
              ) : pageRows.map((row, index) => (
                <SortableSettingsRow
                  key={row.id}
                  row={row}
                  rowNumber={(safePage - 1) * pageSize + index + 1}
                  selected={validSelectedIds.has(row.id)}
                  sortable={section === "unit-types"}
                  messages={messages}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onToggle={toggleRow}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        </SortableContext>
      </DndContext>

      {validSelectedIds.size > 0 ? (
        <div
          role="toolbar"
          aria-label={messages.bulkActions}
          className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <span className="px-2 text-sm font-medium">
            {validSelectedIds.size} {messages.selectedRows}
          </span>
          {canTranslate && isLocalizedSection ? (
            <Button variant="ghost" size="sm" disabled={translating} onClick={() => onTranslate([...validSelectedIds])}>
              {translating ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" /> : <LanguagesIcon />}
              {translating ? messages.translating : messages.autoFillTranslations}
            </Button>
          ) : null}
          {canDelete && [...validSelectedIds].some((id) => rows.find((row) => row.id === id)?.canDelete !== false) ? (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete([...validSelectedIds].filter((id) => rows.find((row) => row.id === id)?.canDelete !== false))}>
              <Trash2Icon />
              {messages.delete}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" aria-label={messages.cancel} title={messages.cancel} onClick={() => setSelectedIds(new Set())}>
            <XIcon />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {messages.rowsPerPage}
          <select
            value={pageSize}
            onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}
            className="h-8 rounded-lg border border-input bg-background px-2 text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{safePage} {messages.pageOf} {pageCount}</span>
          <Button variant="outline" size="icon" aria-label={messages.previousPage} disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon" aria-label={messages.nextPage} disabled={safePage === pageCount} onClick={() => setPage(Math.min(pageCount, safePage + 1))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SortableSettingsRow({
  row,
  rowNumber,
  selected,
  sortable,
  messages,
  canEdit,
  canDelete,
  onToggle,
  onEdit,
  onDelete,
}: {
  row: SettingsTableRow
  rowNumber: number
  selected: boolean
  sortable: boolean
  messages: Messages
  canEdit: boolean
  canDelete: boolean
  onToggle: (id: string, checked: boolean) => void
  onEdit: (id: string) => void
  onDelete: (ids: string[]) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !sortable })

  return (
    <TableRow
      ref={setNodeRef}
      data-state={selected ? "selected" : undefined}
      data-dragging={isDragging || undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
      className="data-dragging:bg-muted data-dragging:shadow-md"
    >
      <TableCell className="w-12 text-center text-muted-foreground tabular-nums">
        {rowNumber}
      </TableCell>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onToggle(row.id, checked === true)}
          aria-label={`${messages.selectOption}: ${row.searchText}`}
        />
      </TableCell>
      {row.cells.map((cell, index) => (
        <TableCell key={`${row.id}-${index}`}>
          {sortable && index === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                aria-label={messages.dragToReorder}
                title={messages.dragToReorder}
                {...attributes}
                {...listeners}
              >
                <GripVerticalIcon />
              </Button>
              {cell}
            </span>
          ) : cell}
        </TableCell>
      ))}
      {(canEdit || canDelete) ? (
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${messages.edit}: ${row.searchText}`}
                title={messages.edit}
                onClick={() => onEdit(row.id)}
              >
                <PencilIcon />
              </Button>
            ) : null}
            {canDelete && row.canDelete !== false ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                aria-label={`${messages.delete}: ${row.searchText}`}
                title={messages.delete}
                onClick={() => onDelete([row.id])}
              >
                <Trash2Icon />
              </Button>
            ) : null}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  )
}
