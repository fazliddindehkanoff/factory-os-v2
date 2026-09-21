# UX and finance release — 2026-09-22 (Asia/Tashkent)

- Host: `159.223.160.56`, project `/opt/factory-os-v2`.
- Public URL: `https://factory.159-223-160-56.sslip.io`.
- Application commit: `5d94a5a4f207fe4290da084aa94f700b23329c68`.
- Active image: `factory-os-v2:ux-20260922-5d94a5a`, also tagged `latest`.
- Image ID: `sha256:ced1cb6d64459515deb619732d2a9c28fbe3a18f4e59b16822be491c250a7e6f`.
- Next build ID: `xaxFke8SeI6fPvHfe6dUq`.
- Prior image: `factory-os-v2:before-ux-20260922-5d94a5a` (finance release).
- Consistent SQLite backup: `/app/data/before-ux-20260922-5d94a5a.sqlite` in the existing production volume.
- Release directory: `/opt/factory-os-v2/releases/ux-20260922-5d94a5a`.
- Previous host source: `host-source-before.tar.gz` in that release directory.
- Package-lock SHA256, equal locally, on the host and in the prior container: `a91b36f85c1f2880b9d357632b874676db468ef0ef6d65bdf98b8eb49db91eaf`.
- Source archive SHA256: `f73ebcbce8af7e2a536f59bc9a32209baad38a932510e59299edaa350797916e`.
- Build archive SHA256: `2b1ca6fe008c21b667b03ac5b96ded4a94f03ca3c68c1535e194b39a7a4113bf`.

The locally verified production build and source were layered onto the existing
Linux runtime. No macOS node_modules, local database, credentials or development
cache were uploaded. Production source was synchronized; the existing server
compose and environment files were preserved. The app was recreated in place
with `docker compose -f docker-compose.production.yml up -d --no-build --force-recreate app`.
This release adds no schema migration; startup migration and database checks passed.

Before cutover, a network-disabled Linux smoke container ran against a separate
copy of the backup, with Telegram sending disabled. Director, procurement head
and procurement specialist finance API and web/Telegram pages passed. The smoke
container was stopped and removed before production cutover.

After deployment:

- Container is `running` and `healthy`; active image and build ID match the release.
- Public HTTPS UZ/RU login pages and three static assets returned HTTP 200.
- Unauthenticated finance and attachment APIs returned HTTP 401.
- Authenticated finance API, web finance/orders/dashboard and Telegram
  finance/orders returned HTTP 200 for the three tested roles.
- Director/head saw three derived/stored payment requests; the tested specialist
  saw zero unrelated payments. Temporary verification sessions were removed.
- SQLite quick_check passed before and after. Operational rows remained at
  25 orders, 23 quotations, 14 suppliers and 2 persisted finance-payment records.
  There were 19 users at backup time. Derived payment requests do not necessarily
  equal the persisted finance-payment record count.
- No production approval, cancellation or payment action was executed.
- P0 test access remains unchanged by explicit user request.

Rollback: tag `factory-os-v2:before-ux-20260922-5d94a5a` as `factory-os-v2:latest`
and recreate `app` with the same compose command. Restore the matching host source
if needed. Do not automatically restore the database: preserve user changes and
audit records created after deployment. Native Telegram device verification is
still separate from these HTTP and prior browser checks.
