Method: dual-agent (A: /root/design_review · B: /root/technical_evidence), yakuniy oqim/kod tahlili: /root.

# Factory OS — web, mobil va Telegram UX/UI auditi

Sana: 2026-09-22. Kod versiyasi: `66a659e`. Maqsad: foydalanuvchi oqimidagi uzilishlar, noto‘g‘ri va’dalar, saqlash, navigatsiya, mobil qulaylik va foydalanish imkoniyatlarini tekshirish. Ilova kodi o‘zgartirilmadi.

**Asosiy xulosa:** interfeysning tashqi tuzilishi tushunarli, lekin ayrim asosiy amallar serverdagi haqiqiy holat bilan mos kelmaydi. Telegram buyurtma oqimi ish talab qiladi, ammo bajarish yoki webga davom ettirish yo‘lini bermaydi. Avval shu funksional uzilishlar, keyin mobil va vizual yaxshilashlar bajarilishi kerak.

## Qamrov va dalil chegaralari

- Lokal Next.js sayt ochildi; README demo hisobi bilan autentifikatsiya bajarildi. Desktop ko‘rinish hamda 390×844 mobil viewport tekshirildi.
- Jonli tekshiruv: kirish, dashboard, buyurtmalar ro‘yxati, yangi buyurtmaning dastlabki ikki bosqichi/validatsiyasi, Telegram buyurtmalar/filtrlar, moliya, profil/sozlamalar va Telegram bootstrap xato holati.
- Kod tahlili: yuqoridagilarga qo‘shimcha buyurtma detali, rad etishdan keyingi qayta yuborish, o‘chirish, fayllar, xarid/yetkazib beruvchi, xabarlar, ruxsatlar va API bog‘lanishlari.
- Lokal `app_records` jadvalida buyurtmalar va to‘lovlar yo‘q. Shu sabab mavjud buyurtmaning to‘liq tasdiqlash/xarid/to‘lov zanjiri va turli rollar bilan ishlash jonli bajarilmadi. Bunday topilmalar quyida **Kod** deb belgilangan.
- Telegram ekranlari oddiy brauzerda ochildi. Haqiqiy Telegram iOS/Android klienti, haqiqiy `initData`, klaviatura/fullscreen/native back va tarmoq uzilishi sinovi bajarilmadi. **Kodda SDK integratsiyasi yo‘qligi Telegram klientida nosozlik qayta ko‘rsatildi degani emas.**
- Biznes yozuvlari yaratilmagan/o‘zgartirilmagan; buyurtma yuborish, xabar jo‘natish, to‘lov tasdiqlash yoki amalga oshirish bajarilmagan. Mobil draft yo‘qolishini tekshirish uchun yuborilmagan vaqtinchalik izoh kiritilib, reload bilan olib tashlangan.
- `npm test`: **88/88 o‘tdi**. Bu mavjud birlik testlari; UI oqimlari, serverga qayta saqlash va haqiqiy qurilma sinovlari o‘rnini bosmaydi.

**Dalillar:** Jonli = brauzerda kuzatilgan; Kod = chaqiruvlar va ma’lumot oqimi orqali tasdiqlangan; QA = real qurilma yoki to‘ldirilgan test bazasi bilan tekshirish qolgan.

## Baholash

Mustaqil vizual baho A: **22/40**. Quyidagi yakuniy **18/40** baho ota-agent aniqlagan saqlash va platformalararo uzilishlarni ham hisobga oladi. Bu ekspertning evristik bahosi, avtomatik test yoki WCAG sertifikati emas.

