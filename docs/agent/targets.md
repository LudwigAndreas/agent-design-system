# Semantic targets

A target is a piece of UI with a stable semantic identity. The agent reasons
about `notifications.email`, never `#switch-2948` or `div:nth-child(4)`.

## Authoring

Shorthand:

```tsx
<Switch agentId="notifications.email" label="Email notifications" checked={on} onCheckedChange={set} />
```

Full metadata:

```tsx
<Input
  agent={{
    id: "profile.email",
    description: "Primary email address and login identity",
    capabilities: ["read", "write"],
    sensitive: true,
    requiresConfirmation: true,
  }}
  label="Email address"
  value={email}
  onValueChange={(next, meta) => setEmail(next, meta.source)}
/>
```

Both forms resolve through `resolveAgentMeta`, which fills `label`,
`description` and `role` from the component's own props. A component with no
`agentId` and no `agent` registers nothing at all.

None of this is rendered. Agent metadata is infrastructure; the user sees a
switch with a label.

## Naming

- Dotted, `area.thing`: `notifications.email`, `accounts.status-filter`.
- Kebab-case within a segment: `security.two-factor`.
- Stable across refactors. An id is an API. Changing one breaks saved
  conversations, docs and any evaluation suite.
- Unique. The registry warns in development when an id is registered twice.

## Capabilities come from handlers

`resolveCapabilities` derives the capability set from the handlers a target
actually supplied, then narrows it by any explicit `capabilities` list. A
component cannot advertise `write` without implementing it — asking for it is
silently dropped rather than trusted.

`useAgentTarget` always supplies a default `focus` and `reveal`, so every target
can be brought to the user's attention.

## Writing a new agent-controllable component

```tsx
export function Stepper({ value, onValueChange, agentId, agent, label, min, max }: StepperProps) {
  const meta = resolveAgentMeta({ agentId, agent }, { label, role: "spinbutton" });

  const { ref, targetProps } = useAgentTarget<number, HTMLDivElement>({
    ...meta,
    handlers: {
      read: () => value,
      // The agent's write goes through the same callback a click uses.
      write: (next) => onValueChange?.(next, AGENT_CHANGE),
      validate: (next) =>
        typeof next !== "number" || next < min || next > max
          ? `Enter a number between ${min} and ${max}.`
          : undefined,
    },
    getState: () => ({ state: `${value}` }),
  });

  return <div {...targetProps} ref={ref}>{/* … */}</div>;
}
```

Four rules:

1. `read` reads current props, never a cached copy. `useAgentTarget` keeps
   handlers behind a latest-value ref for exactly this reason.
2. `write` calls the component's own change callback with `AGENT_CHANGE`.
3. `validate` is where value rules — and authorization — belong.
4. Publish options when the value is an enumeration, so the agent can pick a
   valid one and be told the set when it guesses wrong.

## Sensitive targets

`sensitive: true` withholds the value from the readable state while still
publishing that the target exists, its label and its capabilities. The default
policy also requires confirmation before writing to it.
