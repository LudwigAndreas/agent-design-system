# AGENTS.md

Guidance for AI coding agents and humans working in this repository.

## What this project is

A React design system whose UI can be operated by **both a human and an AI
agent through the same application state**. Agent-controllable UI is a core
capability here, not an add-on.

```
src/
  agent/          the agent interaction layer  (types → core → react → hooks → components)
  design-system/  components that expose semantic identity
  app/            the reference application: router, domain state, policy, adapters
docs/agent/       architecture, actions, targets, navigation, confirmation, state,
                  security, adapters, accessibility, examples
docs/design/      the visual rulebook, and the audit behind it
```

Start with `docs/agent/architecture.md`. The TypeScript types in
`src/agent/types` are the source of truth; prose follows them, not the reverse.

Before writing any UI, read `docs/design/notion-inspired.md`. The visual grammar
is typography → spacing → layout → hairlines → minimal surfaces → small accents,
and it is enforced by the token layer rather than by review.

## Commands

```bash
npm run dev         # reference application on :5173
npm test            # vitest, 64 tests
npm run typecheck   # tsc --noEmit, strict
npm run build       # tsc -b && vite build
```

# Agent UI development rules

1. **Never manipulate arbitrary DOM elements to perform agent actions.** No
   `document.querySelector`, no `element.click()`, no synthetic events. If you
   are reaching for the DOM, the target is missing a handler.
2. **Use semantic agent targets.** The agent addresses `notifications.email`,
   never `#switch-2948` or `div:nth-child(4)`.
3. **Prefer existing design-system components.** They already carry the agent
   surface; a bespoke input does not.
4. **Every agent-controllable element must have a stable semantic ID.** An
   `agentId` is a public API. Renaming one is a breaking change.
5. **Agent actions must flow through the application state model** — the same
   change callback a click invokes, so business logic runs unchanged.
6. **Never bypass React or application state with DOM mutation.** A UI that
   merely *looks* changed is a bug, not a shortcut.
7. **Never assume an action succeeded until application state confirms it.**
   Re-read the value; report `state-not-confirmed` when it did not take.
8. **Sensitive and destructive actions must support confirmation.** Mark them
   `sensitive` / `destructive` / `requiresConfirmation` and let the runtime ask.
9. **Agent provider implementations belong outside the design system.** Nothing
   under `src/agent` or `src/design-system` may import a vendor SDK.
10. **Keep agent APIs provider-neutral.** Translate provider concepts into
    `AgentEvent` at the adapter boundary, or drop them.
11. **Prefer semantic page context over DOM inspection.** Give `AgentContext` the
    prose, the declared actions and the suggestions; do not make a model infer
    them from markup.
12. **Keep user actions and agent actions distinguishable.** Thread
    `ActionSource` through; surface "Changed by agent" rather than pretending.
13. **Preserve keyboard and screen-reader accessibility.** Announce sparingly,
    move focus deliberately, and never take control away from the user.
14. **Do not expose internal implementation details to the agent unnecessarily.**
    Publish meaning, not structure. Withhold sensitive values.
15. **Do not create page-specific agent APIs when a reusable semantic
    abstraction is possible.** Reach for a declared `invoke` action before
    inventing a new action type.

## Conventions

- Strict TypeScript. No `any` in new code; the registry's stored registrations
  are the one deliberate exception, and they are contained.
- Design tokens only — no hard-coded colours, spacing, radii or font sizes in
  components. Both themes and both densities must work.
- Spacing tokens are named for pixels (`--space-12` is 12px). Use the scale; do
  not invent values.
- Default to no container. A heading and a hairline before a card; a card before
  a shadow. There is no card shadow token, and that is deliberate.
- Interaction states are translucent ink scrims (`--color-surface-hover`), never
  new solid colours.
- New components get an entry on the `/design-system` page.
- Comments explain *why*, never *what*. Match the density of the file you are in.
- Change callbacks take `(value, meta: ChangeMeta)`. Normal React usage
  (`onCheckedChange={(v) => setX(v)}`) must keep working.
- Agent-layer behaviour needs a test. `src/agent/__tests__` covers the registry,
  the runtime lifecycle, the conversation reducer, React integration, markdown
  safety and the shell.

## Traps

- Handlers must read current props. `useAgentTarget` keeps them behind a
  latest-value ref — do not defeat that by capturing values in a `useMemo`.
- The registry warns on duplicate `agentId`s in development. The later
  registration wins and the earlier target becomes unreachable.
- `context.state` is a turn-start snapshot. Use `context.getState()` after
  acting; the user may have changed something.
- Policy decides *whether to ask*, never whether something is permitted.
  Authorization goes in the target's `validate` or the declared action's `run`.