| Mezon | /4 | Asos |
|---|---:|---|
| Tizim holatining aniqligi | 1 | Lokal muvaffaqiyat server holatini bildirmaydi; eskirgan ma’lumot sezilmaydi |
| Ish jarayoniga moslik | 3 | Ombor/xarid/to‘lov atamalari foydali; Telegram bosqichlari soddalashtirib yuborilgan |
| Foydalanuvchi nazorati | 1 | Draft yo‘qoladi; qayta yuborish/o‘chirish ishonchsiz |
| Izchillik | 1 | Web va Telegram amal, ruxsat, holat va xabar qoidalari farq qiladi |
| Xatoni oldini olish | 2 | Yakuniy ko‘rib chiqish bor; draft va noto‘g‘ri muvaffaqiyat muammolari bor |
| Eslab qolishsiz tushunish | 3 | Menyu nomlari va wizard bosqichlari tushunarli |
| Tezlik va samaradorlik | 2 | Guruhli amallar/qidiruv bor; filtr va detal konteksti yo‘qoladi |
| Vizual tartib va soddalik | 3 | Asosiy layout tartibli; bo‘sh ekranlar ortiqcha joy oladi |
| Xatodan tiklanish | 1 | Telegram retry yo‘q; forma xatosi aniq maydonni ko‘rsatmaydi |
| Yordam va yo‘l-yo‘riq | 1 | Ayrim izohlar bor, lekin murakkab holatda keyingi qadam aniq emas |
| **Jami** | **18/40** | **Asosiy oqimlarni mustahkamlash kerak** |

**24 ta topilma: 1 ta P0, 13 ta P1, 10 ta P2.** P0 — darhol yopiladigan xavf; P1 — ish jarayoni/ishonchni sezilarli buzadi; P2 — noqulaylik yoki aylanma yo‘li mavjud izchillik muammosi. Haqiqiy qurilma QA savollari bu songa kiritilmadi.

## Kritik topilma

### 01 — P0: telefon raqamining o‘zi bilan hisobga kirish [Kod]

`/api/telegram/test-access` faol foydalanuvchini telefon orqali topib, parol, Telegram imzosi yoki joriy sessiyani tekshirmasdan `createSession()` chaqiradi. Development-only himoya ham yo‘q. Oddiy Telegram sahifasi ham `phone` parametri bilan shu endpointga yo‘naltiradi.

Dalil: [test-access/route.ts](/Users/macbookpro/Projects/factory-os-v2/src/app/api/telegram/test-access/route.ts:13), [Telegram page](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/page.tsx:11).

**Ta’siri:** endpoint shu holatda ommaga deploy qilingan bo‘lsa, ma’lum telefon raqami boshqa odam hisobiga kirish uchun yetarli. Production mavjudligi tekshirilmadi va endpoint orqali hisob almashtirish bajarilmadi.

**Tuzatish/mezon:** productiondan olib tashlash yoki qat’iy server muhiti cheklovi; ommaviy muhitda autentifikatsiyasiz so‘rov sessiya cookie yaratmasin. Mini App uchun tekshirilgan Telegram autentifikatsiya yo‘li ishlasin.

## Ish jarayoni va saqlash

### 02 — P1: rad etilgan buyurtma qayta yuborilganda serverga saqlanmaydi [Kod]

`resubmitOrder()` faqat React holatini almashtiradi, so‘ng yangi amal haqida xabar yuboradi. Wizard muvaffaqiyat ekranini ko‘rsatadi. Keyingi 30 soniyalik refresh serverdagi eski rad etilgan yozuvni qaytaradi; boshqa foydalanuvchi yangilanishni ko‘rmaydi.

Dalil: [orders-provider.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/orders-provider.tsx:381), ayniqsa 441-qator; [order-wizard.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/order-wizard.tsx:415).

**Tuzatish/mezon:** qayta yuborish server workflow amali bo‘lsin; saqlashdan keyin muvaffaqiyat va xabar berilsin. Reload va ikkinchi hisob bir xil yangi holatni ko‘rsatsin.

### 03 — P1: buyurtmani o‘chirish faqat shu brauzer holatida ishlaydi [Kod]

Tasdiqlash dialogidan keyin `deleteOrders()` faqat `setOrders()` bajaradi. Server o‘chirish amali yo‘q. Navbatdagi refresh o‘chirilgan buyurtmani qaytaradi.

Dalil: [orders-provider.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/orders-provider.tsx:672), [orders-list.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/orders-list.tsx:624).

**Tuzatish/mezon:** biznes qoidaga mos server arxivlash/o‘chirish amali va xato qaytarish; reload/ikkinchi sessiyada natija saqlansin. Audit tarixi bor buyurtmalar uchun o‘chirish huquqi alohida ko‘rib chiqilsin.

### 04 — P1: oddiy buyurtma ilovalari boshqa qurilmada ochilmaydi [Kod]

