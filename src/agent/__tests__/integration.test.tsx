import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentChat } from "../components/AgentChat";
import { AgentContext } from "../components/AgentContext";
import { AgentStatusRegion } from "../components/AgentStatusRegion";
import { AgentProvider } from "../react/AgentProvider";
import { useAgent } from "../hooks/useAgent";
import type { AgentAdapter, AgentTurnContext } from "../types/adapter";
import type { AgentEvent } from "../types/events";
import { Select } from "../../design-system/Select";
import { Switch } from "../../design-system/Switch";

/** An adapter driven by a script, standing in for a model. */
function scriptedAdapter(
  script: (context: AgentTurnContext) => AsyncGenerator<AgentEvent>,
): AgentAdapter {
  return { id: "scripted", sendMessage: script };
}

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

interface SettingsHarnessProps {
  /** Simulates an application that refuses the change. */
  refuseEmail?: boolean;
  onChange?: (change: { key: string; value: unknown; source: string }) => void;
}

function SettingsHarness({ refuseEmail, onChange }: SettingsHarnessProps) {
  const [email, setEmail] = useState(true);
  const [frequency, setFrequency] = useState("daily");

  return (
    <AgentContext
      page="settings.notifications"
      title="Notification settings"
      context="Controls notification channels."
      suggestions={["Turn off email notifications"]}
    >
      <Switch
        agentId="notifications.email"
        label="Email notifications"
        checked={email}
        onCheckedChange={(next, meta) => {
          onChange?.({ key: "email", value: next, source: meta.source });
          // Application business logic decides whether the change lands.
          if (!refuseEmail) setEmail(next);
        }}
      />
      <Select
        agentId="notifications.frequency"
        label="Frequency"
        value={frequency}
        options={FREQUENCIES}
        onValueChange={(next, meta) => {
          onChange?.({ key: "frequency", value: next, source: meta.source });
          setFrequency(next);
        }}
      />
      <div data-testid="probe">{`${email}|${frequency}`}</div>
    </AgentContext>
  );
}

