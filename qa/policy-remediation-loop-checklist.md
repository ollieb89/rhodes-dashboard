# Policy Remediation Loop — QA Checklist

## Test run metadata

| Field | Value |
|---|---|
| Environment | |
| Build / commit | |
| Tester | |
| Date | |
| Start time | |

---

## Run order

1. Scenario 1 — Single clean trigger
2. Scenario 6 — Close rejection while signal still active
3. Scenario 7 — Force-close override
4. Scenario 2 — Threshold flapping
5. Scenario 3 — Repeated evidence same source
6. Scenario 4 — Cross-source duplicate trigger
7. Scenario 5 — Snooze expiry and re-review
8. Scenario 8 — Idle recovery after issue resolution

---

## Scenario 1 — Single clean trigger

**Goal:** Validate the happy path end to end.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Policy exists and is enabled | [ ] |
| P2 | No active review item exists for this policy/subject | [ ] |
| P3 | No open remediation task exists for this policy/subject | [ ] |
| P4 | No active snooze exists for this policy/subject | [ ] |
| P5 | Signal source is healthy and capable of producing fresh evidence | [ ] |
| P6 | Deduplication window does not already contain a matching active issue | [ ] |

### Setup

- Produce one clear threshold breach
- Keep the signal active long enough to satisfy persistence/debounce rules

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | Review item appears | [ ] Pass / [ ] Fail |
| 2 | Trigger evidence is visible from the review panel | [ ] Pass / [ ] Fail |
| 3 | Operator can accept the review | [ ] Pass / [ ] Fail |
| 4 | "Create task" option is available in accept flow | [ ] Pass / [ ] Fail |
| 5 | Linked task appears inline after creation | [ ] Pass / [ ] Fail |
| 6 | Close action is blocked while signal remains active | [ ] Pass / [ ] Fail |
| 7 | Normal close succeeds after signal clears | [ ] Pass / [ ] Fail |
| 8 | Final state is coherent with no orphaned active items | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | Trigger title is visible | [ ] Pass / [ ] Fail |
| U2 | Current value vs threshold is visible | [ ] Pass / [ ] Fail |
| U3 | Review state badge: **Pending** | [ ] Pass / [ ] Fail |
| U4 | Accept flow: **Create remediation task** | [ ] Pass / [ ] Fail |
| U5 | Inline task card shows title, priority, and status | [ ] Pass / [ ] Fail |
| U6 | While active: **Cannot close while signal is still active** | [ ] Pass / [ ] Fail |
| U7 | After clearance: **Closed** or **Resolved** | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | Exactly one review item created | [ ] Pass / [ ] Fail |
| B2 | Exactly one remediation task created (if checkbox selected) | [ ] Pass / [ ] Fail |
| B3 | Review item linked to created task | [ ] Pass / [ ] Fail |
| B4 | Active signal recorded while breach persists | [ ] Pass / [ ] Fail |
| B5 | Close attempt rejected while signal active | [ ] Pass / [ ] Fail |
| B6 | Close accepted after inactive condition satisfied | [ ] Pass / [ ] Fail |
| B7 | No duplicate task or review item created | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- Unexpected UI copy:
- State mismatches:

---

## Scenario 2 — Threshold flapping

**Goal:** Verify conservative handling of noisy oscillation near threshold.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Policy exists and is enabled | [ ] |
| P2 | No active review item exists for this policy/subject | [ ] |
| P3 | No open remediation task exists for this policy/subject | [ ] |
| P4 | No lingering forced-close or snooze state from earlier runs | [ ] |
| P5 | Flapping inputs can be generated around the configured threshold | [ ] |
| P6 | Persistence/debounce settings are known before starting | [ ] |

### Setup

- Alternate signal above and below threshold several times over a short interval
- Keep amplitude close enough to resemble real flapping, not a clean binary switch

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | No burst of duplicate review items | [ ] Pass / [ ] Fail |
| 2 | No burst of duplicate remediation tasks | [ ] Pass / [ ] Fail |
| 3 | Review state remains understandable throughout | [ ] Pass / [ ] Fail |
| 4 | System does not rapidly close and reopen the issue | [ ] Pass / [ ] Fail |
| 5 | Final close only occurs after inactive condition is truly satisfied | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | Trigger remains identifiable as one issue, not many | [ ] Pass / [ ] Fail |
| U2 | Review/task state remains visually stable | [ ] Pass / [ ] Fail |
| U3 | If close blocked: **Signal still active** | [ ] Pass / [ ] Fail |
| U4 | UI does not imply multiple independent incidents | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | At most one canonical active review item | [ ] Pass / [ ] Fail |
| B2 | At most one open remediation task | [ ] Pass / [ ] Fail |
| B3 | Evidence accumulates but issue identity remains stable | [ ] Pass / [ ] Fail |
| B4 | No oscillating close/open churn without true state transition | [ ] Pass / [ ] Fail |
| B5 | Deduplication suppresses duplicate task creation | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- Duplicate artifacts created?:
- Any churn in state transitions?:

