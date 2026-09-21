# UX/UI tuzatishlari — 2026-09-22

Foydalanuvchi qarori: P0 test kirishi hozircha saqlanadi. Dastlabki auditdagi 13 ta P1 va 10 ta P2 uchun tuzatishlar kiritildi. Tashkilot tanlash menyusi va uning foydalanilmaydigan komponenti olib tashlandi. Deploy qilinmadi.

## Audit bandlari bo‘yicha natija

| ID | Natija |
|---|---|
| 01 / P0 | O‘zgarishsiz: `test-access` endpointi va Telegram bootstrapdagi `phone` tarmog‘i saqlandi. |
| 02 / P1 | Qayta yuborish server PATCH orqali; maydonlar, muallif/ruxsat va yozuv versiyasi tekshiriladi; audit va navbatdagi mas’ul xabari saqlanadi. |
| 03 / P1 | Guruhli o‘chirish serverda atomar yumshoq arxivlash orqali; keyingi o‘qishda yozuv qaytib kelmaydi. To‘lov yoki bo‘lingan jarayon bilan bog‘liq yozuvlarni yashirish bloklanadi. |
| 04 / P1 | Yangi oddiy ilovalar serverda saqlanadi; boshqa ruxsatli hisob/qurilmadan yuklanadi. Hajm va o‘qish huquqi tekshiriladi. |
| 05 / P1 | Supplier tahriri/arxivi server PATCH orqali; eskirgan versiya 409 oladi, dialog xatoda ochiq qoladi. |
| 06 / P1 | Telegramga umumiy buyurtma amal oynasi qo‘shildi: tasdiqlash/rad etish, ombor, ta’minot, to‘lov rasmiylashtirish va ilovalar web bilan umumiy komponentdan foydalanadi. Izoh/javob/mention uchun umumiy yoziladigan chat. |
| 07 / P1 | Web API, klient va Telegram uchun bitta buyurtma ko‘rinish qoidasi; arizachi, muallif, bo‘lim va biriktirilgan ta’minotchi hisobga olinadi. Chat o‘qish/yozish ham buyurtma yoki mention huquqi bilan cheklangan. |
| 08 / P1 | Telegram aniq holat, joriy bosqich va mas’ulni ko‘rsatadi; sun’iy foizli progress olib tashlandi. |
| 09 / P1 | Qoralama maydonlari, qadam va File obyektlari foydalanuvchi/buyurtma/versiya kaliti bilan IndexedDBda saqlanadi. Tiklash, tozalash va saqlash xatosi holatlari qo‘shildi. |
| 10 / P1 | Yuklanish va eskirgan ma’lumot banneri, qayta urinish, GET timeout va haqiqiy yangilanish vaqti. Eski lokal cache server yozuvlarini qayta tiriltirmaydi. |
| 11 / P1 | Telegram tashqarisida ochish, ulanmagan hisob, eskirgan sessiya va tarmoq xatosi ajratildi; Retry/web kirishi va boshlang‘ich manzil saqlanadi. Sessiyasiz Telegram URL proxy orqali bootstrapga boradi. |
| 12 / P1 | Tashkilot almashtirish va soxta jamoalar olib tashlandi; statik Factory OS identifikatori. |
| 13 / P1 | Supplier, wizard, sozlamalar multi-select va qidiruv control nomlari `id/htmlFor` yoki `aria-label` bilan bog‘landi. |
| 14 / P2 | Bitta xabar va barcha xabarlarni o‘qilgan qilish alohida server amallari; badge faqat muvaffaqiyatli saqlashdan keyin o‘zgaradi. Oxirgi 100 yozuv chegarasi nomlandi. |
| 15 / P2 | Til almashtirish query/hash va ichki qaytish manzilini saqlaydi; Telegram bo‘lim/ombor filtrlari tarjima o‘rniga ID ishlatadi. |
| 16 / P2 | Mobil tugma/input/select hit maydonlari kengaydi; matn inputlari 16 px. Telegram navigatsiyasi 64 px balandlikda. |
| 17 / P2 | Wizardda maydon yonidagi xato, `aria-invalid`/`aria-describedby`, birinchi xatoga fokus va yangi buyurtmaga mos xato matni. |
| 18 / P1 | Telegram nav 12 px, light/dark kontrastli tokenlar va aktiv fon; reply umumiy theme tokenlaridan foydalanadi. |
| 19 / P2 | Telegram focus/visibility/polling va qo‘lda refresh; server render vaqti ko‘rsatiladi. Modal yoki yozish vaqtida avtomatik server refresh kechiktiriladi. |
| 20 / P2 | Dashboard barcha 7 holatni sanaydi, umumiy ko‘rinish siyosatiga tayanadi; yakunlangan buyurtmalar faol ombor yukidan chiqarildi. |
| 21 / P2 | Xabar voqeasi serverda saqlanadi, eski Uzbek workflow matnlari ham tarjima qilinadi; bot xabarlari saqlangan foydalanuvchi tilidan foydalanadi. |
| 22 / P2 | Birlashtirilgan urgency filtri «Shoshilinch va juda shoshilinch» deb alohida nomlandi. |
| 23 / P2 | Buyurtma va moliya qidiruvi, filtrlar, sahifa va tafsilot URLda; to‘lov→buyurtma va Telegram→web qaytish manzillari saqlanadi. |
| 24 / P2 | Dashboard, Telegram va moliya bo‘sh holatlariga yaratish, barcha yozuvlarni ko‘rish yoki filtrni tozalash amallari qo‘shildi. |

