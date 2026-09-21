# Procurement order placement

At `procurement_order`, the orders table's **Place order** button opens order
details scrolled to **Procurement work**. Approved positions are grouped by
supplier there, with a checkbox per product and a supplier-level select-all.
Selection starts empty; a position split between suppliers selects all of its
approved supplier rows together. Unselected positions stay with the specialist.

The detail footer opens a nested, landscape payment dialog containing only
the selected positions, grouped by supplier ID (even across quotation packages).
There are no checkboxes in this second dialog. Cancel/Escape returns to the
unchanged selection. Ordinary order-row navigation still opens at the top.

Each supplier has one bank/cash payment method, synchronized advance percent/amount,
remaining-balance due date, INN, optional contract number and optional contract file.
Payment method defaults from offers; mixed methods preserve each offer's original
method unless explicitly overridden. A supplier advance is allocated by product
value in integer cents, preserving the exact group total. Existing
supplier INN is read-only, enforced by the API. A missing INN is entered once and
saved to the supplier in the placement transaction. The orders table exposes a
placement shortcut only for assigned users with the procurement quote permission.
The advance represents agreed terms, not an executed payment. No payment is
sent and no finance transaction is created by this form.

`POST /api/orders/[id]/approve` requires multipart payment data at this stage.
The server re-derives quantity, supplier, unit price and total from approved
offers, validates exact coverage of the selected positions' procurement quantities, and verifies the
current actor and permission. Advance is 0–100%, with at most two decimal
places in the amount; a real due date is required when a balance remains.

The order's appended `placement` snapshot, supplier INN, private contract records
and selected positions' change to `warehouse_receipt` are committed in one SQLite transaction with an
optimistic order-version check. Contract bytes are base64 in the private
`order-contracts` app-record namespace (not exposed by generic record APIs).
Supplier files use multipart `supplier-contract-<first-payment-index>`: one file
record is shared by the submitted payment rows for that supplier. Existing
`contract-<index>` clients remain supported. Conflicting file assignments cause
an atomic rollback. Files are limited to 5 MiB each and the streamed multipart request to 20 MiB.
This keeps recovery atomic with the existing database; account for base64's
storage overhead when estimating backup size.

Downloads use `/api/orders/[id]/contracts/[fileId]`, authenticated order access,
specialist-assignment filtering, attachment disposition and no-store caching.
Saved terms and download links remain visible in order details. Existing orders
already beyond this stage are not retroactively changed.

Verification: `npm test`, `npx tsc --noEmit`, `npm run build` and
`npx tsx scripts/test-procurement-splits.ts`. The HTTP integration test uses a
temporary database and includes missing/invalid terms, unchanged stage after
failure, accepted terms, cross-user file authorization and warehouse completion.

For the 2026-09-20 deployment, the locally generated Next JS/static build is
layered onto the existing Linux image only after verifying an identical
package-lock hash. Do not copy macOS node_modules, local databases, `.env`, or
Next dev/cache directories. Smoke-test the release on Linux using an isolated
test database before replacing the app image. The standard Dockerfile remains
the full-build path when dependencies change. Production source must be kept
in sync with the release. Production data stays in its existing Docker volume.
