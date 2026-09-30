# Actions

`AgentAction` is a discriminated union in `src/agent/types/actions.ts`. Every
action carries a `target` (a semantic id), an optional `reason` (shown verbatim
in confirmation previews) and an `ActionSource`.

## The set

| Type | Capability | Meaning |
| --- | --- | --- |
| `navigate` | `navigate` | Go to a semantic route. Handled by the host router, not an element. |
| `open-dialog` / `close-dialog` | `open` / `close` | Open or close a registered dialog. |
| `set-value` | `write` | Write an arbitrary value. |
| `toggle` | `write` | Set a boolean; omit `value` to flip the current one. |
| `select-option` | `write` | Choose one of the target's published options. |
| `check` / `uncheck` | `write` | Booleans, spelled for checkboxes. |
| `search` | `write` | Write a query string. |
| `filter` | `write` | Write a structured filter object. |
| `submit` | `submit` | Submit a form or committing control. |
| `focus` | `focus` | Scroll to, spotlight **and** focus. |
| `reveal` / `scroll-to` | `focus` | Scroll to and spotlight without taking focus. |
| `invoke` | `invoke` | Run a page-declared named action. |

`search`, `filter`, `toggle`, `check`, `uncheck` and `select-option` are all
normalised to a single target value before the write, so a component only ever
implements `read` and `write`.

## Results

```ts
const result = await context.execute({ type: "toggle", target: "notifications.email", value: false });

result.success       // did the application actually do it
result.status        // succeeded | failed | cancelled
result.value         // the value observed AFTER the write
result.previousValue // what it was before
result.error?.code   // machine-readable failure
result.undo?.()      // present only when genuinely reversible
```

`execute` never throws for a rejected action. Failure is data.

## Error codes

| Code | Cause | What the agent should do |
| --- | --- | --- |
| `unknown-target` | No such id is registered. | Re-read state; the control may be on another screen. |
| `capability-unsupported` | Target does not implement that capability. | Choose a different action. |
| `target-disabled` | Control is disabled. | Explain why, do not retry. |
| `invalid-value` | Failed the target's own `validate`, or not an offered option. | Use the option list in the message. |
| `state-not-confirmed` | Write ran, application state did not change. | Report the failure. Never claim success. |
| `cancelled` | The user declined. | Accept it and move on. |
| `execution-failed` | The handler threw. | Report the application's error. |
| `unsupported-action` | No navigation delegate, or unknown type. | Report the limitation. |

## Extending the protocol

`AgentActionMap` is an interface, so application code adds action types by
declaration merging and keeps a correctly discriminated union:

```ts
declare module "@agent/types/actions" {
  interface AgentActionMap {
    "export-csv": AgentActionBase & { type: "export-csv"; target: string; scope: "all" | "filtered" };
  }
}
```

Prefer `invoke` with a declared page action first. Add a new action type only
when the shape is genuinely reusable across pages.
