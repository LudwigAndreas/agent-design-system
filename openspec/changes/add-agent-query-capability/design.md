## Context

See proposal.md — Why, for motivation, and the three capability specs for the behaviour contract.

The constraints that shape the approach:

- The agent layer already has a registry of semantic targets, a typed action protocol, a validate → policy → confirm → execute → verify lifecycle, and the rule that a write is never reported as successful until re-read from application state. This change extends that machinery rather than adding a parallel one.
- `DataTable` already publishes its filter as its agent-readable *value* and accepts a `filter` action to write it. The verification loop therefore already works for queries — what is missing is any description of what a valid filter is.
- Nothing in `src/agent` or `src/design-system` may import a vendor SDK, and the agent must never receive identity or directory data it does not need.
- Target ids are a public API; saved automations depend on them.

## Goals / Non-Goals

**Goals:**

- One predicate model shared by the agent, the visible query UI and the application's own query execution.
- Validation and reference resolution that fail *before* any state change, with errors specific enough for the agent to correct itself.
- A staged outcome that reuses the existing action lifecycle rather than introducing a second one.
- Schema authoring cheap enough to be plausible across many tables.

**Non-Goals:**

- A general query-builder UI. A readable, removable chip per condition is enough to satisfy the "user can see and amend" requirement.
- Nested entity traversal in predicates (`order.customer.country`). Flat fields only.
- Server-side query execution. The reference application resolves and filters in memory; the shape must not *prevent* a server implementation, but proving one is out of scope.

## Decisions

### A structured predicate, not a query string

The agent emits a predicate tree of field comparisons and logical combinators. The application compiles it to whatever its data layer wants — OData, SQL, an in-memory filter.

*Alternatives considered.* Letting the agent emit an OData `$filter` string directly is far less work and more expressive. Rejected: a string cannot be validated against a schema before execution, hallucinated field names surface as runtime errors rather than correctable rejections, there is nothing to render back into the UI, and accepting model-authored query text is an injection surface. The expressiveness lost is real but is mostly expressiveness we do not want the agent to have.

*Alternative also considered.* A flat `Record<field, value>` map — simpler, but cannot express "created before X" versus "created on X", and cannot express disjunction at all. The orders scenario needs operators.

### The target's value *is* the predicate

A query-capable target continues to publish its current query as its agent-readable value, and `filter` continues to be the write. This means post-write verification, undo, and the "report what actually happened" guarantee all come for free from the existing registry pipeline.

*Alternative considered.* A separate `query` action type with its own result shape. Rejected: it would duplicate the verification machinery, and it would let a query be applied without the registry observing the result.

### Schema validation first, resolution second

Execution order is: validate the predicate's *shape* against the schema (no I/O), then resolve any value references (may be asynchronous), then type-check resolved values, then write, then verify.

Shape validation first means a malformed predicate never triggers a directory lookup. Resolution before the write means a partially resolved predicate is never applied — which the value-resolution spec requires.

### Resolution is the application's job, declared as a capability

The application registers resolvers: context references (`current-user`, `current-user-unit`) and entity lookups (`user` by `email`). The agent sees the *names and types* of what can be resolved, never the resolved values. The resolved **label** is returned for display — so the user can see *who* `SomeUser@email.com` matched — while the resolved identifier stays inside the application.

*Alternative considered.* Letting the agent resolve by calling a lookup action first, then embedding the literal id. Rejected: it puts user identifiers into the transcript and the model's context for no benefit, and it makes every query two round trips.

### Staged is a lifecycle status, not a separate mechanism

`staged` joins the existing `AgentActionStatus` union, and the runtime gains one branch: an operation declared as staging returns a staged result instead of invoking the handler. The staged operation is held by the runtime and rendered in the transcript as a block with a trigger, in the same position the confirmation preview occupies.

Policy and staging compose: an operation may require confirmation *and* stage. Confirmation gates the preparation; the trigger gates the work.

*Alternative considered.* Modelling staging as "confirmation that never auto-executes". Rejected: confirmation is a question with a yes/no answer and a bounded lifetime, whereas a staged operation is an object that persists, goes stale, and may be discarded. Conflating them would make staleness meaningless.

### Staleness by fingerprint over resolved inputs

When an operation is staged, the runtime records a fingerprint of the *resolved* inputs — the predicate after resolution, plus the target's observed value. At trigger time it recomputes. A difference marks the operation stale.

Fingerprinting resolved inputs rather than arbitrary application state keeps false positives down: an unrelated change elsewhere in the app must not invalidate a prepared export. The known gap is that data can change underneath an unchanged query — a record added server-side between staging and triggering is not detected. Accepted: the spec requires running against current state on trigger, so the artifact is correct even when the staged count was stale.

### Export is one function with two entry points

The export button and the agent's staged export call the same application function with the same predicate. There is no agent-only export path, so there is one permission check and one audit entry.

This is the pragmatic reading of "the UI is the API": the agent operates visible UI for anything the user should see, and a domain capability may be reached by either the button or the agent — but never by a second implementation.

### Schemas derive from column definitions where possible

A table already declares its columns. The query schema should default from them — id, label, and an inferred type — so the author writes only what cannot be inferred: operators beyond the type default, enum values, and reference targets.

Authoring cost is the thing most likely to kill this at scale, so the default must be useful and the override must be local.

## Risks / Trade-offs

- **Schema authoring burden across many tables** → defaults derived from column definitions; a table with no explicit schema is simply not queryable, which is a safe default rather than a broken one.
- **The agent builds a valid but far too broad query, and the user exports 400,000 rows** → the matching count is shown before the export is staged, and export stages rather than executes, so the user sees the number before any work happens.
- **Directory lookup leaks personal data into the model's context** → only the resolved display label is returned, never the identifier or record; ambiguous matches report a count, not a list of candidates.
- **Locale-ambiguous dates silently resolve the wrong way** → the application declares its interpretation, and the resolved date is always rendered with a named month wherever the user is asked to confirm or trigger.
- **Staleness fingerprinting produces false positives and users learn to ignore the warning** → fingerprint covers only resolved inputs and the target's own value, not unrelated state.
- **Breaking the filter action breaks existing callers** → the only callers are in this repository; they are migrated in the same change. No deprecation window is offered, and the type change makes every call site a compile error rather than a silent behaviour change.
- **A predicate model that cannot express a real query is worse than none** → the orders scenario is the acceptance test, and it exercises comparison operators, conjunction, a context reference, a directory lookup and an ambiguous date in one request.

## Migration Plan

1. Land the predicate and resolution types alongside the existing untyped `filter`, so both compile.
2. Move `DataTable` to the declared schema; the untyped path becomes unreachable.
3. Remove the untyped `filter` shape and `validateFilter`. Every call site is a compile error and is fixed in the same step.
4. Update the agent documentation and the design-system page in the same change, so the reference surfaces never describe a shape that no longer exists.

Rollback is a revert: nothing persists a predicate across sessions yet, so there is no stored data in the old shape to migrate.

## Open Questions

- Whether enumerated fields with large value sets should publish their values lazily rather than inline in the schema. Only matters past a few dozen values; does not change the schema's shape.
- Whether a staged operation should survive a page navigation, or be discarded when the view it was prepared against unmounts. Discarding is the simpler default and is assumed; persistence can be added without changing the staged contract.
