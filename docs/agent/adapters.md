# Adapters — the provider seam

`AgentAdapter` is the only place a model provider appears. Nothing under
`src/agent` or `src/design-system` imports a vendor SDK; adapters live in
application code.

```ts
interface AgentAdapter {
  id: string;
  name?: string;
  sendMessage(context: AgentTurnContext): AsyncIterable<AgentEvent>;
  dispose?(): void | Promise<void>;
}
```

## The turn context

```ts
interface AgentTurnContext {
  input: { text: string; attachments?: AgentAttachment[] };
  history: AgentMessage[];
  state: AgentReadableState;          // snapshot at turn start
  getState(): AgentReadableState;     // fresh read — use this after acting
  execute(action: AgentAction): Promise<AgentActionResult>;
  signal: AbortSignal;                // aborted when the user presses Stop
  turnId: string;
}
```

`execute` is the runtime's, so validation, policy, confirmation and
verification apply to every adapter for free. An adapter cannot bypass them, and
does not need to reimplement them.

> The spec sketch for this interface put `executeAction` and `getState` on the
> adapter itself. They are on the turn context instead: they are per-turn
> capabilities that the runtime provides *to* the adapter, and putting them there
> means an adapter has no state of its own to keep in sync.

## A minimal adapter

```ts
export function createEchoAdapter(): AgentAdapter {
  return {
    id: "echo",
    async *sendMessage(context) {
      yield { type: "text-delta", turnId: context.turnId, delta: "Working on it." };
      const result = await context.execute({ type: "toggle", target: "notifications.email", value: false });
      yield {
        type: "text-delta",
        turnId: context.turnId,
        delta: result.success ? " Done." : ` I couldn't: ${result.error?.userMessage}`,
      };
    },
  };
}
```

Emitting action or confirmation events is unnecessary — `context.execute`
already publishes them on the bus, and the provider drops duplicates so the
transcript cannot show the same action twice.

## Talking to a real model

Two shapes work well.

**Server-side model (recommended).** `src/app/adapters/httpAgentAdapter.ts` is a
complete implementation: the adapter POSTs the input, history and readable state,
then reads NDJSON frames. Plain `AgentEvent` frames are forwarded to the UI;
`{ frame: "execute", callId, action }` frames are executed locally through the
runtime and the real outcome is posted back, so the model's next step reasons
about what actually happened. The API key never reaches the browser.

**Client-side SDK.** Build the tool schema from the action union, map tool calls
to `context.execute`, and map streamed text to `text-delta`. Keep that file in
application code. Two rules: forward the *result* of `execute` back to the model,
never the request; and re-send `context.getState()` with it.

Give the model, in its system prompt, the current `AgentReadableState` and the
action vocabulary — `docs/agent/actions.md` is written to be pasted in.

## Provider-neutral events

The complete set is in `src/agent/types/events.ts`: `text-delta`,
`thinking-delta`, `tool-started` / `tool-completed` / `tool-failed`,
`suggestions-updated`, `error`, plus the runtime-owned action, confirmation,
navigation and `state-changed` events. If a provider concept has no event here,
translate it or drop it — do not leak a wire format past this boundary.
