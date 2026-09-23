import type { Locale } from "@/lib/i18n"
import type { FlowStep } from "@/lib/dashboard-insights"

type DashboardCopy = {
  greeting: (hour: number) => string
  queueTitle: string
  queueEmptyTitle: string
  queueEmptyBody: string
  queueMore: (count: number) => string
  open: string
  waitingDays: (days: number) => string
  late: string
  activeOrders: string
  lateOrders: string
  urgentOrders: string
  trendTitle: string
  trendCreated: string
  trendClosed: string
  trendHint: string
  flowTitle: string
  flowDescription: string
  flowEmpty: string
  bottleneck: string
  avgWaitLegend: string
  orders: string
  positions: string
  stageOrders: string
  stageEmpty: string
  holder: string
  lateTitle: string
  lateDescription: string
  lateEmpty: string
  daysLate: (days: number) => string
  teamTitle: string
  teamDescription: string
  teamSourcing: string
  teamPlacing: string
  teamSubmitted: string
  teamEmpty: string
  moneyTitle: string
  moneyDescription: string
  placedThisMonth: string
  advances: string
  upcomingBalances: string
  noUpcoming: string
  openFinance: string
  steps: Record<FlowStep, string>
  unassigned: string
}

const days = {
  uz: (value: number) => `${value} kun`,
  ru: (value: number) => `${value} дн.`,
  tr: (value: number) => `${value} gün`,
}

