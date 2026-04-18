# Phase 5: HR Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 05-hr-core
**Areas discussed:** Employee lifecycle, Org structure, Leave policy, Attendance policy

---

## Employee lifecycle

### Active roster timing

| Option                 | Description                                                            | Selected |
| ---------------------- | ---------------------------------------------------------------------- | -------- |
| Active on `hireDate`   | Employee may exist before start, but becomes active only on `hireDate` | X        |
| Active on creation     | Employee becomes active as soon as the record is created               |          |
| Manual activation step | Employee stays inactive until an explicit activation action            |          |
| Let the agent decide   | Delegate the timing choice to implementation                           |          |

**User's choice:** Employees can exist before `hireDate`, but only join the active roster on `hireDate`.

### Future-dated terminations

| Option                            | Description                                                      | Selected |
| --------------------------------- | ---------------------------------------------------------------- | -------- |
| Automatic on effective date       | Allow future-dated terminations and auto-transition on that date | X        |
| Same-day only                     | Require termination to happen immediately                        |          |
| Future-dated with manual finalize | Allow advance dating but require a later manual action           |          |
| Let the agent decide              | Delegate the behavior to implementation                          |          |

**User's choice:** Future-dated terminations should be supported and transition automatically on the effective date.

### Post-termination edits

| Option               | Description                                                    | Selected |
| -------------------- | -------------------------------------------------------------- | -------- |
| Limited cleanup only | Allow only notes/contact cleanup and lock lifecycle/org fields | X        |
| Everything editable  | Keep terminated employees fully editable                       |          |
| Nothing editable     | Lock the full record after termination                         |          |
| Let the agent decide | Delegate the editability rule to implementation                |          |

**User's choice:** After termination, only non-critical cleanup remains editable.

### Leave vs employee status

| Option                           | Description                                          | Selected |
| -------------------------------- | ---------------------------------------------------- | -------- |
| Keep `Employee.status` unchanged | Leave state stays separate from core employee status | X        |
| Auto-set `ON_LEAVE`              | Approved leave changes employee status automatically |          |
| Tenant-configurable              | Support both behaviors per tenant                    |          |
| Let the agent decide             | Delegate the relationship to implementation          |          |

**User's choice:** Approved leave should not change core employee status.

---

## Org structure

### Primary org chart contract

| Option                     | Description                                                                  | Selected |
| -------------------------- | ---------------------------------------------------------------------------- | -------- |
| Employee hierarchy first   | Primary org chart is employee-manager hierarchy; department tree is separate | X        |
| Department hierarchy first | Department tree is primary and employees are nested beneath it               |          |
| One merged tree            | Mix departments and employees into a single structure                        |          |
| Let the agent decide       | Delegate the contract choice to implementation                               |          |

**User's choice:** The primary org chart should represent employee reporting hierarchy.

### Department head rule

| Option                        | Description                                                            | Selected |
| ----------------------------- | ---------------------------------------------------------------------- | -------- |
| Optional same-department head | A department may have one optional head who belongs to that department | X        |
| Mandatory head                | Every department must always have a head                               |          |
| Cross-department head allowed | A head may belong to another department                                |          |
| Let the agent decide          | Delegate the rule to implementation                                    |          |

**User's choice:** Department heads are optional and must belong to their own department.

### Cross-department managers

| Option                                | Description                                   | Selected |
| ------------------------------------- | --------------------------------------------- | -------- |
| Allow cross-department reporting      | Employees may report outside their department | X        |
| Same-department only                  | Manager must belong to the same department    |          |
| Default same department with override | Same department by default, with HR override  |          |
| Let the agent decide                  | Delegate the rule to implementation           |          |

**User's choice:** Cross-department managers should be allowed.

### Backend read contract

| Option                                | Description                                                           | Selected |
| ------------------------------------- | --------------------------------------------------------------------- | -------- |
| Separate org and department contracts | One query/endpoint for employee org chart and one for department tree | X        |
| Combined org contract only            | One merged endpoint handles both structures                           |          |
| Department tree only                  | Department hierarchy ships now; employee org chart waits              |          |
| Let the agent decide                  | Delegate the contract to implementation                               |          |

**User's choice:** Phase 5 should expose separate read contracts for employee org chart and department tree.

---

## Leave policy

### Approval ownership

