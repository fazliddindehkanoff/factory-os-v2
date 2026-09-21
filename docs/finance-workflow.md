# Finance after procurement placement

## Source and persistence

- Finance lists real `OrderRecord.placement` snapshots, not the old demo payments.
- Each supplier / placement batch / payment-method / contract grouping produces a separate advance and balance request. Zero-value parts are omitted.
- New requests are written to the private `app_records` namespace `finance-payments` in the same transaction as order placement and contract uploads.
- Existing placements have deterministic virtual requests. GET does not write; the first authorized action materializes the request. No seed or migration is required, and order data is not replaced.
- The generic record API cannot create finance transactions or forge an order placement.

## Authorization and transitions

| Stage | Actor | Actions |
| --- | --- | --- |
| `head_review` | `procurement_head` with approval permissions | Approve, return, cancel |
| `director_review` | `director` with approval permissions | Approve, return, cancel |
| `payment` | `finance`, `finance_head`, `finance_manager` with `finance.mark_paid` | Mark paid only |
| `returned` | The original placing procurement specialist | Correct terms and resubmit to the head |
| `paid`, `cancelled` | Nobody | Read only |

Procurement specialists (`procurement_manager`, legacy `procurement`) see only related requests even if their role also has `finance.view`. The procurement head sees all. General finance readers cannot execute a business-role approval through `grantsAll` alone.

Returns require a comment. The specialist may correct the payment method, due date, and contract reference, with an explanation. Amount, supplier, INN and approved procurement positions remain immutable. Both financial approvals repeat after resubmission. Financial terms are stored on the payment request; original placement evidence remains intact.

## Cancellation

Cancellation requires a reason and explicit UI confirmation. It cancels the exact source order (a `/1`, `/2` child is an independent order) and every outstanding finance request for that order. It clears operational assignments and closes remaining procurement lanes. It does **not** cancel the parent or sibling orders and does **not** reverse an already recorded payment or physical receipt. Paid history remains paid; this feature does not execute bank payments or refunds.

The order uses its existing rejected terminal status plus `financeCancellation` metadata. The details show the cancellation reason; normal order revision cannot reopen a finance-cancelled order. Telegram displays it as cancelled.

## APIs and UI

- `GET /api/finance/payments`: authorized scoped list and actor capabilities.
- `POST /api/finance/payments`: action plus `{id, revision}` items, optional correction and comment. Max 200 items per atomic transaction. Unauthorized, duplicate, stale, cancelled-order or invalid items reject the whole batch. The transaction also stores audit history.
- Dashboard `/[lang]/finance` and mobile `/[lang]/telegram/finance` use the same API. “Waiting for me”, all, status/search filters, selection, Escape deselection, individual and bulk actions are supported.
- Finance cancellation triggers a client order refresh without a hard page reload.
- Order details retain the original vertical workflow timeline, including multiple active procurement lanes. Per-product timeline duplication was removed; placement history is collapsible.

## Verification

- `npm test`: pure workflow, finance authorization, money splitting, correction, cancellation and existing regression tests.
- `npx tsx scripts/test-procurement-splits.ts`: isolated SQLite + real HTTP placement/finance chain; unrelated-user denial, historical read-only backfill, bulk rollback, duplicate and concurrent payment protection, cancellation cascade, preserved paid history and sibling isolation.
- Browser checks: dashboard and mobile, selection/confirmation, head/director/financier capabilities, restored order timeline, responsive viewports.

Deployed after the user's subsequent deployment request. See `deployment-finance-20260920.md` for the release and production verification record.
