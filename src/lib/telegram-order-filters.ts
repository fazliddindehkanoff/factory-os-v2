import type { TelegramOrderSummary } from "@/lib/telegram-orders"

export type TelegramOrderFilterValues = {
  q: string
  type: string
  status: string
  urgency: string
  department: string
  warehouse: string
}

export function matchesTelegramOrderFilters(order: TelegramOrderSummary, values: TelegramOrderFilterValues, waitingOnly: boolean, locale: string) {
  const query = values.q.trim().toLocaleLowerCase(locale)
  const searchable = [order.number, order.applicant, order.department, order.warehouse, order.purpose]
    .join(" ")
    .toLocaleLowerCase(locale)
  return (!waitingOnly || order.waitingForMe)
    && (!query || searchable.includes(query))
    && (!values.type || order.type === values.type)
    && (!values.status || order.status === values.status)
    && (!values.urgency || (values.urgency === "urgent-group"
      ? order.urgency === "urgent" || order.urgency === "critical"
      : order.urgency === values.urgency))
    && (!values.department || order.department === values.department)
    && (!values.warehouse || order.warehouse === values.warehouse)
}