Wizard faylning o‘zini faqat brauzer IndexedDB bazasiga saqlaydi; server buyurtmasiga id/nom/tur/o‘lcham metadata ketadi. Download ham shu IndexedDBdan o‘qiydi. Omborchi, rahbar yoki boshqa qurilma faylni topa olmaydi. **Bu topilma buyurtma ilovalariga tegishli; moliyadagi shartnoma fayllarining alohida server endpointi bor.**

Dalil: [order-attachments.ts](/Users/macbookpro/Projects/factory-os-v2/src/lib/order-attachments.ts:28), [download](/Users/macbookpro/Projects/factory-os-v2/src/lib/order-attachments.ts:68).

**Tuzatish/mezon:** ruxsat bilan server/object storage upload-download; ikkinchi browser profilida ayni fayl ochilsin. Yuklash progressi, hajm cheklovi va retry ko‘rsatilsin.

### 05 — P1: yetkazib beruvchini tahrirlash/arxivlash serverga ketmaydi [Kod]

Yaratish APIga yuboriladi, lekin `updateSupplier()` va `archiveSupplier()` faqat lokal holatni o‘zgartiradi. Server yozuvi mavjud supplier uchun keyingi refresh eski qiymatni ustidan yozadi. Dialog esa darhol yopiladi.

Dalil: [procurement-provider.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/procurement/procurement-provider.tsx:239), [suppliers-workspace.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/procurement/suppliers-workspace.tsx:143).

**Tuzatish/mezon:** PATCH/archive server amallari, pending/error/success; reload va ikkinchi hisobda yangilangan supplier saqlansin.

### 06 — P1: Telegram “Amal kerak” deydi, lekin buyurtma amalini bajartirmaydi [Kod + navigatsiya jonli]

Karta va “Kutilmoqda” bo‘limi ish talab qilinishini ko‘rsatadi. Buyurtma detali faqat ma’lumot/izohlarni o‘qishga beradi: tasdiqlash, rad etish, ombor hisoboti yoki izohga javob yo‘q; webda davom ettirish havolasi ham yo‘q. Moliya esa Telegram ichida amallarni taklif qiladi — imkoniyat chegarasi izchil emas.

Dalil: [telegram-order-card.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/telegram/telegram-order-card.tsx:49), [Telegram detail](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/orders/[id]/page.tsx:59).

**Tuzatish/mezon:** tegishli rolning amali detailda mavjud bo‘lsin yoki buyurtmani saqlangan kontekst bilan webda ochadigan aniq tugma berilsin. Read-only mahsulot qarori bo‘lsa ham “Amal kerak”dan keyin bajarish yo‘li tushuntirilsin. Mention orqali kelgan odam javob berish yo‘lini topsin.

### 07 — P1: bir hisob web va Telegramda turli buyurtmalarni ko‘rishi mumkin [Kod]

Web provider bo‘lim rahbarini o‘z bo‘limlariga cheklaydi va rad etilgan buyurtmalar uchun alohida ko‘rinish qoidasini ishlatadi. Telegram querysida bu cheklovlar yo‘q. `view_own` webda yaratuvchi bo‘yicha, Telegramda arizachi/yaratuvchi/record egasi bo‘yicha ishlaydi. Xaridchi+rahbar qo‘shma rolida ham istisno faqat Telegram/server tomonida bor.

Dalil: [web canViewOrder](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/orders-provider.tsx:78), [Telegram query](/Users/macbookpro/Projects/factory-os-v2/src/lib/telegram-orders.ts:189), [API GET](/Users/macbookpro/Projects/factory-os-v2/src/app/api/app-records/[namespace]/route.ts:45).

**Ta’siri:** “buyurtmam yo‘qoldi” hissi, noto‘g‘ri sonlar va ortiqcha ko‘rinish xavfi. **Tuzatish/mezon:** yagona server access policy; yaratuvchi/arizachi/bo‘lim rahbari/xaridchi/qo‘shma rol bo‘yicha web va Telegram ro‘yxatlari bir xil bo‘lsin.

### 08 — P1: Telegram holati haqiqiy jarayon bosqichini yo‘qotadi [Kod]

`supervisor_review`, `warehouse_check`, `in_progress` barchasi `in_review` bo‘ladi. Karta va detail progressi haqiqiy workflowdan emas, doimiy 56%/100% qiymatlardan olinadi. `revision_requested` filtrda bor, lekin mapper bu qiymatni hech qachon chiqarmaydi. Foydalanuvchi kimda kutayotganini va qancha ish qolganini bilmaydi.

