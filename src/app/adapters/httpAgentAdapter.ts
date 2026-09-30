import type { AgentAction, AgentActionResult } from "../../agent/types/actions";
import type { AgentAdapter, AgentTurnContext } from "../../agent/types/adapter";
import type { AgentEvent } from "../../agent/types/events";

/**
 * A real-backend adapter, written without any vendor SDK.
 *
 * The model itself lives on the server, which is where an API key belongs. This
 * file shows the shape of the seam: the application owns the transport and the
 * provider; the design system sees only `AgentEvent`s.
 *
 * Wire protocol (NDJSON, one JSON object per line):
 *
 *   ← { "type": "text-delta", "delta": "Taking you to…" }
 *   ← { "type": "tool-started", "toolCallId": "t1", "name": "account_search" }
 *   ← { "frame": "execute", "callId": "c1", "action": { "type": "toggle", … } }
 *   → POST /result  { "turnId", "callId", "result" }
 *   ← { "type": "text-delta", "delta": " Done." }
 *
 * Any frame that is a plain `AgentEvent` is forwarded to the UI unchanged.
 * `execute` frames are performed locally through the runtime — which applies
 * policy, confirmation and verification — and the outcome is sent back, so the
 * model learns what actually happened rather than what it asked for.
 */

export interface HttpAgentAdapterOptions {
  /** Endpoint that starts a turn and streams frames back. */
  turnUrl: string;
  /** Endpoint that receives action results. */
  resultUrl: string;
  headers?: Record<string, string>;
  id?: string;
  name?: string;
}

interface ExecuteFrame {
  frame: "execute";
  callId: string;
  action: AgentAction;
}

type ServerFrame = AgentEvent | ExecuteFrame;

const isExecuteFrame = (frame: ServerFrame): frame is ExecuteFrame =>
  "frame" in frame && frame.frame === "execute";

export function createHttpAgentAdapter(options: HttpAgentAdapterOptions): AgentAdapter {
  const { turnUrl, resultUrl, headers } = options;

  return {
    id: options.id ?? "http",
    name: options.name ?? "HTTP backend",

    async *sendMessage(context: AgentTurnContext): AsyncGenerator<AgentEvent> {
      const response = await fetch(turnUrl, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        signal: context.signal,
        body: JSON.stringify({
          turnId: context.turnId,
          input: context.input,
          history: context.history,
          // The server passes this to the model as the description of the UI.
          state: context.state,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(
          `The assistant service returned ${response.status} ${response.statusText}.`,
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // NDJSON: process whole lines, keep the partial tail for the next chunk.
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!line) continue;

          let frame: ServerFrame;
          try {
            frame = JSON.parse(line) as ServerFrame;
          } catch {
            // A malformed frame is the server's bug; drop it rather than
            // failing a turn that is otherwise working.
            continue;
          }

          if (!isExecuteFrame(frame)) {
            yield { ...frame, turnId: context.turnId } as AgentEvent;
            continue;
          }

          // The runtime — not the server — decides whether this is allowed,
          // whether the user must confirm, and whether it actually took effect.
          const result = await context.execute(frame.action);
          await postResult(resultUrl, headers, context, frame.callId, result);
        }
      }
    },
  };
}

async function postResult(
  resultUrl: string,
  headers: Record<string, string> | undefined,
  context: AgentTurnContext,
  callId: string,
  result: AgentActionResult,
) {
  await fetch(resultUrl, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    signal: context.signal,
    body: JSON.stringify({
      turnId: context.turnId,
      callId,
      result: {
        success: result.success,
        status: result.status,
        message: result.message,
        value: result.value,
        previousValue: result.previousValue,
        error: result.error ? { code: result.error.code, message: result.error.message } : undefined,
      },
      // Fresh state, so the model's next step reasons about reality.
      state: context.getState(),
    }),
  });
}
