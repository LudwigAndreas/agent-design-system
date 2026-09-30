import { describe, expect, it } from "vitest";
import {
  conversationReducer,
  initialConversationState,
  type ConversationState,
} from "../react/conversation";
import { resolveAction } from "../core/registry";
import type { ActionMessage, AssistantMessage } from "../types/messages";

const TURN = "turn_1";

function fold(commands: Parameters<typeof conversationReducer>[1][]): ConversationState {
  return commands.reduce(conversationReducer, initialConversationState);
}

const action = resolveAction({ type: "toggle", target: "notifications.email", value: false });

describe("conversation reducer", () => {
  it("assembles streamed text into one assistant message", () => {
    const state = fold([
      { kind: "user-message", text: "hello", turnId: TURN },
      { kind: "turn-start", turnId: TURN },
      { kind: "event", event: { type: "text-delta", turnId: TURN, delta: "Turning " } },
      { kind: "event", event: { type: "text-delta", turnId: TURN, delta: "it off." } },
    ]);

    const assistant = state.messages.at(-1) as AssistantMessage;
    expect(state.messages).toHaveLength(2);
    expect(assistant.text).toBe("Turning it off.");
    expect(assistant.streaming).toBe(true);
    expect(state.status).toBe("streaming");
  });

  it("clears the streaming flag when the turn ends", () => {
    const state = fold([
      { kind: "turn-start", turnId: TURN },
      { kind: "event", event: { type: "text-delta", turnId: TURN, delta: "Done." } },
      { kind: "turn-end", turnId: TURN, outcome: "completed" },
    ]);

    expect((state.messages[0] as AssistantMessage).streaming).toBeFalsy();
    expect(state.status).toBe("idle");
  });

  it("marks a stopped turn as stopped rather than failed", () => {
    const state = fold([
      { kind: "turn-start", turnId: TURN },
      { kind: "event", event: { type: "text-delta", turnId: TURN, delta: "Half a th" } },
      { kind: "turn-end", turnId: TURN, outcome: "stopped" },
    ]);

    expect((state.messages[0] as AssistantMessage).stopped).toBe(true);
    expect(state.error).toBeUndefined();
  });

  it("surfaces a failure even when the turn produced no text", () => {
    const state = fold([
      { kind: "user-message", text: "hi", turnId: TURN },
      { kind: "turn-start", turnId: TURN },
      { kind: "turn-end", turnId: TURN, outcome: "failed", error: "The service is down." },
    ]);

    const assistant = state.messages.at(-1) as AssistantMessage;
    expect(assistant.error).toBe("The service is down.");
    expect(state.error).toBe("The service is down.");
  });

  it("tracks a tool call from running to a summary", () => {
    const state = fold([
      {
        kind: "event",
        event: {
          type: "tool-started",
          turnId: TURN,
          toolCallId: "t1",
          name: "account_search",
          label: "Searching your account",
        },
      },
      {
        kind: "event",
        event: {
          type: "tool-completed",
          turnId: TURN,
          toolCallId: "t1",
          summary: "Found 12 matching records",
        },
      },
    ]);

    expect(state.messages[0]).toMatchObject({
      role: "tool",
      status: "succeeded",
      summary: "Found 12 matching records",
    });
  });

  it("renders a confirmation request and then its resolution", () => {
    const state = fold([
      {
        kind: "event",
        event: {
          type: "confirmation-required",
          turnId: TURN,
          action,
          preview: {
            title: "Agent wants to change",
            changes: [{ label: "Email notifications", from: "Enabled", to: "Disabled" }],
            action,
          },
        },
      },
      { kind: "event", event: { type: "confirmation-resolved", turnId: TURN, action, confirmed: true } },
    ]);

    expect(state.messages[0]).toMatchObject({ role: "confirmation", status: "confirmed" });
  });

  it("folds an action from executing to succeeded on the same row", () => {
    const state = fold([
      { kind: "event", event: { type: "action-started", turnId: TURN, action } },
      {
        kind: "event",
        event: {
          type: "action-completed",
          turnId: TURN,
          action,
          result: {
            success: true,
            action,
            status: "succeeded",
            message: "Set Email notifications to off",
          },
        },
      },
    ]);

    // One row, updated in place — not two rows telling a confusing story.
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      role: "action",
      status: "succeeded",
      label: "Set Email notifications to off",
    });
  });

  it("shows the user-facing message when an action fails", () => {
    const state = fold([
      { kind: "event", event: { type: "action-started", turnId: TURN, action } },
      {
        kind: "event",
        event: {
          type: "action-failed",
          turnId: TURN,
          action,
          error: {
            code: "state-not-confirmed",
            message: "internal detail",
            userMessage: "The application didn't accept the change.",
          },
        },
      },
    ]);

    expect(state.messages[0]).toMatchObject({
      status: "failed",
      label: "The application didn't accept the change.",
    });
  });

  it("marks an action as undone so the affordance retires", () => {
    const state = fold([
      { kind: "event", event: { type: "action-started", turnId: TURN, action } },
      { kind: "mark-undone", actionId: action.id },
    ]);

    expect((state.messages[0] as ActionMessage).undone).toBe(true);
  });

  it("drops the last turn when regenerating", () => {
    const withTurn = fold([
      { kind: "user-message", text: "first", turnId: TURN },
      { kind: "event", event: { type: "text-delta", turnId: TURN, delta: "answer" } },
    ]);
    const userMessageId = withTurn.messages[0]!.id;

    const state = conversationReducer(withTurn, { kind: "drop-from", messageId: userMessageId });

    expect(state.messages).toHaveLength(0);
    // The input is retained, which is what makes regenerate possible.
    expect(state.lastInput?.text).toBe("first");
  });

  it("keeps adapter-provided suggestions", () => {
    const state = fold([
      {
        kind: "event",
        event: { type: "suggestions-updated", turnId: TURN, suggestions: ["Undo that"] },
      },
    ]);

    expect(state.suggestions).toEqual(["Undo that"]);
  });
});