---

## Scenario 3 — Repeated evidence for the same issue

**Goal:** Validate dedupe and evidence accumulation for one underlying issue.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Policy exists and is enabled | [ ] |
| P2 | One prior trigger for this issue exists as the canonical issue under test | [ ] |
| P3 | No more than one active review item exists for the policy/subject | [ ] |
| P4 | If a remediation task exists, it is linked and open | [ ] |
| P5 | Deduplication keying logic is known well enough to hit the same issue identity | [ ] |

### Setup

- Emit repeated qualifying evidence for the same issue over time from the same source
- Do not change the underlying condition enough to make it a truly distinct incident

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | Existing review item is reused or clearly updated | [ ] Pass / [ ] Fail |
| 2 | Existing task is reused/surfaced, not duplicated | [ ] Pass / [ ] Fail |
| 3 | Evidence updates without creating parallel remediation paths | [ ] Pass / [ ] Fail |
| 4 | Operator can tell this is the same issue recurring, not a new issue | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | Existing linked task remains visible inline | [ ] Pass / [ ] Fail |
| U2 | Review/task panel reflects continued activity for the same issue | [ ] Pass / [ ] Fail |
| U3 | Evidence affordance shows fresh supporting evidence | [ ] Pass / [ ] Fail |
| U4 | UI does not suggest a second independent remediation task is required | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | No second remediation task created for same issue | [ ] Pass / [ ] Fail |
| B2 | No parallel active review item created for same issue | [ ] Pass / [ ] Fail |
| B3 | Evidence/log history grows correctly | [ ] Pass / [ ] Fail |
| B4 | Canonical issue identity remains stable across repeated evidence | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- Evidence trail quality:
- Any duplicate review/task IDs?:

---

## Scenario 4 — Cross-source duplicate trigger

**Goal:** Ensure issue-level dedupe across different evidence sources.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Policy exists and is enabled | [ ] |
| P2 | Two distinct evidence channels/sources are available | [ ] |
| P3 | No active duplicate review items exist for the target issue | [ ] |
| P4 | No open remediation task exists (unless testing merge-into-existing) | [ ] |
| P5 | Mapping between both sources and the same policy/subject is valid | [ ] |

### Setup

- Trigger the same underlying issue from two different sources
- Keep timestamps close enough that the system should recognize a shared incident

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | One remediation path is presented | [ ] Pass / [ ] Fail |
| 2 | Evidence from both sources remains accessible | [ ] Pass / [ ] Fail |
| 3 | No conflicting review decisions across duplicate records | [ ] Pass / [ ] Fail |
| 4 | No separate remediation tasks created for the same issue | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | One visible issue state, or two clearly merged records leading to one task | [ ] Pass / [ ] Fail |
| U2 | Evidence affordance makes both sources discoverable | [ ] Pass / [ ] Fail |
| U3 | Inline task card remains singular, not duplicated | [ ] Pass / [ ] Fail |
| U4 | UI does not imply independent operator action is needed twice | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | One canonical issue identity | [ ] Pass / [ ] Fail |
| B2 | One open remediation task at most | [ ] Pass / [ ] Fail |
| B3 | Both evidence sources recorded against that issue | [ ] Pass / [ ] Fail |
| B4 | No divergent lifecycle state across source-specific duplicates | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- How were sources represented?:
- Any split-brain review/task state?:

---

## Scenario 5 — Snooze expiry and re-review

**Goal:** Validate that snoozed items return cleanly to actionable review.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Policy exists and is enabled | [ ] |
| P2 | Active review item exists for the target issue | [ ] |
| P3 | Signal remains active or can be kept active past snooze expiry | [ ] |
| P4 | No terminal closed/dismissed state has already been applied | [ ] |
| P5 | Snooze duration is configurable and short enough to test promptly | [ ] |

### Setup