Qo‘shimcha topilgan va tuzatilgan: oddiy rad etish ham faqat lokal bo‘lgan — server workflow amaliga ko‘chirildi. Buyurtma versiyasi workflow/approval/finance o‘zgarishlarida yangilanadi. Telegram loading/error/not-found chegaralari, native BackButton va theme hodisalari, safe-area hisobga olindi. Yaratilish sanasi web va Telegramda bir xil Toshkent vaqtiga moslandi.

## Tekshirish

- `npm test`: 93/93 o‘tdi. Yangi testlar umumiy ruxsat, tarjima, qayta yuborish validatsiyasi va ID asosidagi filtrlarni qoplaydi.
- `npm run lint`: xato va warning yo‘q.
- `npm run build`: production build o‘tdi.
- `git diff --check`: toza.
- `scripts/verify-ux-flows.mjs`: alohida SQLite nusxasi va lokal Next serverida 41 API/SSR tekshiruvi o‘tdi. Qayta o‘qish, boshqa foydalanuvchi orqali ilova yuklash, 403/409, guruhli transaction rollback, supplier arxivi, mention/javob, individual/barcha notification read, locale va auth redirect tekshirildi. Test serverida Telegram bot yuborishi o‘chirilgan.
- Brauzer: desktop wizard, maydon xatolariga fokus, reload bilan qoralama/qadam/izohning tiklanishi, supplier inputlarining accessibility nomlari; 390 px Telegram light/dark, amallar dialogi va webga o‘tish; UZ→RU qidiruv va qaytish manzili tasdiqlandi.
- 390 px Telegram tekshiruvida `scrollWidth = innerWidth = 390`; nav yozuvi 12 px va havolalari 64 px balandlikda.
- UI detector bir marta bajarildi: chatdagi ikki eski 2 px yon chiziq topildi va 1 pxga tushirildi.

Testni qayta bajarish uchun seed qilingan bazaning **alohida `/tmp/` nusxasi** bilan Next serverini ishga tushiring, `TELEGRAM_BOT_TOKEN`ni bo‘sh qoldiring. Keyin:

```sh
UX_TEST_DATABASE=/tmp/factory-ux-test.sqlite UX_TEST_URL=http://localhost:3217 node scripts/verify-ux-flows.mjs
```

## Qolgan tekshiruv chegaralari

Haqiqiy iOS/Android Telegram WebViewda klaviatura, SDK BackButton/theme/safe-area va bot xabarining yetib borishi hali qurilmada tasdiqlanmagan. Brauzer tekshiruvi native Telegram sinovi o‘rnini bosmaydi.

Avval faqat bitta brauzerda saqlangan eski ilovalar uchun IndexedDB fallback saqlandi. Ular serverga qayta yuklanmaguncha boshqa qurilmada ochilmaydi; yangi yuklamalar serverga tushadi. Qoralama ham shu qurilmaga tegishli. Eski localStorage cache yozuvlari o‘chirilmaydi, lekin serverdagi holat o‘rniga qayta qo‘shilmaydi; tarixiy lokal yozuvlar avtomatik migratsiya qilinmagan.

Arxivlash tarixni fizik o‘chirmaydi. To‘lovli va bo‘lingan buyurtmalar jarayonning boshqa qismlaridan uzilib qolmasligi uchun arxivlashdan himoyalangan. P0 test kirishi foydalanuvchi qarori bilan keyingi bosqichgacha qoldirildi.

## Modal, moliya va dashboard qo‘shimchalari

Foydalanuvchining keyingi olti talabiga binoan:

