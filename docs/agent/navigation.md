# Navigation, focus and spotlight

Agent navigation is not text. "I'll take you to notification settings" must
actually move the user there.

## The delegate

Routing belongs to the application. `AgentProvider` receives it through
`environment`:

```tsx
<AgentProvider
  adapter={adapter}
  environment={{
    getRoute: () => ({ route: routeRef.current }),
    navigate: (target) => setRoute(target),
    getNotifications: () => toast.toAgentState(),
  }}
>
```

Registering the route table restricts where the agent can go:

```ts
useEffect(() => {
  const off = ROUTES.map((route) => agent.registry.registerRoute(route));
  return () => off.forEach((fn) => fn());
}, [agent.registry]);
```

A `navigate` to an unregistered id fails with `unknown-target` and names the
routes that do exist. If no routes are registered at all, navigation is
unrestricted — register them.

## The three verbs

```ts
await agent.navigate("settings.notifications");   // change screen
await agent.reveal("notifications.email");        // scroll + spotlight, keep focus
await agent.focus("notifications.email");         // scroll + spotlight + take focus
```

The distinction is an accessibility decision, not a cosmetic one:

- **`reveal`** is for "this is where I went". It never moves the keyboard focus,
  because the user may be typing in the composer.
- **`focus`** is for "your turn now" — when the next step is the user's input.

A useful pattern is navigate, then reveal, then explain:

```ts
await context.execute({ type: "navigate", target: "settings.notifications" });
await context.execute({ type: "reveal", target: "notifications.email" });
const state = context.getState();   // read AFTER arriving
```

## Spotlight

Every target registered through `useAgentTarget` participates automatically: it
gets `data-agent-spotlight="true"` while active, which the stylesheet renders as
a quiet ring in the agent hue that fades after ~2.6s.

For anything that is not a single control — a card, a section, a region — wrap it:

```tsx
<AgentSpotlight target="dashboard.notifications-summary" tip="Agent">
  <Card title="Your notifications">…</Card>
</AgentSpotlight>
```

Keep it understated. The cue exists to answer "where did it just take me?", not
to perform. `prefers-reduced-motion` removes the animation.

## Dialogs

`Dialog` registers both as a target (`open` / `close`) and as a dialog in the
readable state, so the agent can see that something modal is in the way. It also
scopes nested targets to itself, traps focus, closes on Escape and restores focus
to wherever it was — whether a human or the agent opened it.
