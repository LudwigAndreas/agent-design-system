# OneCheck

A React design system whose UI can be operated by **both a human and an AI agent
through the same application state and interaction model** — plus a reference
application that demonstrates it end to end.

The visual language is workspace software: quiet, warm, typography-led, with
hairlines instead of cards and elevation only for surfaces that genuinely float.
See [the visual rulebook](docs/design/notion-inspired.md).

```
click ──────────────┐
                    ├──► component callback ──► React state ──► business logic ──► UI
semantic action ────┘
```

Not "a chatbot next to some buttons". The agent is a first-class UI actor that
reaches the interface through a semantic action layer, never through the DOM.

## Quick start

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # 64 tests
npm run typecheck
```

The reference application ships with a deterministic, offline adapter, so it
works with no API key. Try:

- *Take me to notification settings.*
- *Turn off email notifications.*
- *Change the notification frequency to weekly.*
- *Show me accounts that haven't logged in for 30 days.*
- *Delete the selected accounts.* (asks first)
- *All accounts created before 11.09.2025 that are mine, in my unit, approved by priya@northwind.example — export them.*
- *Turn on SMS notifications.* (the application refuses — watch it report honestly)

The **Inspector** page shows every executed action and the exact semantic state
the agent can see.

## What a page looks like

```tsx
<AgentProvider adapter={agentAdapter} policy={policy} environment={{ navigate, getRoute }}>
  <AgentAppShell split="75/25">
    <AgentAppShell.Main>
      <AgentContext
        page="settings.notifications"
        context="Controls which channels send notifications and how often."
        actions={[{ id: "notifications.reset", label: "Reset preferences", run: resetAll }]}
        suggestions={["Turn off email notifications"]}
      >
        <SettingsSection id="notifications" title="Notifications">
          <Switch
            agentId="notifications.email"
            label="Email notifications"
            checked={email}
            onCheckedChange={(next, meta) => setEmail(next, meta.source)}
          />
          <Select
            agentId="notifications.frequency"
            label="Frequency"
            value={frequency}
            options={FREQUENCIES}
            onValueChange={(next, meta) => setFrequency(next, meta.source)}
          />
        </SettingsSection>
      </AgentContext>
    </AgentAppShell.Main>

    <AgentAppShell.AgentPanel>
      <AgentChat />
    </AgentAppShell.AgentPanel>
  </AgentAppShell>
</AgentProvider>
```

The agent can then, semantically:

```ts
navigate("settings.notifications")
read("notifications.email")
toggle("notifications.email", false)
select("notifications.frequency", "weekly")
```

while the application stays responsible for validating and executing the actual
business operation.

## What you get

**Layout** — `AgentAppShell` with configurable splits (50/50 → 80/20),
collapsible and resizable panel, fullscreen mode, mobile drawer, persisted state.

**Protocol** — `AgentAction` / `AgentEvent` / `AgentMessage` as extensible
discriminated unions; a typed action lifecycle from `requested` to
`succeeded | failed | cancelled`.

**Registry** — `AgentUIRegistry` bridges React UI and the agent layer, publishes
a semantic `AgentReadableState`, and **verifies that every write actually took
effect** before reporting success.

**Confirmation** — policy resolution, structured before/after previews, undo, and
a clear separation between "ask the user" (design system) and "is this allowed"
(application).

**Queries** — a view publishes a schema; the agent fills it with a typed
predicate that is validated before anything runs. Values may be references the
application resolves (`me`, `my unit`, an email address) rather than literals,
so the agent never handles identity. The same predicate drives the visible
query UI, so the user can read and correct whatever the agent built.

**Staged operations** — a third outcome beside execute and confirm: the agent
prepares expensive or artifact-producing work and hands the trigger to the
user, with staleness detection if the inputs move underneath it.

**Chat** — streaming, markdown that never becomes HTML, code blocks, citations,
tool execution, action rows, inline confirmations, errors, retry, stop,
regenerate, attachments, contextual suggestions.

**Accessibility** — one polite live region, deliberate focus movement, a
spotlight that does not steal focus, reduced-motion support, and colour that
never carries meaning alone.

**A visual system** — semantic tokens for colour, type, space, radius, shadow,
control heights and motion; light and dark; a comfortable and a compact density,
both switched at the token layer. `/design-system` in the running app renders
every component together as a regression surface.

**Provider-neutral** — no vendor SDK anywhere in the library. Two example
adapters: a deterministic local one and an HTTP/NDJSON one for a server-hosted
model (Claude, OpenAI, or your own).

## Documentation

| Document | Contents |
| --- | --- |
| [architecture](docs/agent/architecture.md) | Layers, boundaries, the path of one action |
| [actions](docs/agent/actions.md) | The action set, results, error codes, extension |
| [targets](docs/agent/targets.md) | Semantic ids, capabilities, authoring components |
| [state](docs/agent/state.md) | What the agent can see, and why freshness matters |
| [navigation](docs/agent/navigation.md) | Navigate, reveal, focus, spotlight, dialogs |
| [confirmation](docs/agent/confirmation.md) | Policy, previews, lifecycle, undo |
| [security](docs/agent/security.md) | The trust boundary and prompt injection |
| [queries](docs/agent/queries.md) | Query schemas, predicates, value resolution, staging |
| [adapters](docs/agent/adapters.md) | The provider seam, and wiring a real model |
| [accessibility](docs/agent/accessibility.md) | Rules for agent-driven change |
| [examples](docs/agent/examples.md) | Five worked scenarios, including failures |
| [visual rulebook](docs/design/notion-inspired.md) | Colour, type, space, surfaces, components |
| [visual audit](docs/design/audit.md) | What the first implementation looked like, and why it changed |
| [AGENTS.md](AGENTS.md) | Development rules for agents working in this repo |

## Project layout

```
src/agent/
  types/       actions, events, messages, metadata, policy, state, registry, adapter
  core/        registry, runtime, policy, preview, capabilities, event bus
  react/       AgentProvider, conversation reducer
  hooks/       useAgent, useAgentTarget, useAgentState, useAgentNavigation, …
  components/  AgentAppShell, AgentChat, AgentContext, AgentActionPreview,
               AgentSpotlight, AgentSuggestions, AgentStatusRegion, AgentDemoPanel
  __tests__/   registry, runtime, conversation, integration, markdown, shell

src/design-system/
  Button, Input, Select, Switch, Checkbox, Dialog, Menu, Tooltip, Tabs,
  DataTable, Page, Sidebar, SettingsSection, SettingRow, EmptyState,
  Notifications, icons, primitives, tokens

src/app/
  App, routes, app.css, state/, adapters/
  pages/ — Dashboard, Accounts, Settings, Inspector, Design system
```