function renderApp(
  adapter: AgentAdapter,
  harness: SettingsHarnessProps = {},
  extra?: React.ReactNode,
) {
  return render(
    <AgentProvider adapter={adapter} verifyTimeoutMs={300} spotlightDurationMs={50}>
      <AgentStatusRegion />
      <SettingsHarness {...harness} />
      {extra}
      <AgentChat />
    </AgentProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("agent-operated UI", () => {
  it("routes an agent toggle through the component's own change handler", async () => {
    const changes: { key: string; value: unknown; source: string }[] = [];
    const adapter = scriptedAdapter(async function* (context) {
      const result = await context.execute({
        type: "toggle",
        target: "notifications.email",
        value: false,
      });
      yield {
        type: "text-delta",
        turnId: context.turnId,
        delta: result.success ? "Email notifications are now off." : "I couldn't do that.",
      };
    });

    renderApp(adapter, { onChange: (change) => changes.push(change) });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "turn off email");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /Email notifications/ })).toHaveAttribute(
        "aria-checked",
        "false",
      ),
    );

    // The same callback a click uses — tagged as agent-sourced, not user-sourced.
    expect(changes).toEqual([{ key: "email", value: false, source: "agent" }]);
    expect(screen.getByTestId("probe").textContent).toBe("false|daily");
    expect(await screen.findByText("Email notifications are now off.")).toBeTruthy();
  });

  it("reports failure when the application refuses the change", async () => {
    const seen: { success: boolean; code?: string }[] = [];
    const adapter = scriptedAdapter(async function* (context) {
      const result = await context.execute({
        type: "toggle",
        target: "notifications.email",
        value: false,
      });
      seen.push({ success: result.success, code: result.error?.code });
      yield { type: "text-delta", turnId: context.turnId, delta: "done" };
    });

    renderApp(adapter, { refuseEmail: true });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "turn off email");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(seen).toHaveLength(1));

    // The UI never pretended: the switch is still on, and the agent was told so.
    expect(seen[0]).toEqual({ success: false, code: "state-not-confirmed" });
    expect(screen.getByRole("switch", { name: /Email notifications/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("gives the agent a fresh view after the user changes something mid-turn", async () => {
    const observed: (unknown | undefined)[] = [];
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const adapter = scriptedAdapter(async function* (context) {
      const before = context.state.elements.find((e) => e.id === "notifications.email");
      observed.push(before?.value);
      await gate;
      // Re-reading is the correct habit; the snapshot is already stale.
      const after = context.getState().elements.find((e) => e.id === "notifications.email");
      observed.push(after?.value);
      yield { type: "text-delta", turnId: context.turnId, delta: "ok" };
    });

    renderApp(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "what is on?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(observed).toHaveLength(1));

    // The human flips the switch while the turn is in flight.
    await user.click(screen.getByRole("switch", { name: /Email notifications/ }));
    act(() => release?.());

    await waitFor(() => expect(observed).toHaveLength(2));
    expect(observed).toEqual([true, false]);
  });

  it("selects an option by value and rejects one that is not offered", async () => {
    const results: string[] = [];
    const adapter = scriptedAdapter(async function* (context) {
      const good = await context.execute({
        type: "select-option",
        target: "notifications.frequency",
        value: "weekly",
      });
      results.push(good.success ? `ok:${String(good.value)}` : `fail:${good.error?.code}`);

      const bad = await context.execute({
        type: "select-option",
        target: "notifications.frequency",
        value: "hourly",
      });
      results.push(bad.success ? "ok" : `fail:${bad.error?.code}`);
      yield { type: "text-delta", turnId: context.turnId, delta: "done" };
    });

    renderApp(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "weekly please");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(results).toHaveLength(2));
    expect(results).toEqual(["ok:weekly", "fail:invalid-value"]);
    expect(screen.getByTestId("probe").textContent).toBe("true|weekly");
  });

  it("asks in the chat before a confirmed action, and applies it on confirm", async () => {
    const adapter = scriptedAdapter(async function* (context) {
      const result = await context.execute({
        type: "toggle",
        target: "notifications.email",
        value: false,
        reason: "You asked me to turn email off.",
      });
      yield {
        type: "text-delta",
        turnId: context.turnId,
        delta: result.success ? "Turned off." : "Left alone.",
      };
    });

    render(
      <AgentProvider
        adapter={adapter}
        verifyTimeoutMs={300}
        policy={() => ({ requiresConfirmation: true, reason: "Policy requires it." })}
      >
        <SettingsHarness />
        <AgentChat />
      </AgentProvider>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "turn off email");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const preview = await screen.findByRole("group", { name: /Agent wants to change/ });
    expect(within(preview).getByText("Email notifications")).toBeTruthy();
    expect(within(preview).getByText("Enabled")).toBeTruthy();
    expect(within(preview).getByText("Disabled")).toBeTruthy();
    // Nothing has changed while the question is open.
    expect(screen.getByTestId("probe").textContent).toBe("true|daily");

    await user.click(within(preview).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("false|daily"));
    expect(await screen.findByText("Turned off.")).toBeTruthy();
  });

  it("changes nothing when the user cancels the confirmation", async () => {
    const adapter = scriptedAdapter(async function* (context) {
      const result = await context.execute({
        type: "toggle",
        target: "notifications.email",
        value: false,
      });
      yield {
        type: "text-delta",
        turnId: context.turnId,
        delta: result.status === "cancelled" ? "No problem." : "Changed it.",
      };
    });

    render(
      <AgentProvider
        adapter={adapter}
        verifyTimeoutMs={300}
        policy={() => ({ requiresConfirmation: true })}
      >
        <SettingsHarness />
        <AgentChat />
      </AgentProvider>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "turn off email");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const preview = await screen.findByRole("group", { name: /Agent wants to change/ });
    await user.click(within(preview).getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("No problem.")).toBeTruthy();
    expect(screen.getByTestId("probe").textContent).toBe("true|daily");
    expect(screen.getByText("Cancelled — nothing was changed")).toBeTruthy();
  });

  it("offers an undo that puts the value back", async () => {
    const adapter = scriptedAdapter(async function* (context) {
      await context.execute({ type: "toggle", target: "notifications.email", value: false });
      yield { type: "text-delta", turnId: context.turnId, delta: "done" };
    });

    renderApp(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "turn off email");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("false|daily"));
    await user.click(await screen.findByRole("button", { name: "Undo" }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("true|daily"));
    expect(screen.getByText("Undone")).toBeTruthy();
  });

  it("announces completed agent actions in a single polite live region", async () => {
    const adapter = scriptedAdapter(async function* (context) {
      await context.execute({ type: "toggle", target: "notifications.email", value: false });
      yield { type: "text-delta", turnId: context.turnId, delta: "done" };
    });

    renderApp(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "turn off email");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(status.textContent).toMatch(/Agent Set Email notifications to off/));
  });

  it("spotlights a revealed target without taking keyboard focus", async () => {
    const adapter = scriptedAdapter(async function* (context) {
      await context.execute({ type: "reveal", target: "notifications.email" });
      yield { type: "text-delta", turnId: context.turnId, delta: "over here" };
    });

    renderApp(adapter);
    const user = userEvent.setup();
    const composer = screen.getByLabelText("Message the agent");

    await user.type(composer, "where is email?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const control = screen.getByRole("switch", { name: /Email notifications/ });
    await waitFor(() => expect(control).toHaveAttribute("data-agent-spotlight", "true"));
    // Reveal is a visual cue only; focus stays where the user left it.
    expect(document.activeElement).not.toBe(control);
  });

  it("moves focus deliberately when the agent focuses a control", async () => {
    const adapter = scriptedAdapter(async function* (context) {
      await context.execute({ type: "focus", target: "notifications.frequency" });
      yield { type: "text-delta", turnId: context.turnId, delta: "focused" };
    });

    renderApp(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "focus frequency");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Frequency")),
    );
  });

  it("publishes page context, capabilities and declared actions to the adapter", async () => {
    let captured: ReturnType<AgentTurnContext["getState"]> | undefined;
    const adapter = scriptedAdapter(async function* (context) {
      captured = context.state;
      yield { type: "text-delta", turnId: context.turnId, delta: "ok" };
    });

    renderApp(adapter);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "what can you do?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(captured).toBeDefined());
    expect(captured!.page).toMatchObject({
      id: "settings.notifications",
      title: "Notification settings",
      context: "Controls notification channels.",
    });
    const email = captured!.elements.find((element) => element.id === "notifications.email");
    expect(email).toMatchObject({ label: "Email notifications", value: true, role: "switch" });
    expect(email!.capabilities).toEqual(expect.arrayContaining(["read", "write", "focus"]));
    // No DOM detail leaks into what the model sees.
    expect(JSON.stringify(captured)).not.toMatch(/class|nodeName|tagName/i);
  });

  it("runs a page-declared action through the registry", async () => {
    const ran: string[] = [];
    const adapter = scriptedAdapter(async function* (context) {
      const result = await context.execute({ type: "invoke", target: "notifications.reset" });
      ran.push(result.success ? "ok" : `fail:${result.error?.code}`);
      yield { type: "text-delta", turnId: context.turnId, delta: "done" };
    });

    render(
      <AgentProvider
        adapter={adapter}
        verifyTimeoutMs={300}
        policy={() => ({ requiresConfirmation: false })}
      >
        <AgentContext
          page="settings.notifications"
          actions={[
            {
              id: "notifications.reset",
              label: "Reset notification preferences",
              run: () => void ran.push("reset"),
            },
          ]}
        >
          <div />
        </AgentContext>
        <AgentChat />
      </AgentProvider>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "reset them");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(ran).toEqual(["reset", "ok"]));
  });

  it("stops a turn without leaving a confirmation hanging", async () => {
    const adapter = scriptedAdapter(async function* (context) {
      const result = await context.execute({
        type: "toggle",
        target: "notifications.email",
        value: false,
      });
      yield {
        type: "text-delta",
        turnId: context.turnId,
        delta: `resolved:${result.status}`,
      };
    });

    render(
      <AgentProvider
        adapter={adapter}
        verifyTimeoutMs={300}
        policy={() => ({ requiresConfirmation: true })}
      >
        <SettingsHarness />
        <AgentChat />
      </AgentProvider>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "turn off email");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("group", { name: /Agent wants to change/ });

    await user.click(screen.getByRole("button", { name: "Stop generating" }));

    // The pending action resolves as cancelled rather than dangling forever.
    await waitFor(() =>
      expect(screen.getByText(/Cancelled — nothing was changed/)).toBeTruthy(),
    );
    expect(screen.getByTestId("probe").textContent).toBe("true|daily");
  });

  it("unregisters a target when its component unmounts", async () => {
    let getState: AgentTurnContext["getState"] | undefined;
    const adapter = scriptedAdapter(async function* (context) {
      getState = context.getState;
      yield { type: "text-delta", turnId: context.turnId, delta: "ok" };
    });

    function Toggleable() {
      const [mounted, setMounted] = useState(true);
      const agent = useAgent();
      return (
        <>
          <button type="button" onClick={() => setMounted(false)}>
            unmount
          </button>
          {mounted ? (
            <Switch agentId="ephemeral" label="Ephemeral" checked onCheckedChange={() => {}} />
          ) : null}
          <div data-testid="count">{agent.getState().elements.length}</div>
        </>
      );
    }

    render(
      <AgentProvider adapter={adapter} verifyTimeoutMs={300}>
        <Toggleable />
        <AgentChat />
      </AgentProvider>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Message the agent"), "hi");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(getState).toBeDefined());
    expect(getState!().elements.some((element) => element.id === "ephemeral")).toBe(true);

    await user.click(screen.getByRole("button", { name: "unmount" }));

    expect(getState!().elements.some((element) => element.id === "ephemeral")).toBe(false);
  });
});
