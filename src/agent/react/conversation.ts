import type { AgentEvent } from "../types/events";
import type {
  ActionMessage,
  AgentAttachment,
  AgentMessage,
  AssistantMessage,
  ConfirmationMessage,
  ToolMessage,
} from "../types/messages";

let seq = 0;
export const nextMessageId = (prefix = "msg") =>
  `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export interface ConversationState {
  messages: AgentMessage[];
  status: "idle" | "streaming";
  /** Reasoning stream, shown separately from the transcript. */
  thinking?: string;
  error?: string;
  suggestions: string[];
  /** Kept so retry and regenerate can replay the turn. */
  lastInput?: { text: string; attachments?: AgentAttachment[] };
}

export const initialConversationState: ConversationState = {
  messages: [],
  status: "idle",
  suggestions: [],
};

export type ConversationCommand =
  | { kind: "user-message"; text: string; attachments?: AgentAttachment[]; turnId: string }
  | { kind: "turn-start"; turnId: string }
  | { kind: "event"; event: AgentEvent }
  | { kind: "turn-end"; turnId: string; outcome: "completed" | "stopped" | "failed"; error?: string }
  | { kind: "mark-undone"; actionId: string }
  | { kind: "drop-from"; messageId: string }
  | { kind: "set-suggestions"; suggestions: string[] }
  | { kind: "clear" };

function updateMessage<T extends AgentMessage>(
  messages: AgentMessage[],
  predicate: (message: AgentMessage) => boolean,
  update: (message: T) => T,
): AgentMessage[] {
  let found = false;
  const next = messages.map((message) => {
    if (found || !predicate(message)) return message;
    found = true;
    return update(message as T);
  });
  return found ? next : messages;
}

/**
 * Text is appended to the trailing assistant message only when it is still the
 * last entry. Once an action or tool row has been appended, the next delta
 * starts a new block, so the transcript reads in the order things happened
 * rather than growing a paragraph above the action that caused it.
 */
function openAssistantBlock(messages: AgentMessage[], turnId: string): string | undefined {
  const last = messages.at(-1);
  return last?.role === "assistant" && last.streaming && last.turnId === turnId
    ? last.id
    : undefined;
}

/**
 * Folds provider-neutral events into transcript state. Pure, so it is directly
 * unit-testable without a provider, a DOM, or a model.
 */
export function conversationReducer(
  state: ConversationState,
  command: ConversationCommand,
): ConversationState {
  switch (command.kind) {
    case "clear":
      return { ...initialConversationState, suggestions: state.suggestions };

    case "user-message": {
      const message: AgentMessage = {
        id: nextMessageId("user"),
        role: "user",
        text: command.text,
        attachments: command.attachments,
        turnId: command.turnId,
        createdAt: Date.now(),
      };
      return {
        ...state,
        messages: [...state.messages, message],
        error: undefined,
        lastInput: { text: command.text, attachments: command.attachments },
      };
    }

    case "turn-start":
      return { ...state, status: "streaming", thinking: undefined, error: undefined };

    case "turn-end": {
      const messages = state.messages.map((message) =>
        message.role === "assistant" && message.streaming
          ? {
              ...message,
              streaming: false,
              stopped: command.outcome === "stopped" ? true : message.stopped,
              error: command.outcome === "failed" ? (command.error ?? message.error) : message.error,
            }
          : message,
      );
      // A failed turn with nothing rendered still needs to say something.
      const hasVisible = messages.some(
        (m) => m.turnId === command.turnId && m.role !== "user",
      );
      if (command.outcome === "failed" && !hasVisible) {
        messages.push({
          id: nextMessageId("assistant"),
          role: "assistant",
          text: "",
          turnId: command.turnId,
          createdAt: Date.now(),
          error: command.error ?? "Something went wrong.",
        } satisfies AssistantMessage);
      }
      return {
        ...state,
        messages,
        status: "idle",
        thinking: undefined,
        error: command.outcome === "failed" ? (command.error ?? state.error) : state.error,
      };
    }

    case "mark-undone":
      return {
        ...state,
        messages: updateMessage<ActionMessage>(
          state.messages,
          (m) => m.role === "action" && m.action.id === command.actionId,
          (m) => ({ ...m, undone: true }),
        ),
      };

    case "drop-from": {
      const index = state.messages.findIndex((m) => m.id === command.messageId);
      if (index < 0) return state;
      return { ...state, messages: state.messages.slice(0, index) };
    }

    case "set-suggestions":
      return { ...state, suggestions: command.suggestions };

    case "event":
      return applyEvent(state, command.event);

    default:
      return state;
  }
}

function applyEvent(state: ConversationState, event: AgentEvent): ConversationState {
  switch (event.type) {
    case "text-delta": {
      const id = openAssistantBlock(state.messages, event.turnId);
      if (id) {
        return {
          ...state,
          thinking: undefined,
          messages: updateMessage<AssistantMessage>(
            state.messages,
            (m) => m.id === id,
            (m) => ({ ...m, text: m.text + event.delta }),
          ),
        };
      }
      return {
        ...state,
        thinking: undefined,
        messages: [
          // Only the newest block streams, so only one caret is ever shown.
          ...state.messages.map((message) =>
            message.role === "assistant" && message.streaming
              ? { ...message, streaming: false }
              : message,
          ),
          {
            id: nextMessageId("assistant"),
            role: "assistant",
            text: event.delta,
            streaming: true,
            turnId: event.turnId,
            createdAt: Date.now(),
          } satisfies AssistantMessage,
        ],
      };
    }

    case "thinking-delta":
      return { ...state, thinking: (state.thinking ?? "") + event.delta };

    case "tool-started":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: nextMessageId("tool"),
            role: "tool",
            toolCallId: event.toolCallId,
            name: event.name,
            label: event.label ?? event.name,
            status: "running",
            turnId: event.turnId,
            createdAt: Date.now(),
          } satisfies ToolMessage,
        ],
      };

    case "tool-completed":
      return {
        ...state,
        messages: updateMessage<ToolMessage>(
          state.messages,
          (m) => m.role === "tool" && m.toolCallId === event.toolCallId,
          (m) => ({ ...m, status: "succeeded", summary: event.summary }),
        ),
      };

    case "tool-failed":
      return {
        ...state,
        messages: updateMessage<ToolMessage>(
          state.messages,
          (m) => m.role === "tool" && m.toolCallId === event.toolCallId,
          (m) => ({ ...m, status: "failed", error: event.error }),
        ),
      };

    case "confirmation-required":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: nextMessageId("confirm"),
            role: "confirmation",
            action: event.action,
            preview: event.preview,
            status: "pending",
            turnId: event.turnId,
            createdAt: Date.now(),
          } satisfies ConfirmationMessage,
        ],
      };

    case "confirmation-resolved":
      return {
        ...state,
        messages: updateMessage<ConfirmationMessage>(
          state.messages,
          (m) =>
            m.role === "confirmation" &&
            m.action.id === event.action.id &&
            m.status === "pending",
          (m) => ({ ...m, status: event.confirmed ? "confirmed" : "cancelled" }),
        ),
      };

    case "action-staged":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: nextMessageId("staged"),
            role: "action",
            action: event.action,
            status: "staged",
            label: event.operation.label,
            stagedId: event.operation.id,
            turnId: event.turnId,
            createdAt: Date.now(),
          } satisfies ActionMessage,
        ],
      };

    case "action-started":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: nextMessageId("action"),
            role: "action",
            action: event.action,
            status: "executing",
            label: describeAction(event.action),
            turnId: event.turnId,
            createdAt: Date.now(),
          } satisfies ActionMessage,
        ],
      };

    case "action-completed":
      return {
        ...state,
        messages: updateMessage<ActionMessage>(
          state.messages,
          (m) => m.role === "action" && m.action.id === event.action.id,
          (m) => ({
            ...m,
            status: "succeeded",
            label: event.result.message ?? m.label,
            result: event.result,
          }),
        ),
      };

    case "action-failed":
      return {
        ...state,
        messages: updateMessage<ActionMessage>(
          state.messages,
          (m) => m.role === "action" && m.action.id === event.action.id,
          (m) => ({
            ...m,
            status: "failed",
            label: event.error.userMessage ?? event.error.message,
          }),
        ),
      };

    case "action-cancelled":
      return {
        ...state,
        messages: updateMessage<ActionMessage>(
          state.messages,
          (m) => m.role === "action" && m.action.id === event.action.id,
          (m) => ({ ...m, status: "cancelled", label: "Cancelled — nothing was changed." }),
        ),
      };

    case "suggestions-updated":
      return { ...state, suggestions: event.suggestions };

    case "error":
      return { ...state, error: event.message };

    default:
      return state;
  }
}

/** Short, human-readable label for the action row in the transcript. */
export function describeAction(action: ActionMessage["action"]): string {
  switch (action.type) {
    case "navigate":
      return `Opening ${action.target}`;
    case "set-value":
      return `Setting ${action.target}`;
    case "toggle":
      return `Turning ${action.target} ${action.value === false ? "off" : "on"}`;
    case "select-option":
      return `Choosing ${action.value} for ${action.target}`;
    case "check":
      return `Checking ${action.target}`;
    case "uncheck":
      return `Unchecking ${action.target}`;
    case "filter":
      return `Filtering ${action.target}`;
    case "search":
      return `Searching ${action.target}`;
    case "submit":
      return `Submitting ${action.target}`;
    case "invoke":
      return `Running ${action.target}`;
    case "open-dialog":
      return `Opening ${action.target}`;
    case "close-dialog":
      return `Closing ${action.target}`;
    default:
      return `Focusing ${action.target}`;
  }
}
