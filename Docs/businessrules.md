# Business Rules — Queue Management System

## 1. Validation Rules
*Prevent invalid actions. Checked before an action is allowed to proceed.*

- A customer may only have one active ticket per branch.
- A completed ticket cannot be modified.
- A voided ticket cannot be restored.
- A counter serves one ticket at a time.
- A closed queue rejects new tickets.
- A service category cannot be deleted while active tickets or queues reference it.
- A customer cannot cancel a ticket already In Service.
- A branch cannot open a queue for a service category it doesn't offer.
- A counter cannot open unless authorized for at least one active service category.
- A manual override write is rejected without a reason string.

## 2. State Transition Rules
*Define the legal lifecycle. Become the state machine.*

- A ticket cannot move directly from Waiting to Completed.
- Only a teller can move a ticket from Called to In Service.
- A counter cannot call another ticket while Serving.
- A queue cannot close while tickets remain waiting, unless they're reassigned or cancelled first.
- A transferred ticket must re-enter Waiting in a different queue — it cannot sit unassigned.
- A no-show ticket returns to Waiting unless it has exhausted its recall attempts, in which case it moves to Voided.
- Closing a branch cascades its queues and counters to Closed.

## 3. Permission Rules
*Answer "who is allowed to do this?" Become authorization.*

- Only a receptionist or supervisor may void a ticket.
- Only a teller can start service.
- Only supervisors may force-close queues or counters.
- Only administrators may delete service categories or modify system-wide configuration.
- Only authorized counters may serve a given service category.
- Only the customer who holds a ticket (or staff acting on their behalf) may cancel it.

## 4. Automation Rules
*Happen automatically. Become background jobs or domain events.*

- Queue numbers reset on a schedule (see Configuration).
- Overflow activates automatically when queue length crosses a configured threshold.
- Closing a counter automatically requeues any ticket still in Called.
- Closing a branch automatically closes all its queues.
- Wait-time estimates recalculate automatically whenever queue position changes.
- Failed notifications retry automatically per the configured retry policy.
- A ticket's no-show timer automatically triggers the Called → No Show transition on expiry.

## 5. Audit Rules
*Define accountability. Banks care enormously about these.*

- Every ticket state transition is audited.
- Every manual override requires a reason.
- Audit logs are immutable — never edited or deleted, even by an administrator.
- Deleting an entity never removes its audit history.

## 6. Business Policy Rules
*Not technical. Business decisions. Configurable — management could change these without touching architecture.*

- Priority customers cannot skip more than a configured number of standard customers in a row.
- No-show tickets may be recalled up to a configured maximum before voiding.
- Branches operate within configured hours, except for tickets already in progress.
- Limited Service disables only the specific service categories affected, per configuration.
- Notifications aren't sent for voided tickets that never left Waiting — itself a configurable behavior, not a hardcoded exclusion.

---

## Configuration
*The settings behind the policy rules above, separated out so they can change per branch/deployment without code changes.*

| Setting | Example default |
|---|---|
| Overflow threshold | 30 waiting tickets |
| Maximum recall attempts before void | 2 |
| Priority skip limit | 3 standard tickets |
| No-show timer duration | 2–3 minutes |
| Requeue offset | +5 positions |
| Notification retry count | 1 |
| Branch operating hours | per branch |
| Queue number reset schedule | daily |

---

## Invariants
*Always true. The backend should never allow these to be violated — ideally enforced structurally (schema constraints, foreign keys) rather than only checked in application code.*

- A ticket belongs to exactly one queue at any given moment.
- A ticket belongs to exactly one service category.
- A counter serves at most one ticket at a time.
- A queue belongs to exactly one branch.
- A completed ticket has a completion timestamp.
- A voided ticket has a reason and an actor recorded.
- An audit log entry, once written, never changes.
- Every ticket has exactly one owning customer.

**Validation rule vs. invariant:** a validation rule is checked *before* an action proceeds ("can this transition happen right now?"). An invariant is a structural guarantee that must hold *after* every operation, regardless of which code path got there — which is why invariants are often better enforced at the database/schema level (NOT NULL, foreign keys, unique constraints) than trusted to application-level `if` checks scattered across the service layer.