Dalil: [telegram-orders.ts](/Users/macbookpro/Projects/factory-os-v2/src/lib/telegram-orders.ts:103), [status visual](/Users/macbookpro/Projects/factory-os-v2/src/components/telegram/telegram-order-card.tsx:11).

**Tuzatish/mezon:** shared status/step taqdimoti, mas’ul va keyingi amal; hisoblanmaydigan foizni olib tashlash. Qisman xarid/ombor holatida real tugallangan va qolgan pozitsiyalar ajratilsin.

### 09 — P1: mobil va web buyurtma qoralamasi reload bilan yo‘qoladi [Jonli + Kod]

Repro: yangi buyurtma → 2-bosqich → umumiy izoh kiritish → reload → 1-bosqich; qayta 2-bosqichga o‘tilsa izoh bo‘sh. Ogohlantirish yo‘q. Draft faqat `useState`da.

Dalil: [order-wizard.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/order-wizard.tsx:202).

**Tuzatish/mezon:** hisobga bog‘langan autosave, tiklash va “Qoralama saqlandi”; saqlanmagan fayl va navigatsiya uchun tushunarli ogohlantirish. Reload va vaqtinchalik boshqa bo‘limga o‘tishdan keyin draft/step tiklansin.

### 10 — P1: yuklash xatosi eskirgan yoki bo‘sh ma’lumot sifatida yashirinadi [Kod]

Orders/procurement refresh xatolari yutiladi; `storageReady` serverdan muvaffaqiyatli yuklandi degani emas. Dashboard “Hozirgina yangilandi” matnini muvaffaqiyatli so‘rov vaqtiga bog‘lamay ko‘rsatadi. Tarmoq uzilganda operator eski holatga ishonishi mumkin.

Dalil: [orders-provider.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/orders-provider.tsx:178), [procurement-provider.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/procurement/procurement-provider.tsx:156), [dashboard](/Users/macbookpro/Projects/factory-os-v2/src/components/dashboard/dashboard-overview.tsx:202).

**Tuzatish/mezon:** loading/empty/error/stale holatlari alohida; oxirgi muvaffaqiyatli sinxron vaqt va retry. 401 bo‘lsa qayta kirish yo‘li. Serverni uzganda ekran “ma’lumot yo‘q” yoki “hozir yangilandi” deb aldamasin.

### 11 — P1: Telegram kirish xatosi tiklanish yo‘lini bermaydi [Jonli + Kod]

Oddiy browserda bootstrap taxminan 3 soniyadan keyin faqat botga qaytib telefonni tasdiqlashni aytadi. Retry, botga havola yoki browser login yo‘q. Kod 401/403/503 va tarmoq xatosini ham shu bitta xabarga aylantiradi; fetch timeout ham yo‘q. Oddiy browserda `initData` bo‘lmasligi tabiiy, muammo — xatoning izohi va tiklanish UXida.

Dalil: [telegram-bootstrap.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/telegram/telegram-bootstrap.tsx:38), [auth route](/Users/macbookpro/Projects/factory-os-v2/src/app/api/telegram/auth/route.ts:14).

**Tuzatish/mezon:** Telegram tashqarisida ochish, ulanmagan hisob, eskirgan auth va vaqtinchalik tarmoq xatosi alohida; mos Retry/Botni ochish/Kirish tugmalari; dastlabki order/comment manzili saqlansin.

### 12 — P1: tashkilot almashtirish haqiqiy ish kontekstini almashtirmaydi [Jonli label + Kod]

Acme Inc/Acme Corp/Evil Corp hardcode qilingan. Tanlash faqat sarlavhani o‘zgartiradi, “Jamoa qo‘shish” handleri yo‘q, ko‘rsatilgan ⌘1/2/3 uchun ham amal yo‘q. Operator boshqa korxonaga o‘tdim deb o‘ylashi mumkin.

Dalil: [app-sidebar.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/app-sidebar.tsx:59), [team-switcher.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/team-switcher.tsx:37).

**Tuzatish/mezon:** haqiqiy korxona nomi; funksional context switching bo‘lmasa statik identifikator. Har bir ko‘rinadigan amal ishlasin yoki umuman ko‘rsatilmasin.

