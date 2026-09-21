# Finance workflow release — 2026-09-20

- Host: `159.223.160.56`, project `/opt/factory-os-v2`.
- Active image: `factory-os-v2:finance-20260920-1449` (also `latest`).
- Image ID: `sha256:5115896166b55e7e8d8405d3d2430407204709fcefcb959e9c8cd546f4910767`.
- Next build ID: `JUCu6VQvw8RhlRo0L9LnZ`.
- Prior image: `factory-os-v2:grouped-20260920-1325`, additionally tagged `before-finance-20260920-1449`.
- Consistent SQLite backup: `/app/data/before-finance-20260920-1449.sqlite` in the existing production data volume.
- Release files: `/opt/factory-os-v2/releases/finance-20260920-1449`.
- Archive SHA256: `217a2e95d66ec91050ad62a2d5a45d5c5cbc41219e886b07df23548891ffdaaf`.

Locally verified with 88 unit tests, real HTTP + isolated SQLite workflow tests
(including concurrent duplicate payment protection), browser flows and production
build. The compiled JS/static build was layered onto the existing Linux runtime
after checking the identical package-lock SHA256. No server-side Next compilation,
dependency install, database replacement or seed was performed. Production source
was synchronized and the existing app container was recreated in place.

Production checks: healthy container; public login HTTP 200; unauthenticated finance
API HTTP 401; authenticated finance API, dashboard and Telegram finance HTTP 200
for director, procurement head and procurement specialist. Read-only finance GETs
exposed two historical payment requests to the head/director and zero unrelated
payments to the tested specialist. Temporary verification sessions were removed.
No production payment actions were executed.

Database quick_check passed before and after release. Operational counts stayed
at 25 orders, 23 quotations, 14 suppliers; 19 users before deployment. Requests live
in app_records, so the startup check's normalized-table count of zero orders is
not the operational order count.

Configuration follow-up: finance, finance_head, and finance_manager currently have
zero active assigned users. An authorized user must assign the appropriate finance
role before anyone can perform the final mark-paid action. Owner grants do not
bypass the business-role requirement. No roles were changed by this deployment.

For rollback, retag the previous image as latest and recreate app with the existing
production compose file. Do not automatically restore the database: preserve user
changes and financial audit records created after deployment.
