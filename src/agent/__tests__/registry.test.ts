import { describe, expect, it, vi } from "vitest";
import { createAgentRegistry } from "../core/registry";
import { resolveCapabilities } from "../core/capabilities";

const fastRegistry = () => createAgentRegistry({ verifyTimeoutMs: 80 });

/** A switch-like target backed by a mutable cell, standing in for React state. */
function booleanTarget(id: string, initial: boolean, options?: { reject?: boolean }) {
  const cell = { value: initial };
  return {
    cell,
    registration: {
      id,
      label: id,
      handlers: {
        read: () => cell.value,
        write: (next: boolean) => {
          // A refusing application never updates its own state.
          if (!options?.reject) cell.value = next;
        },
      },
    },
  };
}

describe("agent registry", () => {
  it("derives capabilities from the handlers a target actually implements", () => {
    expect(
      resolveCapabilities({ handlers: { read: () => 1, write: () => {} } }),
    ).toEqual(expect.arrayContaining(["read", "write"]));

    expect(resolveCapabilities({ handlers: { read: () => 1 } })).not.toContain("write");
  });

  it("never advertises a capability the target did not implement", () => {
    // Asking for `write` without a write handler must not grant it.
    expect(
      resolveCapabilities({ capabilities: ["read", "write"], handlers: { read: () => 1 } }),
    ).toEqual(["read"]);
  });

  it("reports an unknown target instead of failing silently", async () => {
    const registry = fastRegistry();
    const result = await registry.execute({ type: "toggle", target: "nope" });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("unknown-target");
  });

  it("refuses an action the target cannot perform", async () => {
    const registry = fastRegistry();
    registry.register({ id: "read.only", handlers: { read: () => "x" } });

    const result = await registry.execute({
      type: "set-value",
      target: "read.only",
      value: "y",
    });

    expect(result.error?.code).toBe("capability-unsupported");
  });

  it("writes through the target's own handler and confirms the observed value", async () => {
    const registry = fastRegistry();
    const target = booleanTarget("notifications.email", true);
    registry.register(target.registration);

    const result = await registry.execute({
      type: "toggle",
      target: "notifications.email",
      value: false,
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe(false);
    expect(result.previousValue).toBe(true);
    expect(target.cell.value).toBe(false);
  });

  it("flips the current value when toggle carries no explicit value", async () => {
    const registry = fastRegistry();
    const target = booleanTarget("flag", false);
    registry.register(target.registration);

    await registry.execute({ type: "toggle", target: "flag" });

    expect(target.cell.value).toBe(true);
  });

  it("fails when the application refuses the write, rather than claiming success", async () => {
    const registry = fastRegistry();
    const target = booleanTarget("notifications.sms", false, { reject: true });
    registry.register(target.registration);

    const result = await registry.execute({
      type: "toggle",
      target: "notifications.sms",
      value: true,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("state-not-confirmed");
    // The observed value is reported, not the requested one.
    expect(result.value).toBe(false);
  });

  it("waits for an asynchronous state update before reporting success", async () => {
    const registry = fastRegistry();
    const cell = { value: "a" };
    registry.register({
      id: "async.field",
      handlers: {
        read: () => cell.value,
        // Commits a tick later, the way a React state update does.
        write: (next: string) => {
          setTimeout(() => {
            cell.value = next;
          }, 20);
        },
      },
    });

    const result = await registry.execute({
      type: "set-value",
      target: "async.field",
      value: "b",
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe("b");
  });

  it("rejects an option that is not on offer, and names the valid ones", async () => {
    const registry = fastRegistry();
    const cell = { value: "daily" };
    registry.register({
      id: "notifications.frequency",
      label: "Frequency",
      options: [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
      ],
      handlers: {
        read: () => cell.value,
        write: (next: string) => {
          cell.value = next;
        },
      },
      getState: () => ({
        options: [
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
        ],
      }),
    });

    const result = await registry.execute({
      type: "select-option",
      target: "notifications.frequency",
      value: "hourly",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("invalid-value");
    expect(result.error?.message).toContain("daily, weekly");
    expect(cell.value).toBe("daily");
  });

  it("matches an option by its label when the agent used human wording", async () => {
    const registry = fastRegistry();
    const cell = { value: "daily" };
    const options = [
      { value: "daily", label: "Daily digest" },
      { value: "weekly", label: "Weekly digest" },
    ];
    registry.register({
      id: "frequency",
      options,
      handlers: {
        read: () => cell.value,
        write: (next: string) => {
          cell.value = next;
        },
      },
      getState: () => ({ options }),
    });

    const result = await registry.execute({
      type: "select-option",
      target: "frequency",
      value: "Weekly digest",
    });

    expect(result.success).toBe(true);
    expect(cell.value).toBe("weekly");
  });

  it("honours a target's own validation, which is where authorization lives", async () => {
    const registry = fastRegistry();
    const cell = { value: "Ellen" };
    registry.register({
      id: "profile.name",
      handlers: {
        read: () => cell.value,
        write: (next: string) => {
          cell.value = next;
        },
        validate: (next) => (String(next).length < 2 ? "Name is too short." : undefined),
      },
    });

    const result = await registry.execute({ type: "set-value", target: "profile.name", value: "" });

    expect(result.error?.code).toBe("invalid-value");
    expect(result.error?.userMessage).toBe("Name is too short.");
    expect(cell.value).toBe("Ellen");
  });

  it("produces an undo that restores the previous value", async () => {
    const registry = fastRegistry();
    const target = booleanTarget("flag", true);
    registry.register(target.registration);

    const result = await registry.execute({ type: "toggle", target: "flag", value: false });
    expect(target.cell.value).toBe(false);

    const undone = await result.undo?.();

    expect(undone?.success).toBe(true);
    expect(target.cell.value).toBe(true);
  });

  it("refuses to write to a disabled target", async () => {
    const registry = fastRegistry();
    registry.register({
      id: "disabled.field",
      enabled: false,
      handlers: { read: () => "a", write: () => {} },
      getState: () => ({ enabled: false }),
    });

    const result = await registry.execute({
      type: "set-value",
      target: "disabled.field",
      value: "b",
    });

    expect(result.error?.code).toBe("target-disabled");
  });

  it("routes navigation to the host router and rejects unknown routes", async () => {
    const registry = fastRegistry();
    let route = "dashboard";
    const navigate = vi.fn((target: string) => {
      route = target;
    });
    registry.setEnvironment({ navigate, getRoute: () => ({ route }) });
    registry.registerRoute({ id: "settings.notifications" });

    const good = await registry.execute({ type: "navigate", target: "settings.notifications" });
    expect(good.success).toBe(true);
    expect(navigate).toHaveBeenCalledWith("settings.notifications", undefined);

    const bad = await registry.execute({ type: "navigate", target: "settings.nowhere" });
    expect(bad.error?.code).toBe("unknown-target");
  });

  it("fails navigation when the application never arrives at the route", async () => {
    const registry = fastRegistry();
    // A router that silently ignores the request — a redirect, a guard, a bug.
    registry.setEnvironment({ navigate: () => {}, getRoute: () => ({ route: "dashboard" }) });
    registry.registerRoute({ id: "settings.notifications" });

    const result = await registry.execute({
      type: "navigate",
      target: "settings.notifications",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("state-not-confirmed");
    expect(result.value).toBe("dashboard");
  });

  it("withholds the value of a sensitive target while still publishing it exists", () => {
    const registry = fastRegistry();
    registry.register({
      id: "profile.email",
      label: "Email",
      sensitive: true,
      handlers: { read: () => "ellen@example.com", write: () => {} },
    });

    const element = registry.getElementState("profile.email");

    expect(element?.value).toBeUndefined();
    expect(element?.sensitive).toBe(true);
    expect(element?.capabilities).toContain("write");
  });

  it("publishes a semantic snapshot with no DOM internals in it", () => {
    const registry = fastRegistry();
    registry.setEnvironment({ getRoute: () => ({ route: "settings.notifications" }) });
    registry.registerPage({ id: "settings.notifications", title: "Notifications" });
    registry.register(booleanTarget("notifications.email", true).registration);

    const state = registry.getReadableState();
    const serialised = JSON.stringify(state);

    expect(state.route).toBe("settings.notifications");
    expect(state.page?.title).toBe("Notifications");
    expect(state.elements.map((element) => element.id)).toEqual(["notifications.email"]);
    expect(serialised).not.toContain("nodeType");
    expect(serialised).not.toContain("className");
  });

  it("unregisters cleanly so unmounted UI stops being addressable", async () => {
    const registry = fastRegistry();
    const unregister = registry.register(booleanTarget("temp", true).registration);

    expect(registry.get("temp")).toBeDefined();
    unregister();

    expect(registry.get("temp")).toBeUndefined();
    expect((await registry.execute({ type: "toggle", target: "temp" })).error?.code).toBe(
      "unknown-target",
    );
  });
});
