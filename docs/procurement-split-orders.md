# Independent procurement orders

Allocation creates actual `app_records(namespace='orders')` rows. The original
request becomes a `procurementSplit` allocation/history container. Each child
has `parentOrderId`, `parentOrderNumber`, one specialist, its own lines, workflow,
quotations (`procurement-${child.id}`), notifications, and discussion.

- A → B → A allocations retain `/1` and `/2`; new A positions append to `/1`.
- A position belongs to exactly one child. Parent and child writes are atomic;
  concurrent attempts to allocate the same position cannot both succeed.
- Adding positions is allowed only while that specialist's child is sourcing.
  Submitted/approved orders must not silently acquire unreviewed positions.
- Submission checks combined supplier offers per sourcing position and moves
  fully covered positions to procurement-head review. Neither uncovered
  positions nor sibling orders block the transition.
- Review, director approval, ordering and warehouse receipt use the child ID.
- Original discussion/history remain on the parent, reachable from each child.
  The parent/previous-discussion navigation link is shown only to users with
  the `procurement_manager` role, in both the dashboard and Telegram web app.
  This is a navigation rule; existing order access checks remain unchanged.
- Fully allocated containers are excluded from active order counts and rows;
  procurement rows exclude allocated parent positions to avoid double-counting.

## Existing data

### Partial procurement inside one child

`procurementProgress` tracks each required position independently through
sourcing, price check, director approval, placement, warehouse receipt and
completion. This does not generate additional child IDs or order numbers.
The aggregate order step is the earliest unfinished position. Actor-specific
action views expose their most advanced pending step, while sourcing and
placement controls explicitly scope to their own eligible positions.

The waiting queue checks all active positions, so one order can wait for a
specialist, procurement head and warehouse simultaneously. Draft offers do not
advance sourcing. Head review/return and director approval/rejection affect
only positions currently waiting for that actor at that step. Approved supplier
selection is persisted with quotation `selectedLineIds`, preserving selection
for positions that have already advanced. Every transition records position IDs
in workflow history; completion requires all required positions to be terminal.

Legacy orders initialize position progress lazily at their next procurement
action. No new schema migration is required for this feature. Existing selected
quotations without `selectedLineIds` retain their legacy all-lines meaning.
Adding positions to a still-sourcing child initializes only the new positions
as sourcing; existing progress and placement snapshots remain intact.

### Legacy split migration

Run `npx tsx scripts/migrate-procurement-splits.ts` for a read-only plan. With
`--apply`, the script first creates a timestamped SQLite recovery backup beside
the database, then migrates active legacy split records in one transaction.
Stop the old application before applying and start the new version afterward.
Do not copy a local database to production.

Existing quotation IDs, amounts and selection are preserved. Previously
submitted children advance to head review; sourcing siblings remain sourcing.
Cross-child legacy quotation packages or child-ID collisions cause a rollback
for manual review. Completed historical single-specialist orders are untouched.
Re-running the migration does not create duplicate children.

## Verification

`npm test` includes pure assignment and workflow regression tests.

`npx tsx scripts/test-procurement-splits.ts` creates a temporary database, runs
migrations, starts Next on localhost:3106, and exercises real authenticated API
requests through allocation, offers, review, return, director, procurement and
warehouse completion, plus concurrency and idempotent data migration. It never
uses the production database or Telegram credentials. `--keep-running` leaves
the isolated test UI available for browser checks.
