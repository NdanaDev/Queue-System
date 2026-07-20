# Aggregates — Queue Management System

Domain-Driven Design aggregates: which objects own consistency, and where the
transactional boundaries actually sit. An aggregate is a cluster of objects
that must stay consistent _together, atomically_. Anything outside that
boundary is referenced by ID only, and coordinated through domain events
instead of a shared transaction.

---

## Ticket Aggregate

**Root:** `Ticket`

**Owns:**

- Status
- Status history / ticket events
- No-show count
- Assigned counter reference
- Timestamps

**Invariant enforced internally:** only valid state transitions happen; the
no-show count never exceeds the configured cap without triggering a void.

**References only (not embedded):** `queueId`, `branchId`,
`serviceCategoryId`, `customerId`

**Note:** Ticket does not own its own queue position. Position belongs to
the Queue aggregate — if Ticket tried to own it, there'd be two sources of
truth the moment a ticket ahead of it cancels.

---

## Queue Aggregate

**Root:** `Queue`

**Owns:**

- Ordered list of ticket references (IDs + positions)
- Queue status (open / overflow / closed)
- Current length

**Invariant enforced internally:** ordering stays consistent — when one
ticket leaves, every position behind it shifts as one atomic operation.

**Why Queue and Ticket are separate aggregates:** an agent completing a
ticket and a customer three places back cancelling their own ticket are
unrelated operations happening at the same moment. If they both had to touch
one combined "Queue-and-all-its-Tickets" aggregate, busy queues would see
lock contention. Keeping Ticket independent means those operations don't
block each other.

---

## Counter Aggregate

**Root:** `Counter`

**Owns:**

- Status (open / serving / on break / closed)
- Currently assigned agent (reference)
- Currently serving ticket (reference)

**Invariant enforced internally:** exactly one ticket at a time — the reason
this is its own aggregate rather than a field on Branch.

---

## Branch Aggregate

**Root:** `Branch`

**Owns:**

- Operating hours
- Currently active service categories
- Overflow policy

**References only (not embedded):** `queueIds`, `counterIds`

**Note:** Branch does not own its Queues and Counters directly. If it did,
opening one counter would require loading and locking the entire branch —
every queue, every other counter — just to flip one status flag. Branch acts
as a coordinating context, not a consistency boundary, for those.

---

## Customer Aggregate

**Root:** `Customer`

**Owns:**

- Identity
- Priority flag

**Cross-aggregate invariant:** "a customer may only have one active ticket"
spans Customer and Ticket — two separate aggregates — so it can't be
enforced the clean way (one transaction, in memory). Enforce it with a
database-level unique constraint (e.g. a unique index on `customer_id` where
status is in the active states), or accept it as eventually consistent and
design for the rare race condition where two tickets briefly both exist.

---

## User (Staff) Aggregate

**Root:** `User`

**Owns:**

- Authentication
- Roles / permissions
- Currently assigned counter (reference)

**Note:** kept separate from Counter — a user clocking out shouldn't require
touching Counter's internals directly. It should emit an event like "staff
logged out" that Counter reacts to.

---

## Service Category Aggregate

**Root:** `ServiceCategory`

**Owns:**

- Definition
- Average duration
- Priority weighting

**Invariant enforced internally:** cannot be deleted while active tickets or
queues reference it.

---

## Not Aggregates: Notification & Audit Log

Neither enforces a consistency boundary the way Ticket, Queue, or Counter do.

- **Notification** has its own lifecycle (pending → sent → delivered/failed),
  but nothing else needs to stay consistent _with_ it. It's a reactive side
  effect of ticket events, not something that co-owns state with anything.
- **Audit Log** is append-only — a projection of everything that happened
  elsewhere, not a producer of invariants.

Both are consumers of domain events, not aggregates.

---

## The Underlying Pattern

- **Atomic, all-or-nothing operations** belong inside one aggregate.
- **Triggered-but-not-simultaneous operations** belong in domain events —
  freeing a Counter after a Ticket completes, sending a Notification after a
  status change, writing an Audit Log entry. A `TicketCompleted` event fires,
  and Counter, Notification, and Audit Log each react independently, on their
  own schedule.

That distinction — "owns consistency" vs. "just needs to know about a change
eventually" — is what keeps a backend from turning into one where updating a
single row requires locking six tables.
