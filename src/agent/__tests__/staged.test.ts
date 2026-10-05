import { describe, expect, it, vi } from "vitest";
import { createAgentEventBus } from "../core/eventBus";
import { createAgentRegistry } from "../core/registry";
import { createAgentRuntime } from "../core/runtime";
import type { AgentEvent } from "../types/events";
import type { QueryPredicate, QuerySchema } from "../types/query";
import type { StagedRunOutcome } from "../types/staged";

const SCHEMA: QuerySchema = {
  entity: "account",
  fields: [
    { id: "status", label: "Status", type: "enum", values: [{ value: "active" }] },
    { id: "seats", label: "Seats", type: "number" },
  ],
};

/**
 * A page with a query-capable table and a declared export that stages.
 * Mirrors the shape the reference application uses.
 */
function harness(options: { run?: () => StagedRunOutcome | Promise<StagedRunOutcome> } = {}) {
  const registry = createAgentRegistry({ verifyTimeoutMs: 80 });
  const events = createAgentEventBus();
  const captured: AgentEvent[] = [];
  events.subscribe((event) => captured.push(event));
  // `invoke` confirms by default; these tests are about staging, so the
  // confirmation step is switched off except where it is the subject.
  const runtime = createAgentRuntime({
    registry,
    events,
    policy: () => ({ requiresConfirmation: false }),
  });

  const table = { predicate: { kind: "and", predicates: [] } as QueryPredicate, rows: 10 };

  registry.register({
    id: "accounts.table",
    label: "Accounts",
    querySchema: SCHEMA,
    handlers: {
      read: () => table.predicate,
      write: (next: QueryPredicate) => {
        table.predicate = next;
        // Any query narrows the set, which is enough to move the count.
        table.rows = next.kind === "and" && next.predicates.length === 0 ? 10 : 4;
      },
    },
    getState: () => ({ data: { rowCount: table.rows } }),
  });

  const run = vi.fn(
    options.run ??
      (() => ({
        message: "Exported 4 accounts",
        artifact: {
          filename: "accounts.xlsx",
          mediaType: "application/vnd.ms-excel",
          url: "blob:test",
        },
      })),
  );

  registry.registerPage({
    id: "accounts",
    actions: [
      {
        id: "accounts.export",
        label: "Export accounts",
        description: "Download the matching accounts as a spreadsheet.",
        stages: true,
        queryTarget: "accounts.table",
      },
    ],
  });

  registry.register({
    id: "accounts.export",
    label: "Export accounts",
    role: "action",
    page: "accounts",
    handlers: { invoke: () => run() },
  });

  return { registry, runtime, events, captured, table, run };
}

const applyQuery = (runtime: ReturnType<typeof harness>["runtime"]) =>
  runtime.execute({
    type: "filter",
    target: "accounts.table",
    filter: { kind: "compare", field: "status", op: "eq", value: "active" },
  });