1. Umumiy `Dialog` ustki qatlamni tekshiradi, bitta native yopish hodisasini bir marta qabul qiladi. Ichki oynada X/Escape/backdrop yopilishi ota oynaga o‘tmaydi. Ichki to‘lov shartlarini saqlash tashqi buyurtmani avtomatik yopmaydi. Popover, select, menu va tooltip o‘z dialogining ustida turadi.
2. Moliya tafsilotidagi «Buyurtma haqida batafsil» endi shu sahifada umumiy buyurtma dialogini ochadi. Ruxsatlar mavjud buyurtma provideridan olinadi; topilmagan/ruxsatsiz buyurtma uchun tushunarli holat bor.
3. Ichki dialoglarda UZ/RU/TR «Ortga» mavjud; ota dialog unmount qilinmaydi, uning holati va scrolli saqlanadi. Telegram native BackButton ochiq modal bo‘lsa shu qatlamni yopishga yo‘naltiriladi.
4. Buyurtma to‘lovlari: «Barchasi», «To‘lov boshlanmagan», «Jarayonda», «To‘liq to‘langan», «Bekor qilingan». Avans yoki boshqa bir to‘lov bajarilgan, qoldiq ochiq bo‘lsa — jarayonda. Bekor qilish tarixdagi to‘langan summani qaytargan deb hisoblamaydi. Hisoblar foydalanuvchiga ko‘rinadigan rasmiylashtirilgan to‘lovlar bo‘yicha; moliyaviy to‘liq to‘lanish ombor/yetkazish jarayoni yakunlanganini anglatmaydi.
5. Statistik kartalar: meni kutayotgan to‘lovlar soni, ochiq qoldiq, muddati o‘tgan qoldiq, jami to‘langan. Kartadan tegishli filtr ochiladi. Bugungi muddat overdue emas; Toshkent sanasi ishlatiladi. Telefon ekranida 2 ustun, katta ekranda 4 ustun. Telegramda takroriy yangilash tugmasi olib tashlandi; umumiy refresh moliyani ham yangilaydi.
6. Dashboardda ochiq buyurtmalar yoshi: 0–3, 4–7, 8–14, 15+ kun va eng eski uchta buyurtmaga havola. Bu yaratilganidan beri o‘tgan vaqt, kechikish/SLA emas. Yakunlangan shoshilinch buyurtmalar faol shoshilinch hisobdan chiqarildi.

Telegram dark rejimi portal orqali ochiladigan dialog va menyularga ham uzatiladi. Oldingi P0 test kirishi saqlandi.

Qo‘shimcha tekshirish: 97/97 unit test; alohida bazada 41 API/SSR test va moliyaning to‘rtta holati/summalari uchun `scripts/verify-finance-ux.mjs`; desktop X, Escape va Ortga orqali faqat bitta qatlam yopilishi, URL va moliya filtri saqlanishi; 390×844 Telegram dark/light maketi, ichki dialogning shu sahifada ochilishi, dark tokenlar; sozlamalar dialogidagi popover orqali tanlash va qaytish; dashboard chartidagi haqiqiy sonlar. Lint va production build bajarildi. Haqiqiy Telegram qurilmasidagi SDK BackButton testi hali alohida kerak.

```sh
UX_TEST_DATABASE=/tmp/factory-ux-test.sqlite UX_TEST_URL=http://localhost:3217 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-finance-ux.mjs
```

### Keyingi UX tavsiyalari (ushbu o‘zgarishga kiritilmagan)

- Har buyurtmada «Hozir kimda / Keyingi amal / Qachongacha»ni bitta qisqa blokda ko‘rsatish. Xodim navbatdagi qadamni tarixdan qidirmaydi.
- Rol bo‘yicha saqlanadigan «Bugun», «Kechikkan», «Menga biriktirilgan» ko‘rinishlar. Filtrlarni har safar qayta yig‘ish kamayadi.
- To‘lov tasdig‘iga bank hujjati yoki tranzaksiya raqamini bog‘lash. Keyingi tekshiruvda to‘lovning dalili shu joydan topiladi; alohida qaytarish/refund jarayonini ham belgilash zarur.
- Bosqichlar uchun ish kunlari bo‘yicha SLA va mas’ulga kechikish eslatmalari. Avval muddat qoidalari va kimga yuborilishi kelishilishi kerak.
- Mobil uzun tafsilotlar uchun «Umumiy / Pozitsiyalar / Tarix / Muhokama» bo‘limlariga tez o‘tish. Uzun sahifada ko‘p aylantirish kamayadi.