| Option                         | Description                                                    | Selected |
| ------------------------------ | -------------------------------------------------------------- | -------- |
| Manager-first with HR fallback | Direct manager approves by default; HR can override or step in | X        |
| HR-only approval               | HR approves all leave requests                                 |          |
| Department-head approval       | Department head approves all leave requests                    |          |
| Let the agent decide           | Delegate the approval model to implementation                  |          |

**User's choice:** Leave approval should be manager-first with HR fallback/override.

### Pending requests past start date

| Option                         | Description                                                           | Selected |
| ------------------------------ | --------------------------------------------------------------------- | -------- |
| Auto-cancel with system reason | Cancel immediately once the start date passes while still pending     | X        |
| Leave pending for cleanup      | Keep the request pending until someone resolves it                    |          |
| Auto-approve if balance exists | Automatically approve late pending requests when balance is available |          |
| Let the agent decide           | Delegate the handling to implementation                               |          |

**User's choice:** Pending requests should auto-cancel with a system reason once the start date passes.

### Approved leave cancellation rule

| Option                                    | Description                                                          | Selected |
| ----------------------------------------- | -------------------------------------------------------------------- | -------- |
| Restore only at 48h+ and reject otherwise | Full restoration when cancelled at least 48h early; otherwise reject | X        |
| Always allow, conditional restore         | Cancellation always allowed but restoration only happens at 48h+     |          |
| Always allow, always restore              | Cancellation and restoration always succeed                          |          |
| Let the agent decide                      | Delegate the cancellation rule to implementation                     |          |

**User's choice:** Approved leave cancellation should restore balance only when cancelled at least 48 hours before start; otherwise Phase 5 rejects it.

### Nightly accrual caps

| Option                      | Description                                                                          | Selected |
| --------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Cap nightly at `maxBalance` | Apply accrual nightly but never exceed `maxBalance`; handle carry-forward separately | X        |
| Allow overflow past cap     | Keep accruing past the cap and rely on HR cleanup                                    |          |
| Cap only at year-end        | Ignore the cap during nightly accrual and enforce it later                           |          |
| Let the agent decide        | Delegate the cap behavior to implementation                                          |          |

**User's choice:** Nightly accrual should stop at `maxBalance`, with `carryForwardLimit` enforced separately at year boundaries.

---

## Attendance policy

### Attendance capture shape

| Option                   | Description                                                                  | Selected |
| ------------------------ | ---------------------------------------------------------------------------- | -------- |
| One daily record         | One record per employee per day with clock-in/out, derived hours, and status | X        |
| Multiple punches per day | Support several in/out pairs from the start                                  |          |
| Status-only attendance   | Capture attendance state without real time data yet                          |          |
| Let the agent decide     | Delegate the capture model to implementation                                 |          |

**User's choice:** Attendance should use one record per employee per day.

### Overtime calculation

| Option                          | Description                                                      | Selected |
| ------------------------------- | ---------------------------------------------------------------- | -------- |
| System-derived overtime         | Calculate overtime from hours worked beyond a standard threshold | X        |
| Manual HR entry                 | HR enters overtime directly                                      |          |
| Manager-approved overtime entry | Overtime is stored only after manager approval                   |          |
| Let the agent decide            | Delegate the rule to implementation                              |          |

**User's choice:** Overtime should be calculated automatically from hours worked beyond a standard daily threshold.

### Missing clock-out handling

| Option                       | Description                                             | Selected |
| ---------------------------- | ------------------------------------------------------- | -------- |
| Keep incomplete, no guessing | Leave the record incomplete until manager/HR correction | X        |
| Auto-close at end of day     | Infer clock-out from scheduled day end                  |          |
| Auto-close after 8 hours     | Infer clock-out from a fixed eight-hour window          |          |
| Let the agent decide         | Delegate the fallback to implementation                 |          |

**User's choice:** Missing clock-out should remain incomplete; the system must not guess end times.

### Correction authority

| Option                     | Description                                                 | Selected |
| -------------------------- | ----------------------------------------------------------- | -------- |
| Manager and HR correction  | Both managers and HR may correct records, with auditability | X        |
| HR-only correction         | Only HR may fix attendance records after the fact           |          |
| No corrections after close | Attendance locks completely after day close                 |          |
| Let the agent decide       | Delegate correction authority to implementation             |          |

**User's choice:** Managers and HR may correct attendance records, and those changes must be auditable.

---

## the agent's Discretion

- Exact API route naming and DTO shape
- Standard daily overtime threshold
- Concrete queue names and job scheduling details
- Exact validation and error-message wording

## Deferred Ideas

None.
