# Order line layout and number input release — 2026-09-23 (Asia/Tashkent)

- Host: `159.223.160.56`, project `/opt/factory-os-v2`.
- Application commit: `cee35cb`.
- Active image: `factory-os-v2:ui-inputs-20260923-cee35cb`, also tagged `latest`.
- Image ID: `sha256:a3a588f99943ef40471581002442a1e043fd55e966cfe5683cbe9240c9958fda`.
- Next build ID: `2LwLrppCZs7m6fpUVQuux`.
- Prior image: `factory-os-v2:before-ui-inputs-20260923-cee35cb` (director progress release, `524f550d18b5`).
- Consistent SQLite backup: `/app/data/before-ui-inputs-20260923-cee35cb.sqlite` in the production volume.
- Release directory: `/opt/factory-os-v2/releases/ui-inputs-20260923-cee35cb`
  (source/build archives, `host-source-before.tar.gz`, backup/verify scripts).
- Package-lock SHA256 unchanged: `a91b36f85c1f2880b9d357632b874676db468ef0ef6d65bdf98b8eb49db91eaf`.
- Source archive SHA256: `e4926773cf53ddcdea73943ac73bf0723753b921f4702889108d2735c659a97e`.
- Build archive SHA256: `983c3fe78a5ce8d0a4efee22e4fd78f264d8922905b53ba9859d34bba5defdd2`.

Same layering method as earlier releases; no schema migration. A network-disabled
smoke container with Telegram disabled ran on a copy of the backup; director,
procurement head and specialist API/web/Telegram pages passed, then the container
and data copy were removed.

After cutover: container healthy, image and build ID match, startup DB check passed,
role checks passed, quick_check ok, rows unchanged (28 orders, 24 quotations,
14 suppliers, 3 finance payments), public UZ/RU login 200, unauthenticated finance
API 401. No production workflow action was executed.

Rollback: tag `factory-os-v2:before-ui-inputs-20260923-cee35cb` as
`factory-os-v2:latest` and run
`docker compose -f docker-compose.production.yml up -d --no-build --force-recreate app`.
Do not automatically restore the database.
