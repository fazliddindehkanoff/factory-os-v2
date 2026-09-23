# Dashboard, workspace and Telegram home redesign — 2026-09-23 (Asia/Tashkent)

- Host: `159.223.160.56`, project `/opt/factory-os-v2`.
- Application commit: `93e090c`.
- Active image: `factory-os-v2:redesign-20260923-93e090c`, also tagged `latest`.
- Image ID: `sha256:059b90b9c29b08056c2e799d205a6648665bb4e4ff524f5fe821aef534081fd2`.
- Next build ID: `IM4sXcjhsIcDGTjs8JETM`.
- Prior image: `factory-os-v2:before-redesign-20260923-93e090c` (order line / number input release).
- Consistent SQLite backup: `/app/data/before-redesign-20260923-93e090c.sqlite` in the production volume.
- Release directory: `/opt/factory-os-v2/releases/redesign-20260923-93e090c`
  (source/build archives, `host-source-before.tar.gz`, backup/verify scripts).
- Package-lock SHA256 unchanged: `a91b36f85c1f2880b9d357632b874676db468ef0ef6d65bdf98b8eb49db91eaf`.
- Source archive SHA256: `9dc558dad42d4785459ecd2fb096b67d3144130cc74046e1007bb6532722f747`.
- Build archive SHA256: `77d6d0648a09fd3b71123511a8731d7af05c50fcc8e9e1cdcec7528326928f16`.

Same layering method as earlier releases; no schema migration. The Telegram
web app now lands on `/telegram/home`; `/telegram/orders` still works.

A network-disabled smoke container with Telegram disabled ran on a copy of the
backup. Director, procurement head and specialist API plus eight pages each
(web finance/orders/dashboard/procurement/suppliers, Telegram
finance/orders/home) returned 200; the container and data copy were removed.

After cutover: container healthy, image and build ID match, startup DB check
passed, the same role checks passed, quick_check ok, rows unchanged (28 orders,
24 quotations, 14 suppliers, 3 finance payments). Public UZ/RU login and
`/uz/telegram` 200, unauthenticated `/uz/telegram/home` redirects to Telegram
sign-in, unauthenticated finance API 401. No production workflow action was executed.

Rollback: tag `factory-os-v2:before-redesign-20260923-93e090c` as
`factory-os-v2:latest` and run
`docker compose -f docker-compose.production.yml up -d --no-build --force-recreate app`.
Do not automatically restore the database.
