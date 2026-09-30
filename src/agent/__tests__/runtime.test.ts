import { describe, expect, it, vi } from "vitest";
import { createAgentEventBus } from "../core/eventBus";
import { createAgentRegistry } from "../core/registry";
import { createAgentRuntime } from "../core/runtime";
import type { AgentEvent } from "../types/events";
import type { AgentPolicyResolver } from "../types/policy";

function harness(options: { policy?: AgentPolicyResolver } = {}) {
  const registry = createAgentRegistry({ verifyTimeoutMs: 80 });
  const events = createAgentEventBus();
  const captured: AgentEvent[] = [];
  events.subscribe((event) => captured.push(event));

  const spotlighted: string[] = [];
  const runtime = createAgentRuntime({
    registry,
    events,
    policy: options.policy,
    onSpotlight: (target) => spotlighted.push(target),
  });

  const cell = { value: true };
  const focused: string[] = [];
  registry.register({
    id: "notifications.email",
    label: "Email notifications",
    handlers: {
      read: () => cell.value,
      write: (next: boolean) => {
        cell.value = next;
      },
      // `useAgentTarget` supplies these automatically in a real component.
      focus: () => focused.push("focus"),
      reveal: () => focused.push("reveal"),
    },
  });

  const types = () => captured.map((event) => event.type);

  return { registry, events, runtime, captured, types, cell, spotlighted, focused };
}

describe("agent runtime lifecycle", () => {
  it("moves an unconfirmed action through requested → started → completed", async () => {
    const { runtime, types } = harness();

    const result = await runtime.execute({
      type: "toggle",
      target: "notifications.email",
      value: false,
    });

    expect(result.status).toBe("succeeded");
    expect(types()).toEqual([
      "action-requested",
      "action-started",
      "state-changed",
      "action-completed",
    ]);
  });

  it("records every action in an audit log with its outcome", async () => {
    const { runtime } = harness();

    await runtime.execute({ type: "toggle", target: "notifications.email", value: false });
    await runtime.execute({ type: "toggle", target: "missing.target" });

    const history = runtime.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]?.status).toBe("succeeded");
    expect(history[1]?.status).toBe("failed");
  });

  it("stops before executing when the target does not exist", async () => {
    const { runtime, types } = harness();

    const result = await runtime.execute({ type: "toggle", target: "missing.target" });

    expect(result.error?.code).toBe("unknown-target");
    // No `action-started`: validation happens before anything runs.
    expect(types()).toEqual(["action-requested", "action-failed"]);
  });

  it("asks for confirmation and executes only after the user agrees", async () => {
    const { runtime, cell, captured, types } = harness({
      policy: () => ({ requiresConfirmation: true, reason: "Test policy" }),
    });

    const pending = runtime.execute({
      type: "toggle",
      target: "notifications.email",
      value: false,
    });

    // Let the runtime reach the awaiting-confirmation state.
    await vi.waitFor(() => expect(runtime.getPendingConfirmations()).toHaveLength(1));
    expect(cell.value).toBe(true);
    expect(runtime.getHistory()[0]?.status).toBe("awaiting-confirmation");

    const confirmation = captured.find((event) => event.type === "confirmation-required");
    expect(confirmation).toBeDefined();
    if (confirmation?.type === "confirmation-required") {
      expect(confirmation.preview.changes[0]).toMatchObject({
        label: "Email notifications",
        from: "Enabled",
        to: "Disabled",
      });
    }

    runtime.confirm(runtime.getPendingConfirmations()[0]!.action.id);
    const result = await pending;

    expect(result.success).toBe(true);
    expect(cell.value).toBe(false);
    expect(types()).toContain("confirmation-resolved");
  });

  it("changes nothing when the user cancels", async () => {
    const { runtime, cell } = harness({
      policy: () => ({ requiresConfirmation: true }),
    });

    const pending = runtime.execute({
      type: "toggle",
      target: "notifications.email",
      value: false,
    });
    await vi.waitFor(() => expect(runtime.getPendingConfirmations()).toHaveLength(1));
    runtime.cancelConfirmation(runtime.getPendingConfirmations()[0]!.action.id);

    const result = await pending;

    expect(result.status).toBe("cancelled");
    expect(result.success).toBe(false);
    expect(cell.value).toBe(true);
  });

  it("does not interrupt the user to confirm the user's own action", async () => {
    const { runtime, cell } = harness({ policy: () => ({ requiresConfirmation: true }) });

    // `source: "user"` means the human already expressed the intent directly.
    const result = await runtime.execute({
      type: "toggle",
      target: "notifications.email",
      value: false,
      source: "user",
    });

    expect(result.success).toBe(true);
    expect(cell.value).toBe(false);
  });

  it("treats navigation and reveal as low-risk by default", async () => {
    const { registry, runtime, spotlighted, focused } = harness();
    let route = "dashboard";
    const navigate = vi.fn((target: string) => {
      route = target;
    });
    registry.setEnvironment({ navigate, getRoute: () => ({ route }) });

    await runtime.navigate("settings.notifications");
    await runtime.reveal("notifications.email");

    expect(navigate).toHaveBeenCalled();
    expect(runtime.getPendingConfirmations()).toHaveLength(0);
    expect(spotlighted).toContain("notifications.email");
    expect(focused).toContain("reveal");
  });

  it("confirms sensitive targets without any application policy at all", async () => {
    const registry = createAgentRegistry({ verifyTimeoutMs: 80 });
    const events = createAgentEventBus();
    const runtime = createAgentRuntime({ registry, events });
    registry.register({
      id: "security.two-factor",
      label: "Two-factor authentication",
      sensitive: true,
      handlers: { read: () => true, write: () => {} },
    });

    void runtime.execute({ type: "toggle", target: "security.two-factor", value: false });

    await vi.waitFor(() => expect(runtime.getPendingConfirmations()).toHaveLength(1));
    runtime.cancelConfirmation(runtime.getPendingConfirmations()[0]!.action.id);
  });

  it("emits fresh state after acting, so the adapter cannot rely on a stale view", async () => {
    const { runtime, captured } = harness();

    await runtime.execute({ type: "toggle", target: "notifications.email", value: false });

    const stateChanged = captured.find((event) => event.type === "state-changed");
    expect(stateChanged).toBeDefined();
    if (stateChanged?.type === "state-changed") {
      expect(stateChanged.state.elements[0]?.value).toBe(false);
      expect(stateChanged.cause).toBe("agent");
    }
  });

  it("undoes the most recent reversible action and then retires the affordance", async () => {
    const { runtime, cell } = harness();

    await runtime.execute({ type: "toggle", target: "notifications.email", value: false });
    expect(cell.value).toBe(false);

    const undone = await runtime.undoLast();
    expect(undone?.success).toBe(true);
    expect(cell.value).toBe(true);

    // The undo of the undo is not offered: an undo is available once.
    const again = await runtime.undoLast();
    expect(again?.action.target).not.toBe("notifications.email");
  });

  it("reports a thrown application error instead of surfacing an exception", async () => {
    const { registry, runtime } = harness();
    registry.register({
      id: "broken",
      handlers: {
        read: () => "a",
        write: () => {
          throw new Error("The account settings service is unavailable.");
        },
      },
    });

    const result = await runtime.execute({ type: "set-value", target: "broken", value: "b" });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("execution-failed");
    expect(result.error?.message).toContain("account settings service");
  });
});
