# Agent interaction layer — architecture

The premise: **a semantic UI system that can be operated by both humans and an
AI agent through the same application state and interaction model.**

```
click ──────────────┐
                    ├──► component change callback ──► React state ──► business logic ──► UI
semantic action ────┘
```

Both paths converge before anything changes. There is no second, hidden state
system for the agent, and no path that mutates the DOM.

## Layers

```
                         ┌──────────────────┐
                         │   AI PROVIDER    │   application code
                         │ Claude/OpenAI/…  │
                         └────────┬─────────┘
                                  │  AgentAdapter          ← the only seam
                                  ▼
                     ┌────────────────────────┐
                     │     Agent runtime      │   src/agent/core/runtime.ts
                     │  lifecycle · policy    │
                     │  confirmation · events │
                     │  undo · audit log      │
                     └───────────┬────────────┘
                                 │  AgentAction / AgentActionResult
                                 ▼
                     ┌────────────────────────┐
                     │    Agent UI registry   │   src/agent/core/registry.ts
                     │  targets · pages       │
                     │  dialogs · routes      │
                     │  readable state        │
                     └───────────┬────────────┘
                                 │  handlers (read/write/focus/open/submit/invoke)
                                 ▼
                     ┌────────────────────────┐
                     │       React UI         │   src/design-system/*
                     │  Switch · Select · …   │
                     └────────────────────────┘
```

| Directory | Responsibility |
| --- | --- |
| `src/agent/types` | The architectural source of truth. Types first, implementation second. |
| `src/agent/core` | Framework-agnostic registry, runtime, policy, preview, event bus. |
| `src/agent/react` | `AgentProvider` and the conversation reducer. |
| `src/agent/hooks` | Integration hooks. Each solves a specific problem; none exist for symmetry. |
| `src/agent/components` | Shell, chat, preview, spotlight, suggestions, status, inspector. |
| `src/design-system` | Ordinary components that happen to expose semantic identity. |
| `src/app` | The reference application: router, domain state, policy, adapters. |

## Boundaries

The design system owns the **interaction mechanism**:
the registry, the action protocol, the lifecycle, the confirmation UI, the
chat, the accessibility plumbing.

The application owns **everything that decides**:
business logic, permissions, authorization, API calls, domain state,
persistence, and the agent provider implementation.

Concretely, nothing under `src/agent` or `src/design-system` imports a vendor
SDK, and no component under either decides whether an operation is allowed.

## Data flow for one action

1. The adapter calls `context.execute(action)`.
2. The runtime assigns an id, records it, emits `action-requested`.
3. **Validate** — does the target exist, and does it support this capability?
   A failure here never reaches the user as a question.
4. **Policy** — `defaultAgentPolicy` merged with the application's resolver
   decides whether the user must confirm. Policy decides *whether to ask*, not
   whether it is permitted.
5. **Confirmation** — if required, emit `confirmation-required` with a preview
   and await `confirm()` / `cancel()`.
6. **Execute** — the registry calls the target's handler, which is the same
   callback a click uses.
7. **Verify** — re-read the value until it matches, or time out. A refused
   write becomes `state-not-confirmed`, not a success.
8. Emit `state-changed` with a fresh snapshot, then `action-completed` or
   `action-failed`, and return the result.

Steps 3, 5 and 7 are the ones that make agent-driven UI trustworthy.

## Files to read in order

1. `types/actions.ts` — what an agent may ask for
2. `types/registry.ts` — how UI answers
3. `core/registry.ts` — execution and verification
4. `core/runtime.ts` — lifecycle, policy, confirmation, undo
5. `hooks/useAgentTarget.ts` — how a component joins in
6. `src/app/pages/SettingsPage.tsx` — what authoring actually looks like
