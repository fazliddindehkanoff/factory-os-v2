# Grouped supplier placement release — 2026-09-20

- Release image: `factory-os-v2:grouped-20260920-1325`.
- Next build ID: `5hnV4jVf-JtfMU8DDv2LX`.
- Previous image: `factory-os-v2:partial-20260920-1232`.
- Recovery copy: `/app/data/before-grouped-placement-20260920.sqlite`.
- Release directory: `/opt/factory-os-v2/releases/grouped-20260920-1325`.

Includes procurement-section navigation from the placement shortcut, product
selection grouped by supplier, checkbox-free supplier payment forms, exact-cent
advance allocation and one shared contract upload per supplier.

Verified locally with 81 tests, HTTP integration (including shared contracts and
atomic rollback of conflicting contracts), browser selection/payment checks,
TypeScript, targeted lint and production build. Package-lock SHA-256 matches the
existing Linux container. No dependency or schema changes, no production DB
replacement, and no server-side Next build. Source is synchronized with the image.