export const dashboardCopy: Record<Locale, DashboardCopy> = {
  uz: {
    greeting: (hour) => hour < 5 ? "Xayrli tun" : hour < 12 ? "Xayrli tong" : hour < 18 ? "Xayrli kun" : "Xayrli kech",
    queueTitle: "Sizni kutmoqda",
    queueEmptyTitle: "Hammasi bajarildi",
    queueEmptyBody: "Hozircha sizning amalingizni kutayotgan buyurtma yo‘q.",
    queueMore: (count) => `Yana ${count} ta — hammasini ko‘rish`,
    open: "Ochish",
    waitingDays: (value) => value < 1 ? "bugun" : `${days.uz(Math.floor(value))} kutmoqda`,
    late: "Muddati o‘tgan",
    activeOrders: "Faol buyurtmalar",
    lateOrders: "Kechikayotgan",
    urgentOrders: "Shoshilinch",
    trendTitle: "14 kunlik oqim",
    trendCreated: "Yangi",
    trendClosed: "Yopilgan",
    trendHint: "Kunlik yangi va yopilgan buyurtmalar",
    flowTitle: "Jarayon xaritasi",
    flowDescription: "Buyurtmalar qaysi bosqichda va qancha vaqtdan beri turibdi. Bosqichni bosing.",
    flowEmpty: "Faol buyurtmalar yo‘q — jarayon bo‘sh.",
    bottleneck: "Tor joy",
    avgWaitLegend: "O‘rtacha kutish:",
    orders: "buyurtma",
    positions: "pozitsiya",
    stageOrders: "Bu bosqichdagi buyurtmalar",
    stageEmpty: "Bu bosqichda buyurtma yo‘q.",
    holder: "Kimda",
    lateTitle: "Kechikayotgan buyurtmalar",
    lateDescription: "Kutilgan sana o‘tgan, lekin hali yopilmagan.",
    lateEmpty: "Kechikayotgan buyurtma yo‘q.",
    daysLate: (value) => `+${days.uz(value)}`,
    teamTitle: "Ta’minot jamoasi yuklamasi",
    teamDescription: "Ochiq pozitsiyalar va oxirgi 30 kunda yuborilgan takliflar.",
    teamSourcing: "Qidiruvda",
    teamPlacing: "Rasmiylashtirishda",
    teamSubmitted: "30 kunda yuborgan",
    teamEmpty: "Ta’minotchilar topilmadi.",
    moneyTitle: "Xarajatlar va muddatlar",
    moneyDescription: "Joylashtirilgan buyurtmalardagi kelishilgan shartlar bo‘yicha.",
    placedThisMonth: "Shu oy joylashtirildi",
    advances: "Kelishilgan avanslar",
    upcomingBalances: "14 kun ichidagi qoldiq to‘lovlar",
    noUpcoming: "Yaqin 14 kunda qoldiq to‘lov muddati yo‘q.",
    openFinance: "Moliya bo‘limi",
    steps: {
      department_supervisor: "Bo‘lim rahbari",
      warehouse: "Ombor tekshiruvi",
      chief_engineer: "Bosh muhandis",
      procurement_accept: "Ta’minotga qabul",
      sourcing: "Postavshik qidiruvi",
      price_check: "Narx tekshiruvi",
      director: "Direktor",
      procurement_order: "Rasmiylashtirish",
      warehouse_receipt: "Omborga qabul",
    },
    unassigned: "Belgilanmagan",
  },
  ru: {
    greeting: (hour) => hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер",
    queueTitle: "Ожидает вас",
    queueEmptyTitle: "Всё сделано",
    queueEmptyBody: "Сейчас нет заявок, ожидающих вашего действия.",
    queueMore: (count) => `Ещё ${count} — показать все`,
    open: "Открыть",
    waitingDays: (value) => value < 1 ? "сегодня" : `ждёт ${days.ru(Math.floor(value))}`,
    late: "Просрочено",
    activeOrders: "Активные заявки",
    lateOrders: "Просроченные",
    urgentOrders: "Срочные",
    trendTitle: "Поток за 14 дней",
    trendCreated: "Новые",
    trendClosed: "Закрытые",
    trendHint: "Новые и закрытые заявки по дням",
    flowTitle: "Карта процесса",
    flowDescription: "На каком этапе заявки и как долго они там находятся. Нажмите на этап.",
    flowEmpty: "Активных заявок нет — процесс свободен.",
    bottleneck: "Узкое место",
    avgWaitLegend: "Среднее ожидание:",
    orders: "заявок",
    positions: "позиций",
    stageOrders: "Заявки на этом этапе",
    stageEmpty: "На этом этапе заявок нет.",
    holder: "У кого",
    lateTitle: "Просроченные заявки",
    lateDescription: "Ожидаемая дата прошла, но заявка не закрыта.",
    lateEmpty: "Просроченных заявок нет.",
    daysLate: (value) => `+${days.ru(value)}`,
    teamTitle: "Загрузка снабжения",
    teamDescription: "Открытые позиции и отправленные предложения за 30 дней.",
    teamSourcing: "В поиске",
    teamPlacing: "В оформлении",
    teamSubmitted: "Отправлено за 30 дн.",
    teamEmpty: "Снабженцы не найдены.",
    moneyTitle: "Расходы и сроки",
    moneyDescription: "По согласованным условиям размещённых заказов.",
    placedThisMonth: "Размещено в этом месяце",
    advances: "Согласованные авансы",
    upcomingBalances: "Остатки к оплате за 14 дней",
    noUpcoming: "В ближайшие 14 дней сроков оплаты остатка нет.",
    openFinance: "Финансы",
    steps: {
      department_supervisor: "Руководитель отдела",
      warehouse: "Проверка склада",
      chief_engineer: "Главный инженер",
      procurement_accept: "Приём снабжением",
      sourcing: "Поиск поставщика",
      price_check: "Проверка цены",
      director: "Директор",
      procurement_order: "Оформление",
      warehouse_receipt: "Приёмка на склад",
    },
    unassigned: "Не назначен",
  },
  tr: {
    greeting: (hour) => hour < 5 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar",
    queueTitle: "Sizi bekliyor",
    queueEmptyTitle: "Her şey tamam",
    queueEmptyBody: "Şu anda işleminizi bekleyen talep yok.",
    queueMore: (count) => `${count} tane daha — tümünü gör`,
    open: "Aç",
    waitingDays: (value) => value < 1 ? "bugün" : `${days.tr(Math.floor(value))} bekliyor`,
    late: "Gecikmiş",
    activeOrders: "Aktif talepler",
    lateOrders: "Gecikenler",
    urgentOrders: "Acil",
    trendTitle: "14 günlük akış",
    trendCreated: "Yeni",
    trendClosed: "Kapanan",
    trendHint: "Günlük yeni ve kapanan talepler",
    flowTitle: "Süreç haritası",
    flowDescription: "Talepler hangi aşamada ve ne kadar süredir bekliyor. Bir aşamaya tıklayın.",
    flowEmpty: "Aktif talep yok — süreç boş.",
    bottleneck: "Darboğaz",
    avgWaitLegend: "Ortalama bekleme:",
    orders: "talep",
    positions: "kalem",
    stageOrders: "Bu aşamadaki talepler",
    stageEmpty: "Bu aşamada talep yok.",
    holder: "Kimde",
    lateTitle: "Geciken talepler",
    lateDescription: "Beklenen tarih geçti ama talep kapanmadı.",
    lateEmpty: "Geciken talep yok.",
    daysLate: (value) => `+${days.tr(value)}`,
    teamTitle: "Satın alma ekibi yükü",
    teamDescription: "Açık kalemler ve son 30 günde gönderilen teklifler.",
    teamSourcing: "Aramada",
    teamPlacing: "Siparişte",
    teamSubmitted: "30 günde gönderilen",
    teamEmpty: "Satın alma uzmanı bulunamadı.",
    moneyTitle: "Harcamalar ve vadeler",
    moneyDescription: "Verilen siparişlerde kararlaştırılan koşullara göre.",
    placedThisMonth: "Bu ay verilen siparişler",
    advances: "Kararlaştırılan avanslar",
    upcomingBalances: "14 gün içindeki bakiye ödemeleri",
    noUpcoming: "Önümüzdeki 14 günde bakiye vadesi yok.",
    openFinance: "Finans",
    steps: {
      department_supervisor: "Bölüm yöneticisi",
      warehouse: "Depo kontrolü",
      chief_engineer: "Baş mühendis",
      procurement_accept: "Satın alma kabulü",
      sourcing: "Tedarikçi arama",
      price_check: "Fiyat kontrolü",
      director: "Direktör",
      procurement_order: "Sipariş işlemleri",
      warehouse_receipt: "Depo kabulü",
    },
    unassigned: "Atanmamış",
  },
}
