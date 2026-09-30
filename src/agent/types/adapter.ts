import type { AgentAction, AgentActionResult } from "./actions";
import type { AgentAttachment, AgentMessage } from "./messages";
import type { AgentEvent } from "./events";
import type { AgentReadableState } from "./state";

/**
 * The single seam between this design system and any AI provider.
 *
 * Nothing under `src/agent` may import a vendor SDK. An adapter lives in
 * application code, receives a request, and yields provider-neutral events.
 */

export interface AgentTurnContext {
  /** The user's input for this turn. */
  input: { text: string; attachments?: AgentAttachment[] };
  /** Transcript so far, oldest first, excluding `input`. */
  history: AgentMessage[];
  /** Snapshot taken at turn start. Use `getState()` for a fresh read. */
  state: AgentReadableState;
  /**
   * Re-reads the live UI. Call this after any action instead of assuming the
   * snapshot is still accurate — the user may have changed something.
   */
  getState(): AgentReadableState;
  /**
   * Requests a state change. Runs validation, policy, confirmation and
   * post-write verification. Resolves with what actually happened; it does not
   * throw for rejected actions.
   */
  execute(action: AgentAction): Promise<AgentActionResult>;
  /** Aborted when the user presses stop. */
  signal: AbortSignal;
  turnId: string;
}

export interface AgentAdapter {
  /** Stable identifier, surfaced in the demo panel. e.g. `local-rules`. */
  id: string;
  name?: string;
  /**
   * Handles one turn. Yield events as they happen; the UI renders them live.
   * Emitting action events is optional — `context.execute` already does it.
   */
  sendMessage(context: AgentTurnContext): AsyncIterable<AgentEvent>;
  /** Optional teardown when the provider holds connections. */
  dispose?(): void | Promise<void>;
}