### 13 — P1: ayrim form maydonlarining dasturiy nomi yo‘q [Kod + AX]

Supplier dialogida `Label` yonma-yon turadi, lekin `htmlFor`/input `id` bog‘lanishi yo‘q. Buyurtma qidiruvi ham faqat placeholderga tayanadi; browser AXda tushunarli nom o‘rniga texnik id ko‘rindi. Ekran o‘quvchi foydalanuvchi nima kiritishni aniq bilmaydi.

Dalil: [SupplierField](/Users/macbookpro/Projects/factory-os-v2/src/components/procurement/suppliers-workspace.tsx:184), [order search](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/orders-list.tsx:358).

**Tuzatish/mezon:** har bir control uchun `id/htmlFor` yoki mos `aria-label`; xatoga `aria-describedby`. Accessibility tree va klaviatura tekshiruvida maqsad aniq e’lon qilinsin. Tegishli mezonlar: WCAG 1.3.1/4.1.2; butun sayt bo‘yicha sertifikat auditi bajarilmagan.

## Izchillik, mobil va qo‘shimcha oqimlar

### 14 — P2: bildirishnomalarning “o‘qilgan” holati platformalar orasida mos emas [Kod]

Webda qo‘ng‘iroqni bosish barcha xabarlarni o‘qilgan qiladi; Telegram ro‘yxati/detail havolasi esa umuman o‘qilgan holatni yozmaydi. Barcha xabarlarni ko‘rmasdan belgi yo‘qolishi yoki Telegramda doim qolishi mumkin.

Dalil: [header](/Users/macbookpro/Projects/factory-os-v2/src/components/dashboard-header-actions.tsx:94), [Telegram notifications](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/notifications/page.tsx:40), [PATCH](/Users/macbookpro/Projects/factory-os-v2/src/app/api/notifications/route.ts:48).

**Tuzatish/mezon:** ochilgan xabarni alohida o‘qilgan qilish, foydalanuvchi tanlaydigan “Hammasini o‘qildi”; ikkala platformada badge bir xil bo‘lsin. 100 ta limit tufayli hisob barcha tarixni emas, oxirgi 100 yozuvni ifodalayotgani ham aniqlashtirilsin.

### 15 — P2: til almashtirganda ish konteksti yo‘qoladi [Kod]

Web `changeLanguage` faqat pathname yuboradi: `?view=waiting`, `?order=...` va comment hash tushib qoladi. Telegram URLni saqlaydi, lekin department/warehouse filtr qiymatlari ID emas, tarjima qilingan nom; boshqa tilga o‘tganda server ularni yaroqsiz deb tozalashi mumkin.

Dalil: [web language](/Users/macbookpro/Projects/factory-os-v2/src/components/dashboard-header-actions.tsx:41), [Telegram filter validation](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/orders/page.tsx:42).

**Tuzatish/mezon:** query/hash saqlansin; filtrlar barqaror ID bilan ishlasin. Tanlangan buyurtma/kutish rejimi va ombor filtri UZ→RU→TR o‘tishda o‘zgarmasin.

### 16 — P2: mobil web va Telegram moliyasida tugmalar juda ixcham [Jonli o‘lchov + Kod]

390×844da sidebar 28×28, xabar/delete-line 32×32, wizard back/next va sana/miqdor inputlari 32px. Telegramning boshqa ekranlarida 44–48px. Bu 44px qulaylik maqsadiga mos emas; **24pxdan katta bo‘lgani uchun avtomatik WCAG 2.2 AA target-size buzilishi deb baholanmadi.**

Dalil: [button.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/ui/button.tsx:23), [input.tsx](/Users/macbookpro/Projects/factory-os-v2/src/components/ui/input.tsx:33), [finance actions](/Users/macbookpro/Projects/factory-os-v2/src/components/finance/finance-workspace.tsx:55).

**Tuzatish/mezon:** coarse-pointer/mobile variantda 44pxdan kam bo‘lmagan hit area; qator amallari ham shu qoida bilan ishlasin.

### 17 — P2: wizard xatosi qaysi maydonni tuzatish kerakligini aytmaydi [Jonli + Kod]