describe("staged operations", () => {
  it("prepares the operation instead of performing it", async () => {
    const { runtime, run, captured } = harness();

    const result = await runtime.execute({ type: "invoke", target: "accounts.export" });

    expect(result.status).toBe("staged");
    expect(result.success).toBe(false);
    expect(result.staged).toBeDefined();
    // Nothing was done and no artifact exists.
    expect(run).not.toHaveBeenCalled();
    expect(result.staged?.result).toBeUndefined();
    expect(captured.some((event) => event.type === "action-staged")).toBe(true);
  });

  it("is distinct from confirmation: approval stages, it does not run", async () => {
    const registry = createAgentRegistry({ verifyTimeoutMs: 80 });
    const events = createAgentEventBus();
    const run = vi.fn(() => ({ message: "done" }));
    const runtime = createAgentRuntime({
      registry,
      events,
      policy: () => ({ requiresConfirmation: true }),
    });
    registry.registerPage({
      id: "p",
      actions: [{ id: "p.export", label: "Export", stages: true }],
    });
    registry.register({ id: "p.export", label: "Export", handlers: { invoke: () => run() } });

    const pending = runtime.execute({ type: "invoke", target: "p.export" });
    await vi.waitFor(() => expect(runtime.getPendingConfirmations()).toHaveLength(1));
    runtime.confirm(runtime.getPendingConfirmations()[0]!.action.id);
    const result = await pending;

    // Approval got it prepared; running it still needs a trigger.
    expect(result.status).toBe("staged");
    expect(run).not.toHaveBeenCalled();
  });

  it("shows the query and the matching count it was prepared against", async () => {
    const { runtime } = harness();
    await applyQuery(runtime);

    const result = await runtime.execute({ type: "invoke", target: "accounts.export" });

    expect(result.staged?.summary).toMatchObject({
      title: "Export accounts",
      description: "Download the matching accounts as a spreadsheet.",
      matchCount: 4,
    });
    expect(result.staged?.summary.predicate).toBeDefined();
  });

  it("runs when the user triggers it and delivers the artifact", async () => {
    const { runtime, run } = harness();
    await applyQuery(runtime);
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;

    const result = await runtime.triggerStaged(staged.id);

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.staged?.status).toBe("completed");
    expect(result.staged?.result?.artifact?.filename).toBe("accounts.xlsx");
  });

  it("refuses an agent-initiated trigger and leaves it staged", async () => {
    const { runtime, run } = harness();
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;

    const result = await runtime.triggerStaged(staged.id, "agent");

    expect(run).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("requires-user-trigger");
    expect(runtime.getStagedOperations()[0]?.status).toBe("staged");
  });

  it("reports a failure from the application rather than claiming success", async () => {
    const { runtime } = harness({
      run: () => {
        throw new Error("The export service is unavailable.");
      },
    });
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;

    const result = await runtime.triggerStaged(staged.id);

    expect(result.success).toBe(false);
    expect(result.staged?.status).toBe("failed");
    expect(result.message).toContain("export service is unavailable");
  });

  it("goes stale when the query changes, and does not run on the first trigger", async () => {
    const { runtime, run } = harness();
    await applyQuery(runtime);
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;
    expect(staged.summary.matchCount).toBe(4);

    // The query is cleared, so the staged export no longer describes reality.
    await runtime.execute({
      type: "filter",
      target: "accounts.table",
      filter: { kind: "and", predicates: [] },
    });

    const first = await runtime.triggerStaged(staged.id);

    expect(run).not.toHaveBeenCalled();
    expect(first.staged?.status).toBe("stale");
    expect(first.staged?.staleReason).toContain("changed");
    // The user is shown what it would run against now.
    expect(first.staged?.summary.matchCount).toBe(10);
  });

  it("runs a stale operation against current state once the user proceeds", async () => {
    const { runtime, run, table } = harness();
    await applyQuery(runtime);
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;
    await runtime.execute({
      type: "filter",
      target: "accounts.table",
      filter: { kind: "and", predicates: [] },
    });
    await runtime.triggerStaged(staged.id);

    const second = await runtime.triggerStaged(staged.id);

    expect(run).toHaveBeenCalledTimes(1);
    expect(second.success).toBe(true);
    // Current state, not the state recorded at preparation.
    expect(second.staged?.summary.matchCount).toBe(table.rows);
    expect(second.staged?.summary.matchCount).toBe(10);
  });

  it("discards without performing any part of the work", async () => {
    const { runtime, run, table } = harness();
    await applyQuery(runtime);
    const before = { ...table };
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;

    runtime.discardStaged(staged.id);

    expect(run).not.toHaveBeenCalled();
    expect(runtime.getStagedOperations()[0]?.status).toBe("discarded");
    expect(table.rows).toBe(before.rows);
    expect(table.predicate).toEqual(before.predicate);
  });

  it("a discarded operation cannot then be triggered", async () => {
    const { runtime, run } = harness();
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;
    runtime.discardStaged(staged.id);

    await runtime.triggerStaged(staged.id);

    expect(run).not.toHaveBeenCalled();
    expect(runtime.getStagedOperations()[0]?.status).toBe("discarded");
  });

  it("discards an operation whose target unmounts", async () => {
    const { runtime, registry } = harness();
    await runtime.execute({ type: "invoke", target: "accounts.export" });
    expect(runtime.getStagedOperations()[0]?.status).toBe("staged");

    registry.unregister("accounts.export");

    // Checked after a grace period, so a re-render is not mistaken for an
    // unmount.
    await vi.waitFor(() =>
      expect(runtime.getStagedOperations()[0]?.status).toBe("discarded"),
    );
  });

  it("survives a target re-registering, as happens on any re-render", async () => {
    const { runtime, registry, run } = harness();
    await runtime.execute({ type: "invoke", target: "accounts.export" });

    // Exactly what React does when a target's description changes.
    registry.unregister("accounts.export");
    registry.register({
      id: "accounts.export",
      label: "Export accounts",
      page: "accounts",
      handlers: { invoke: () => run() },
    });

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(runtime.getStagedOperations()[0]?.status).toBe("staged");
  });

  it("publishes live staged operations in the agent-readable state", async () => {
    const { runtime, registry } = harness();
    const staged = (await runtime.execute({ type: "invoke", target: "accounts.export" })).staged!;

    expect(registry.getReadableState().stagedOperations).toEqual([
      { id: staged.id, label: "Export accounts", status: "staged" },
    ]);

    runtime.discardStaged(staged.id);

    // Settled operations drop out: they are not awaiting anyone.
    expect(registry.getReadableState().stagedOperations).toEqual([]);
  });
});
