## Why

The agent layer can operate individual controls — toggle a switch, pick an option, invoke a named action — but it cannot answer a realistic request like:

> *"All orders created before 11.09.2025, mine, approved by SomeUser@email.com, assigned to my unit. Export as Excel."*

Four things block it. `FilterAction.filter` is an untyped `Record<string, unknown>`, so the agent must guess field names and operators from page prose and nothing can be validated before it runs. There is no way to express "mine" or "my unit" without the agent learning the user's identity. There is no way to turn `SomeUser@email.com` into the user reference the filter actually needs. And an expensive, artifact-producing operation like an export has only two possible outcomes today — run it, or ask and then run it — when the right behaviour is to prepare it and hand the trigger to the user.

This is the difference between an agent that operates widgets and one that does a user's work.

## What Changes

- **BREAKING** — `FilterAction.filter` becomes a typed predicate tree instead of an untyped object. A target declares a *query schema* (fields, types, operators, enum values, reference targets) and the agent fills that schema. Unknown fields and invalid operators fail validation before anything executes, and the failure names what is valid.
- Query-capable targets publish their schema in the agent-readable state, so the agent reads what is filterable rather than inferring it.
- A predicate is renderable: the same tree drives the visible filter UI and the agent's action, so a human can see, correct and extend whatever the agent built. The agent never writes a query language.
- Values inside a predicate may be **unresolved references** rather than literals — `{ $context: "current-user" }` or `{ $lookup: { entity: "user", by: "email", value: "..." } }`. The application resolves them; the agent never learns the user's identity, and a failed lookup is a typed error rather than a wrong result.
- Ambiguous literals — notably dates like `11.09.2025` — resolve through a declared format and surface their interpretation in the confirmation preview, so the user sees `11 September 2025` before acting on it.
- A new action outcome, **staged**, sits alongside execute and confirm-then-execute. The agent prepares an operation and hands the trigger to the user. This becomes the default for operations declared as expensive, long-running, or artifact-producing — such as an export.
- Declared actions may accept typed parameters, so `orders.export` can take the predicate the agent just built.

## Capabilities

### New Capabilities

- `agent-query-schema`: how a target declares what is queryable, the typed predicate tree the agent emits against it, validation before execution, and the requirement that one predicate model serves both the visible filter UI and the agent.
- `agent-value-resolution`: unresolved value references inside a predicate — context variables such as the current user and their unit, directory lookups such as email to user reference, and ambiguous literal interpretation — resolved by the application and surfaced to the user.
- `agent-staged-actions`: the staged action outcome, which operations declare it, how a staged operation is presented to the user, and what happens when the underlying state changes before the user triggers it.

### Modified Capabilities

None. `openspec/specs/` is empty; this is the first change to carry specs.

## Impact

**Agent protocol** — `FilterAction` changes shape (breaking). `AgentActionResult` gains a staged outcome. `AgentElementState` gains a query schema. `AgentDeclaredAction` gains typed parameters. All in `src/agent/types/`.

**Agent core** — validation in `src/agent/core/registry.ts` must check predicates against schemas and resolve value references before the write. `src/agent/core/preview.ts` must render a predicate and its resolved values as a readable diff. `src/agent/core/runtime.ts` gains the staged lifecycle branch.

**Design system** — `DataTable` moves from `filter`/`validateFilter` to a declared query schema. A filter-builder surface is needed so a predicate is visible and editable by a human.

**Reference application** — the accounts table becomes query-schema driven, and gains an export to exercise staging end to end. The orders scenario from the exploration becomes the acceptance test.

**Documentation** — `docs/agent/actions.md` and `docs/agent/state.md` describe the new shapes; a new document covers query schemas and value resolution.

**Non-goals** — deliberately deferred: the static capability manifest and build-time drift detection; role-filtered capability discovery; the entity/page/element capability tiers as a formal model; any headless (non-UI) execution path. This change makes one page's query capability work properly before generalising it across an application.