2-bosqichda maqsad/sana/tovar bo‘sh bo‘lsa, faqat umumiy “Kamida bitta to‘liq buyurtma pozitsiyasini kiriting” pastda chiqadi. Invalid maydon belgisi/fokus/scroll yo‘q. Mavjud noto‘liq qatorni tuzatish o‘rniga yangi qator qo‘shishga undashi mumkin. Yangi buyurtmani yuborish xatosida ham qayta yuborishga oid matn ishlatiladi.

Dalil: [validation](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/order-wizard.tsx:364), [alert](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/order-wizard.tsx:756), [publish catch](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/order-wizard.tsx:420).

**Tuzatish/mezon:** maydon/qator bo‘yicha xato, birinchi invalidga fokus; yaratish va qayta yuborish xabarlari ajratilsin. Kiritilgan ma’lumot xatoda saqlansin.

### 18 — P1: Telegram navigatsiyasi va dark reply kontrasti yetarli emas [Jonli DOM + Kod]

Bottom nav yozuvi 10px: `#8b97aa` oq fonda taxminan 2.96:1, aktiv `#2d7dd2` taxminan 4.22:1. Kichik matn uchun 4.5:1ga yetmaydi. Dark rejimdagi reply bloki esa qattiq yozilgan och `#edf4fc` fonda och `#c1cada` matn ishlatadi (~1.49:1); bu populated comment holati koddan aniqlangan, jonli ochilmagan.

Dalil: [bottom-nav](/Users/macbookpro/Projects/factory-os-v2/src/components/telegram/telegram-bottom-nav.tsx:37), [reply block](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/orders/[id]/page.tsx:176), [theme tokens](/Users/macbookpro/Projects/factory-os-v2/src/app/globals.css).

**Tuzatish/mezon:** theme tokenli matn/fon, kichik matnda kamida 4.5:1; nav label kattaligini oshirish va aktiv holat indikatorini qo‘shish. WCAG 1.4.3.

### 19 — P2: Telegram buyurtma holati ochiq ekranda yangilanmaydi [Kod]

Buyurtma ro‘yxati/detali va xabarlar server renderdan olinadi. OrdersProvider web ma’lumotini yangilasa ham, bu server komponent propslarini yangilamaydi. Telegram uchun focus/polling refresh yoki “Yangilash” yo‘q; moliyada bor.

Dalil: [Telegram orders](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/orders/page.tsx:29), [Telegram shell](/Users/macbookpro/Projects/factory-os-v2/src/components/telegram/telegram-shell.tsx:25), [bridge](/Users/macbookpro/Projects/factory-os-v2/src/components/telegram/telegram-web-app-bridge.tsx:9).

**Tuzatish/mezon:** resume/focus yangilash yoki cheklangan polling va qo‘lda refresh; oxirgi sinxron vaqt. Ikkinchi operator holatni o‘zgartirganda ochiq Telegram ekraniga qaytganda yangilansin.

### 20 — P2: dashboard taqsimoti barcha holatlarni hisobga olmaydi [Kod]

“Buyurtmalar jarayoni”da faqat warehouse_check/approved/rejected/draft bor. supervisor_review/in_progress/fulfilled taqsimotda yo‘q. Masalan, hamma buyurtma xaridda bo‘lsa jami son bor, diagrammada esa 0 bo‘lishi mumkin. Ombor “ish yuki” yopilgan buyurtmalarni ham sanaydi.

Dalil: [pipeline/workload](/Users/macbookpro/Projects/factory-os-v2/src/components/dashboard/dashboard-overview.tsx:80).

**Tuzatish/mezon:** barcha joriy holatlarni ajratish yoki aniq guruhlash; jami bilan yig‘indi mosligi. “Ish yuki” faqat faol ishni ko‘rsatsin yoki tarixiy buyurtmalar deb nomlansin.

### 21 — P2: RU/TR foydalanuvchisiga xabarlar o‘zbekcha qolishi mumkin [Kod]

Notification POST body matnini `uz`da saqlaydi; Telegram sahifasi body/title ni tayyor matn sifatida chiqaradi. Bot “Buyurtmani ochish” tugmasini ham hardcode qiladi. Web event bor bo‘lsa qayta tarjima qiladi, bu ikki kanalda bir xil emas.

Dalil: [notifications API](/Users/macbookpro/Projects/factory-os-v2/src/app/api/notifications/route.ts:130), [Telegram body](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/notifications/page.tsx:42), [bot button](/Users/macbookpro/Projects/factory-os-v2/src/lib/telegram-bot.ts:128).

