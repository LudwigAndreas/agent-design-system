# Confirmation and action policy

Not every action should execute immediately. The design system provides the
mechanism; the application decides what counts as consequential.

## What policy is and is not

`AgentActionPolicy` decides **whether the user is asked first**. It does not
decide whether an operation is permitted — that is business logic, and it lives
in the target's `validate` handler or in the function a declared action runs.

```ts
interface AgentActionPolicy {
  requiresConfirmation: boolean;
  reason?: string;
  destructive?: boolean;
  sensitive?: boolean;
  confirmLabel?: string;
}
```

## The default

`defaultAgentPolicy` runs before any application rule:

| Never asks | Always asks |
| --- | --- |
| `navigate`, `focus`, `reveal`, `scroll-to` | a target marked `requiresConfirmation` |
| `open-dialog`, `close-dialog` | a target marked `sensitive` |
| `search`, `filter` | `invoke` and `submit` (effects beyond this screen) |

An action with `source: "user"` is never confirmed: the human already expressed
the intent by clicking.

## Application rules

An application resolver is merged over the default. Return a partial policy, or
nothing to accept the default:

```tsx
const policy = useCallback<AgentPolicyResolver>(({ action, element, state }) => {
  if (action.target.startsWith("accounts.delete")) {
    return {
      requiresConfirmation: true,
      destructive: true,
      reason: "Deleting accounts is permanent and cannot be undone.",
      confirmLabel: "Delete permanently",
    };
  }
  if (action.type === "filter" || action.type === "search") {
    return { requiresConfirmation: false };   // only changes what is displayed
  }
  return undefined;
}, []);
```

## The preview

`buildActionPreview` turns the action, the target's current state and the policy
into an `AgentActionPreviewModel`, which `AgentActionPreview` renders:

```
┌──────────────────────────────────────┐
│ Agent wants to change                │
│ You asked me to turn email off.      │
│                                      │
│ Email notifications                  │
│ Enabled → Disabled                   │
│                                      │
│ [Cancel]             [Confirm]       │
└──────────────────────────────────────┘
```

The before value is read live, so the user confirms against what is actually
true rather than what the agent assumed. The arrow is decorative; assistive
technology gets "changing from Enabled to Disabled".

The component is composable — the chat renders it inline, and a page can render
the same model anywhere.

## Lifecycle

```
requested → validated → awaiting-confirmation → executing → succeeded
                                     │                    └→ failed
                                     └→ cancelled
```

Validation precedes confirmation deliberately: the user is never asked to
approve an action that could not have run.

A `cancel` resolves the pending promise with `cancelled`, `success: false` and
nothing changed. Pressing **Stop** in the composer cancels every pending
confirmation, so a turn can never leave a dangling question.

## Undo

The registry synthesises `undo` for value writes from the observed previous
value, and omits it when there is nothing meaningful to restore. Undo is offered
once; taking it retires the affordance.

```ts
if (result.undo) toast.notify({ title: result.message, action: { label: "Undo", onClick: () => agent.undo(action.id) } });
```

Application-defined undo for anything the registry cannot reverse — a deletion,
a sent message — belongs in the action's own result.
