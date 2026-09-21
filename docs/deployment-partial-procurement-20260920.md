# Partial procurement production release — 2026-09-20

- Host: `159.223.160.56`, app: `/opt/factory-os-v2`.
- Release image: `factory-os-v2:partial-20260920-1232`.
- Image ID: `sha256:248f5fbe8615b471233abc4c8e8148516763783cfd8ff0c2ef67519216f7159a`.
- Next build ID: `R1MPhBWoa4PWwLmFeNLXk`.
- Previous image: `factory-os-v2:before-partial-20260920-1232`.
- Recovery DB: `/app/data/before-partial-procurement-20260920-1232.sqlite` in the existing data volume.
- Release files: `/opt/factory-os-v2/releases/partial-20260920-1232`.

Local tests (77), real HTTP workflow integration, browser checks and production
build passed. The locally compiled JS/static build was layered on the existing
Linux runtime after matching host/container/local package-lock hashes. No server
Next build or dependency installation was required. Production source was synced.

An isolated, network-disabled Linux smoke container used only a test database.
Admin orders, Telegram orders and authenticated orders API passed. The smoke
container was removed before the existing production container was recreated
with `docker compose -f docker-compose.production.yml up -d --no-build --force-recreate app`.
The production database was not replaced; this release needs no new schema migration.

If rollback becomes necessary, tag the previous image as `factory-os-v2:latest`
and recreate the app with the same compose command. Do not restore the database
automatically: preserve any user changes made after deployment and assess
compatibility with newly recorded per-position progress before rollback.
