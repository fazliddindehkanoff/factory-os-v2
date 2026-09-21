import type { Locale } from "@/lib/i18n"
import type { OrderRecord } from "@/lib/orders"

export function stepLabel(step: OrderRecord["currentStep"], lang: Locale) {
  const labels = {
    uz: {
      department_supervisor: "Bo‘lim rahbari",
      warehouse: "Ombor nazorati",
      chief_engineer: "Bosh muhandis",
      procurement_accept: "Ta’minot rahbari — qabul qilish",
      sourcing: "Ta’minotchi — qidiruv",
      price_check: "Ta’minot rahbari — narx tekshiruvi",
      director: "Direktor",
      procurement_order: "Ta’minotchi — buyurtmani rasmiylashtirish",
      procurement_supervisor: "Ta’minot rahbari — buyurtmani tasdiqlash",
      warehouse_receipt: "Ombor — qabul qilish",
      warehouse_supervisor: "Ombor rahbari — qabulni tasdiqlash",
      complete: "Yakunlangan",
    },
    ru: {
      department_supervisor: "Руководитель отдела",
      warehouse: "Контроль склада",
      chief_engineer: "Главный инженер",
      procurement_accept: "Руководитель снабжения — приём заявки",
      sourcing: "Снабженец — поиск",
      price_check: "Руководитель снабжения — проверка цены",
      director: "Директор",
      procurement_order: "Снабженец — оформление заказа",
      procurement_supervisor: "Руководитель снабжения — подтверждение заказа",
      warehouse_receipt: "Склад — приёмка",
      warehouse_supervisor: "Руководитель склада — подтверждение приёмки",
      complete: "Завершено",
    },
    tr: {
      department_supervisor: "Bölüm yöneticisi",
      warehouse: "Depo kontrolü",
      chief_engineer: "Baş mühendis",
      procurement_accept: "Satın alma yöneticisi — talep kabulü",
      sourcing: "Satın almacı — tedarik araması",
      price_check: "Satın alma yöneticisi — fiyat kontrolü",
      director: "Direktör",
      procurement_order: "Satın alma uzmanı — sipariş oluşturma",
      procurement_supervisor: "Satın alma yöneticisi — sipariş onayı",
      warehouse_receipt: "Depo — mal kabul",
      warehouse_supervisor: "Depo yöneticisi — kabul onayı",
      complete: "Tamamlandı",
    },
  } as const;
  return labels[lang][step];
}
