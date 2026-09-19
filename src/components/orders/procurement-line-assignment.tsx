"use client"

import * as React from "react"
import { CheckIcon, UserRoundIcon } from "lucide-react"

import { useProcurement } from "@/components/procurement/procurement-provider"
import { useSettings } from "@/components/settings/settings-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { Locale } from "@/lib/i18n"
import {
  buildProcurementSuborders,
  getProcurementLineAssignments,
  getRequiredProcurementLines,
  getUnassignedProcurementLines,
  type OrderRecord,
} from "@/lib/orders"
import { getRequiredProcurementQuantity } from "@/lib/procurement"
import { getLocalizedTitle } from "@/lib/settings"

export function ProcurementLineAssignment({
  order,
  procurementCaseId,
  lang,
}: {
  order: OrderRecord
  procurementCaseId: string
  lang: Locale
}) {
  const { data, currentUserId } = useSettings()
  const { cases, assignSpecialist } = useProcurement()
  const copy = assignmentCopy(lang)
  const currentUser = data.users.find((user) => user.id === currentUserId)
  const specialists = data.users.filter(
    (user) =>
      user.roleIds.includes("role-procurement_manager") &&
      user.departmentIds.some((id) => currentUser?.departmentIds.includes(id)),
  )
  const lines = getRequiredProcurementLines(order)
  const unassignedLines = getUnassignedProcurementLines(order)
  const assignments = getProcurementLineAssignments(order)
  const assignedCount = lines.filter((line) => assignments[line.id]).length
  const suborders = buildProcurementSuborders(order)
  const [specialistId, setSpecialistId] = React.useState(specialists[0]?.id ?? "")
  const [selectedLineIds, setSelectedLineIds] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const effectiveSpecialistId = specialistId || specialists[0]?.id || ""

  const workloadFor = (userId: string) => cases.filter(
    (item) => item.stage !== "approved" && (item.assigneeIds ?? (item.assigneeId ? [item.assigneeId] : [])).includes(userId),
  ).length

  function toggleLine(lineId: string, checked: boolean) {
    setSelectedLineIds((current) => checked
      ? [...new Set([...current, lineId])]
      : current.filter((id) => id !== lineId))
  }

  async function saveAssignment() {
    if (!effectiveSpecialistId || !selectedLineIds.length) return
    setSaving(true)
    setError("")
    const saved = await assignSpecialist(procurementCaseId, effectiveSpecialistId, selectedLineIds)
    setSaving(false)
    if (!saved) {
      setError(copy.actionFailed)
      return
    }
    setSelectedLineIds([])
  }

  return (
    <section className="space-y-4 rounded-lg border bg-background p-3" aria-labelledby="procurement-assignment-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="procurement-assignment-title" className="flex items-center gap-2 text-sm font-semibold">
            <UserRoundIcon className="size-4" aria-hidden="true" />
            {copy.title}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
        </div>
        <Badge variant={assignedCount === lines.length ? "secondary" : "outline"}>
          {copy.progress(assignedCount, lines.length)}
        </Badge>
      </div>

      {suborders.length ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3" role="status">
          <p className="text-xs font-medium text-muted-foreground">{copy.splitOrders}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {suborders.map((suborder) => (
              <div key={suborder.id} className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CheckIcon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-sm font-semibold">{suborder.number}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {data.users.find((item) => item.id === suborder.specialistUserId)?.fullName ?? suborder.specialistUserId}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="secondary">
                    {copy.assignedItems(suborder.orderLineIds.length)}
                  </Badge>
                  {suborder.status === "submitted" ? (
                    <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                      {copy.submitted}
                    </Badge>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {unassignedLines.length ? (
        <fieldset className="space-y-2">
          <legend className="sr-only">{copy.selectPositions}</legend>
          {unassignedLines.map((line) => {
            const product = data.products.find((item) => item.id === line.productId)
            const unit = data["unit-types"].find((item) => item.id === (line.unitTypeId ?? product?.unitTypeId))
            const selected = selectedLineIds.includes(line.id)
            const title = product ? getLocalizedTitle(product, lang) : line.productId
            const positionNumber = lines.findIndex((item) => item.id === line.id) + 1
            return (
              <label
                key={line.id}
                className={`grid min-h-16 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-lg border p-3 transition-colors sm:flex ${selected ? "border-primary/40 bg-primary/5" : "hover:bg-muted/35"}`}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={selected}
                  onCheckedChange={(checked) => toggleLine(line.id, checked === true)}
                  aria-label={`${copy.selectPosition}: ${title}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium">{positionNumber}. {title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {copy.quantity}: {getRequiredProcurementQuantity(line)} {unit ? getLocalizedTitle(unit, lang) : ""}
                  </span>
                </span>
                <Badge variant="outline" className="col-start-2 w-fit max-w-full shrink-0 whitespace-normal sm:ml-auto sm:max-w-44 sm:text-right">
                  {copy.unassigned}
                </Badge>
              </label>
            )
          })}
        </fieldset>
      ) : (
        <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground" role="status">
          {copy.allAssigned}
        </p>
      )}

      {unassignedLines.length ? (
        <div className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="order-procurement-specialist">{copy.specialist}</Label>
            <select
              id="order-procurement-specialist"
              value={effectiveSpecialistId}
              onChange={(event) => setSpecialistId(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.fullName} — {copy.workload(workloadFor(specialist.id))}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!effectiveSpecialistId || !selectedLineIds.length || saving}
            onClick={saveAssignment}
          >
            <UserRoundIcon aria-hidden="true" />
            {saving ? copy.saving : copy.assignSelected(selectedLineIds.length)}
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </section>
  )
}

function assignmentCopy(lang: Locale) {
  if (lang === "ru") return {
    title: "Распределить позиции",
    description: "Отметьте товары и назначьте их ответственному специалисту. Назначенные позиции скрываются из списка.",
    progress: (assigned: number, total: number) => `Назначено ${assigned} из ${total}`,
    selectPositions: "Позиции для назначения",
    selectPosition: "Выбрать позицию",
    quantity: "К закупке",
    unassigned: "Не назначено",
    splitOrders: "Разделённые заказы",
    submitted: "Отправлен",
    assignedItems: (count: number) => `${count} поз.`,
    allAssigned: "Все позиции уже распределены между специалистами.",
    specialist: "Специалист снабжения",
    workload: (count: number) => count ? `в работе: ${count}` : "свободен",
    assignSelected: (count: number) => `Назначить (${count})`,
    saving: "Сохраняем…",
    actionFailed: "Не удалось сохранить назначение. Обновите страницу и повторите попытку.",
  }
  if (lang === "tr") return {
    title: "Kalemleri dağıt",
    description: "Ürünleri seçip sorumlu satın alma uzmanına atayın. Atanan kalemler listeden gizlenir.",
    progress: (assigned: number, total: number) => `${assigned}/${total} atandı`,
    selectPositions: "Atanacak kalemler",
    selectPosition: "Kalemi seç",
    quantity: "Satın alınacak",
    unassigned: "Atanmadı",
    splitOrders: "Bölünmüş siparişler",
    submitted: "Gönderildi",
    assignedItems: (count: number) => `${count} kalem`,
    allAssigned: "Tüm kalemler uzmanlara atandı.",
    specialist: "Satın alma uzmanı",
    workload: (count: number) => count ? `aktif: ${count}` : "müsait",
    assignSelected: (count: number) => `Ata (${count})`,
    saving: "Kaydediliyor…",
    actionFailed: "Atama kaydedilemedi. Sayfayı yenileyip tekrar deneyin.",
  }
  return {
    title: "Pozitsiyalarini taqsimlash",
    description: "Productlarni belgilang va mas’ul ta’minotchiga biriktiring. Biriktirilgan productlar ro‘yxatdan yashiriladi.",
    progress: (assigned: number, total: number) => `${assigned}/${total} biriktirilgan`,
    selectPositions: "Biriktiriladigan pozitsiyalar",
    selectPosition: "Pozitsiyani tanlash",
    quantity: "Xarid miqdori",
    unassigned: "Biriktirilmagan",
    splitOrders: "Bo‘lingan buyurtmalar",
    submitted: "Yuborilgan",
    assignedItems: (count: number) => `${count} ta product`,
    allAssigned: "Barcha productlar ta’minotchilarga biriktirilgan.",
    specialist: "Ta’minotchi",
    workload: (count: number) => count ? `faol: ${count}` : "bo‘sh",
    assignSelected: (count: number) => `Biriktirish (${count})`,
    saving: "Saqlanmoqda…",
    actionFailed: "Biriktirish saqlanmadi. Sahifani yangilab, qayta urinib ko‘ring.",
  }
}