**Tuzatish/mezon:** structured event + foydalanuvchi locale asosida render; bot havolasi ham tanlangan tilni ochsin. RU/TR xabar, tugma va maqsad ekran tili mos bo‘lsin.

### 22 — P2: Telegramda ikki xil filtr bir xil “Shoshilinch” deb ataladi [Jonli + Kod]

`urgent-group` urgent+criticalni, `urgent` esa faqat urgentni oladi, lekin o‘zbekcha ikkisi ham “Shoshilinch”; turkchada ham “Acil” takrorlanadi. Natija nima uchun farq qilganini foydalanuvchi tushunmaydi.

Dalil: [filter options](/Users/macbookpro/Projects/factory-os-v2/src/components/telegram/telegram-orders-filters.tsx:80), [filter logic](/Users/macbookpro/Projects/factory-os-v2/src/lib/telegram-order-filters.ts:21).

**Tuzatish/mezon:** guruhni “Shoshilinch va juda shoshilinch” deb nomlash yoki uni faqat shortcutda qoldirish. Har bir option nomi o‘z natija to‘plamini aniq ifodalasin.

### 23 — P2: ro‘yxat va moliya ish konteksti tiklanmaydi [Kod]

Web buyurtma qidiruvi/filtri/sahifasi va moliya tab/stage/query/detail React stateda. Boshqa sahifaga o‘tib qaytganda saqlangan URL konteksti yo‘q. Finance detaildan Telegram buyurtmasiga o‘tganda ichki back “buyurtmalar”ga olib boradi, ayni paymentga emas.

Dalil: [orders state](/Users/macbookpro/Projects/factory-os-v2/src/components/orders/orders-list.tsx:108), [finance state](/Users/macbookpro/Projects/factory-os-v2/src/components/finance/finance-workspace.tsx:22), [payment link](/Users/macbookpro/Projects/factory-os-v2/src/components/finance/finance-details.tsx:17).

**Tuzatish/mezon:** query parametrlarida filtr/sahifa/detail id; validatsiyalangan return context. Buyurtmani ko‘rib qaytgan moliyachi ayni to‘lov va filtriga qaytsin.

### 24 — P2: bo‘sh ekran keyingi foydali qadamni ko‘rsatmaydi [Jonli + Kod]

Dashboard oltita 0 ko‘rsatkich va bo‘sh diagrammalar bilan katta joy oladi. Telegram “Sizga tegishli buyurtmalar shu yerda ko‘rinadi” deydi, lekin yaratish yoki webga o‘tish yo‘li yo‘q. Finance bo‘sh bo‘lsa ham tanlash panelini ko‘rsatadi. Birinchi foydalanish, filtr natijasi yo‘qligi va kutilayotgan ish yo‘qligi farqlanishi kerak.

Dalil: [dashboard](/Users/macbookpro/Projects/factory-os-v2/src/components/dashboard/dashboard-overview.tsx:108), [Telegram empty](/Users/macbookpro/Projects/factory-os-v2/src/app/[lang]/telegram/orders/page.tsx:135), [finance empty](/Users/macbookpro/Projects/factory-os-v2/src/components/finance/finance-workspace.tsx:74).

**Tuzatish/mezon:** holatga mos CTA: “Birinchi buyurtma”, “Filtrlarni tozalash”, “Barcha to‘lovlar” yoki rolga mos tushuntirish. Keraksiz bulk panel yashirilsin.

## Haqiqiy qurilmada tekshirish qolgan

Bu bandlar 24 ta tasdiqlangan topilma soniga kirmaydi:

- Bridge’da Telegram BackButton, themeChanged, closing confirmation va Telegram content-safe-area bilan integratsiya topilmadi. In-app back va CSS `env(safe-area-inset-*)` bor. iOS/Android Telegramda native back, keyboard, fullscreen va yopishda draftni saqlash tekshirilsin.
- Sessiya yo‘q/stale bo‘lsa protected Telegram route oddiy web loginga ketadi (`proxy.ts:16`, `session.ts` requireSession). Haqiqiy klientda kutiladigan re-auth va dastlabki detailga qaytish aniqlashtirilsin.
- Appga xos `error.tsx`, `loading.tsx`, `not-found.tsx` yo‘q; Next standart fallbackining lokalizatsiyasi va tiklanish yo‘li sinovdan o‘tkazilsin. Bu barcha sahifa nosoz degani emas.
- Barcha rollar, qisman ta’minlash, parallel xaridchi oqimlari, bekor qilingan payment, uzoq matn, 320px ekran, 200% zoom, klaviatura/VoiceOver, sust internet va server 401/409/500 holatlari bilan alohida QA.
- Katta buyurtma hajmida Telegram pagination/virtualization va takroriy server querylar tekshirilsin. Load test bo‘lmagani uchun sekinlik fakt sifatida berilmadi.