- Snooze the active item with a short expiry
- Allow snooze to expire while the signal remains active

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | Snoozed badge/state is immediately visible | [ ] Pass / [ ] Fail |
| 2 | Snooze expiry time is visible | [ ] Pass / [ ] Fail |
| 3 | Item returns to actionable review after expiry | [ ] Pass / [ ] Fail |
| 4 | No duplicate remediation task is created | [ ] Pass / [ ] Fail |
| 5 | Operator can tell it is resumed, not brand new | [ ] Pass / [ ] Fail |
| 6 | No silent disappearance occurs | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | Badge: **Snoozed** | [ ] Pass / [ ] Fail |
| U2 | Expiry: **Until [timestamp]** | [ ] Pass / [ ] Fail |
| U3 | After expiry: **Pending review** or **Action required** | [ ] Pass / [ ] Fail |
| U4 | If task already exists, inline task remains attached | [ ] Pass / [ ] Fail |
| U5 | UI does not suggest a net-new issue was created | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | Snooze state stored with expiry | [ ] Pass / [ ] Fail |
| B2 | On expiry, review transitions back to actionable state | [ ] Pass / [ ] Fail |
| B3 | Existing linked task remains linked | [ ] Pass / [ ] Fail |
| B4 | No duplicate review item created solely due to snooze expiry | [ ] Pass / [ ] Fail |
| B5 | Active signal continuity preserved | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- Did expiry reactivate cleanly?:
- Any duplicate objects after expiry?:

---

## Scenario 6 — Close rejection while signal still active

**Goal:** Test the most important conservative safeguard.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Policy exists and is enabled | [ ] |
| P2 | Review item has been accepted | [ ] |
| P3 | Linked remediation task exists and is visible | [ ] |
| P4 | Signal is currently active by system rules | [ ] |
| P5 | Close action is available from the operator UI | [ ] |
| P6 | No force-close has already been applied to this issue | [ ] |

### Setup

- Attempt normal close while active evidence still satisfies the trigger condition

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | Normal close is rejected | [ ] Pass / [ ] Fail |
| 2 | Rejection reason is visible and understandable | [ ] Pass / [ ] Fail |
| 3 | Active-signal explanation is surfaced inline | [ ] Pass / [ ] Fail |
| 4 | No partial or hidden close state is applied | [ ] Pass / [ ] Fail |
| 5 | Force-close affordance appears only in rejection context | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | **Close rejected** | [ ] Pass / [ ] Fail |
| U2 | **Signal still active** | [ ] Pass / [ ] Fail |
| U3 | **Cannot close while trigger condition remains active** | [ ] Pass / [ ] Fail |
| U4 | Current evidence or active-state rationale is visible | [ ] Pass / [ ] Fail |
| U5 | Force-close affordance: **Force close (operator override)** | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | Normal close operation rejected | [ ] Pass / [ ] Fail |
| B2 | Review/task state remains open/active after rejection | [ ] Pass / [ ] Fail |
| B3 | Rejection reason is logged or audit-visible | [ ] Pass / [ ] Fail |
| B4 | No hidden terminal state mutation occurs | [ ] Pass / [ ] Fail |
| B5 | Force-close is not auto-applied | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- Exact rejection copy:
- Did any state mutate despite rejection?:

---

## Scenario 7 — Force-close override

**Goal:** Confirm override is explicit, auditable, and does not poison future lifecycle handling.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Scenario 6 state is present or reproducible | [ ] |
| P2 | Issue is still active by policy logic | [ ] |
| P3 | Normal close has been or would be rejected | [ ] |
| P4 | Operator has permission to perform override | [ ] |
| P5 | Audit logging is enabled and inspectable | [ ] |

### Setup

- Invoke the force-close override from the UI

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | Override is visually distinct from normal close | [ ] Pass / [ ] Fail |
| 2 | Override succeeds only when explicitly chosen | [ ] Pass / [ ] Fail |
| 3 | Audit trail records the override | [ ] Pass / [ ] Fail |
| 4 | Final state is clearly marked as forced/override-based | [ ] Pass / [ ] Fail |
| 5 | Future re-triggering still works if evidence reappears | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | **Force close (operator override)** | [ ] Pass / [ ] Fail |
| U2 | Confirmation or warning text indicating override behavior | [ ] Pass / [ ] Fail |
| U3 | Final badge: **Force-closed** or **Closed by override** | [ ] Pass / [ ] Fail |
| U4 | UI does not present result as a normal clean resolution | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | Terminal state recorded as override-based, not normal close | [ ] Pass / [ ] Fail |
| B2 | Audit record includes operator and timestamp | [ ] Pass / [ ] Fail |
| B3 | Linked task/review state remains historically traceable | [ ] Pass / [ ] Fail |
| B4 | Later evidence can still create or reactivate a valid issue lifecycle | [ ] Pass / [ ] Fail |
| B5 | Prior forced state does not block future valid re-triggering | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- Audit trail result:
- Could the issue re-trigger afterward?:

---

## Scenario 8 — Idle recovery after issue resolution

**Goal:** Verify clean return to steady state after genuine remediation.

### System state preconditions

| # | Precondition | Verified |
|---|---|---|
| P1 | Policy exists and is enabled | [ ] |
| P2 | Accepted review item exists | [ ] |
| P3 | Linked remediation task exists | [ ] |
| P4 | Signal is currently or was recently active | [ ] |
| P5 | Remediation can be applied such that the signal genuinely clears | [ ] |
| P6 | No forced-close state is being used for this scenario | [ ] |

### Setup

- Complete remediation
- Ensure signal clears by policy rules
- Attempt normal close after system recognizes inactivity

### Pass/fail

| # | Check | Result |
|---|---|---|
| 1 | Normal close succeeds | [ ] Pass / [ ] Fail |
| 2 | Final state is visually unambiguous | [ ] Pass / [ ] Fail |
| 3 | No orphaned pending review remains | [ ] Pass / [ ] Fail |
| 4 | No orphaned active-signal marker remains | [ ] Pass / [ ] Fail |
| 5 | No spurious retrigger occurs without new evidence | [ ] Pass / [ ] Fail |
| 6 | System settles back to idle without manual cleanup | [ ] Pass / [ ] Fail |

### Expected UI strings

| # | Expected semantic content | Result |
|---|---|---|
| U1 | Final badge: **Closed**, **Resolved**, or **Auto-closed** | [ ] Pass / [ ] Fail |
| U2 | No lingering **Signal still active** | [ ] Pass / [ ] Fail |
| U3 | Task status is coherent with completed remediation | [ ] Pass / [ ] Fail |
| U4 | Review panel no longer appears actionable | [ ] Pass / [ ] Fail |

### Expected backend/state outcomes

| # | Outcome | Result |
|---|---|---|
| B1 | Close accepted normally | [ ] Pass / [ ] Fail |
| B2 | Issue lifecycle reaches coherent terminal state | [ ] Pass / [ ] Fail |
| B3 | Active signal cleared | [ ] Pass / [ ] Fail |
| B4 | No pending review left behind | [ ] Pass / [ ] Fail |
| B5 | No duplicate reopen without fresh evidence | [ ] Pass / [ ] Fail |
| B6 | No manual DB correction required to reach steady idle state | [ ] Pass / [ ] Fail |

### Notes / deviations

- Observed behavior:
- Did system return to idle cleanly?:
- Any zombie state left behind?:

---

## Cross-scenario deviation log

### Critical failures (any one = loop not robust)

| # | Failure pattern | Observed |
|---|---|---|
| C1 | Duplicate remediation task created for one underlying issue | [ ] Yes / [ ] No |
| C2 | Normal close succeeded while signal was still active | [ ] Yes / [ ] No |
| C3 | Snoozed issue disappeared without re-review | [ ] Yes / [ ] No |
| C4 | Forced close was not auditable | [ ] Yes / [ ] No |
| C5 | Review / task / signal states disagreed about reality | [ ] Yes / [ ] No |
| C6 | Manual DB cleanup required to continue testing | [ ] Yes / [ ] No |

### Soft failures (addressable before next pass)

| # | Failure pattern | Observed |
|---|---|---|
| S1 | UI explanation was technically correct but unclear | [ ] Yes / [ ] No |
| S2 | Evidence was present but hard to access | [ ] Yes / [ ] No |
| S3 | State badges were accurate but visually ambiguous | [ ] Yes / [ ] No |
| S4 | Repeated evidence handling was correct but confusing | [ ] Yes / [ ] No |
| S5 | Final resolved state remained noisy in UI | [ ] Yes / [ ] No |

### Notes

- Patterns observed across tests:
- Likely root causes:
- Recommended fixes:

---

## Exit criteria

Mark complete only if **all** are true:

| # | Criterion | Met |
|---|---|---|
| E1 | Zero duplicate tasks in scenarios 2-4 | [ ] |
| E2 | Zero accidental normal closure in scenarios 2, 4, or 6 | [ ] |
| E3 | Snooze expiry always returns to a clear actionable state | [ ] |
| E4 | Force-close is always visually distinct and auditable | [ ] |
| E5 | Every failed close attempt gives a concrete operator-readable reason | [ ] |
| E6 | Every scenario ends in a coherent final state without manual DB cleanup | [ ] |

**Result:** [ ] PASS - loop is robust enough for next step &nbsp;&nbsp;&nbsp; [ ] FAIL - see deviation log

---

*Generated: policy-remediation-loop-checklist.md*
