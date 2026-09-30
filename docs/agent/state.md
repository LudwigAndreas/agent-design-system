# Agent-readable state

`registry.getReadableState()` returns `AgentReadableState`: a semantic snapshot
of the UI. No DOM nodes, no class names, no element ids — only what the
application chose to publish.

```ts
{
  route: "settings.notifications",
  page: { id, title, description, context, actions, suggestions },
  pages: [ /* every mounted context, innermost last */ ],
  elements: [
    {
      id: "notifications.email",
      label: "Email notifications",
      description: "Controls whether email notifications are enabled.",
      role: "switch",
      value: true,
      state: "on",
      visible: true,
      enabled: true,
      capabilities: ["read", "write", "focus", "navigate"],
      page: "settings.notifications"
    }
  ],
  dialogs: [{ id: "dialog.delete-accounts", open: false, title: "Delete 3 accounts?" }],
  notifications: [ /* what the user can currently see */ ],
  routes: [ /* where navigation is permitted */ ],
  capturedAt: 1735603200000
}
```

## Freshness is the point

Two rules follow from the fact that a human is using the same UI at the same
time:

1. `context.state` is a snapshot taken at turn start. Treat it as history.
2. Call `context.getState()` after every action, and before any decision that
   depends on current values. The runtime also emits `state-changed` with a
   fresh snapshot after every action, tagged with the cause.

```ts
const result = await context.execute({ type: "toggle", target: "notifications.email", value: false });
const now = context.getState();     // ← correct
const stale = context.state;        // ← a lie by this point
```

This is the synchronisation requirement: if the user manually disables dark mode
while the agent is enabling it, the agent finds out because it re-reads a single
source of truth instead of remembering what it asked for.

## Live values

`AgentElementState` is computed on demand. `value` comes from the target's
`read` handler, and `visible`/`enabled`/`options`/`state`/`data` come from its
`getState`. Nothing is cached, so a snapshot can never disagree with the UI.

`data` is free-form and application-defined. The accounts table uses it to
publish row ids, the selection and the column list — the things an agent needs
to act on a table — while publishing none of the rendered markup.

## Subscribing from React

```ts
const state = useAgentState();  // recomputed when the registry version changes
```

Backed by `useSyncExternalStore`, so it cooperates with React rendering rather
than polling.