## Nima yaxshi ishlangan

- Uch bosqichli wizard, yakuniy review va yagona mumkin bo‘lgan arizachi/omborni avtomatik tanlash kiritish yukini kamaytiradi.
- Telegram pastki menyusi nomlangan, barmoq yetadigan joyda; safe-area padding va navigatsiya kutish indikatori bor. Buyurtma filtrlari va detaldan qaytish querysi ko‘p hollarda saqlanadi.
- 390pxda tekshirilgan asosiy ekranlar moslashadi; moliya kartalarga o‘tadi. Tekshirilgan sahifalarda umumiy gorizontal overflow kuzatilmadi.
- Moliya API/action oqimida pending, 409 conflict, ruxsat va takroriy to‘lovni cheklash uchun mavjud himoyalar/testlar bor. Profil feedbackida `alert/status` ishlatilgan.

## Avtomatik tekshiruvni talqin qilish

Impeccable detector bir marta `src` ustida ishlatildi: 4 ta `side-tab` warning. Joylar: web discussion 49-qator, Telegram detail 176-qator, order-comments 223/274-qator. To‘rttalasi ham reply/quote chegarasi bo‘lib, kontekstda asosli; **false positive** sifatida UX topilmasiga qo‘shilmadi. Faqat 4 warning chiqishi sayt UXi sog‘lom degani emas.

Brauzer evaluate faqat o‘qish rejimida: script injection/overlay bajarilmadi va mavjud deb da’vo qilinmaydi. A bahosi detector natijalarini ko‘rmasdan bajarildi.

## Foydalanuvchi nuqtayi nazaridan

- **Telefondagi, tez-tez chalg‘iydigan operator:** draft yo‘qolishi, 32px amallar, umumiy validatsiya xatosini qidirish eng katta og‘riq.
- **Rahbar/xaridchi/moliyachi:** “Amal kerak”dan bajarishga yo‘l yo‘qligi, turli ro‘yxatlar va saqlanmagan qayta yuborish jarayonni to‘xtatadi.
- **Klaviatura/ekran o‘quvchi foydalanuvchi:** nomlanmagan inputlar, invalid maydonga fokus yo‘qligi va past kontrast yordamga qaram qiladi.

## Tavsiya etilgan bajarish tartibi

1. **P0ni yopish:** test-access endpoint va ommaviy autentifikatsiya chegarasi.
2. **Serverni yagona haqiqat qilish:** 02–05 saqlash muammolari, 07 yagona visibility policy, 10 stale/error holatlari.
3. **Telegram oqimini tugatish:** 06 amallar yoki aniq web handoff; 08 haqiqiy holat; 11 kirishdan tiklanish; 14/19 xabar va yangilash.
4. **Ma’lumot va kontekstni asrash:** 09 draft, 15 til, 17 validatsiya, 23 ro‘yxat/payment holati.
5. **Mobil/a11y va ishonch:** 12 haqiqiy workspace, 13 label, 16 target, 18 kontrast; keyin 20–22/24 ma’no va bo‘sh holat.

Mos workflowlar: `/impeccable harden` (draft/xato/holat), `/impeccable clarify` (nomlar va keyingi amal), `/impeccable adapt` (mobil), `/impeccable audit` (yakuniy tekshiruv), oxirida `/impeccable polish`. Server/permission tuzatishlari odatiy engineering vazifalari sifatida bajariladi.

Keyingi ish uchun qarorlar: avval **server saqlash va ruxsat**, **Telegram oqimi**, yoki **mobil/a11y**; qamrov **P0+P1** yoki **barcha 24 topilma**. Hozirgi audit tuzatish/deployni amalga oshirmaydi.
