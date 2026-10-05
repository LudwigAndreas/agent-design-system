import { describe, expect, it, vi } from "vitest";
import { interpretDate, resolvePredicate } from "../core/query/resolve";
import { resolvedComparisons, type QueryPredicate, type QuerySchema } from "../types/query";
import type { ContextResolution, LookupResolution } from "../types/registry";

const SCHEMA: QuerySchema = {
  entity: "account",
  fields: [
    { id: "createdAt", label: "Created", type: "date" },
    { id: "unit", label: "Unit", type: "string" },
    { id: "owner", label: "Owner", type: "reference", entity: "user", lookupBy: ["email"] },
    { id: "approver", label: "Approver", type: "reference", entity: "user", lookupBy: ["email"] },
    {
      id: "status",
      label: "Status",
      type: "enum",
      values: [{ value: "active", label: "Active" }],
    },
  ],
};

const DIRECTORY: Record<string, { id: string; name: string }> = {
  "priya@northwind.example": { id: "usr_1", name: "Priya Raman" },
};

const deps = (overrides: Partial<Parameters<typeof resolvePredicate>[1]> = {}) => ({
  schema: SCHEMA,
  locale: { dateOrder: "DMY" as const, locale: "en-GB" },
  resolveContext: (id: string): ContextResolution =>
    id === "current-user"
      ? { ok: true, value: "usr_me", display: "Ellen Nakamura" }
      : id === "current-user-unit"
        ? { ok: true, value: "unit-north", display: "Northern region" }
        : { ok: false, reason: "no such reference" },
  lookupEntity: (_entity: string, _by: string, value: string): LookupResolution => {
    if (value === "ambiguous@example.com") return { ok: false, reason: "ambiguous", matches: 3 };
    const match = DIRECTORY[value];
    return match
      ? { ok: true, value: match.id, display: match.name }
      : { ok: false, reason: "not-found" };
  },
  ...overrides,
});

describe("value resolution", () => {
  it("resolves a context reference without exposing the resolved value", async () => {
    const predicate: QueryPredicate = {
      kind: "compare",
      field: "owner",
      op: "eq",
      value: { $context: "current-user" },
    };

    const outcome = await resolvePredicate(predicate, deps());

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const [leaf] = resolvedComparisons(outcome.predicate);
    // The value travels for execution; the display is what anyone reads.
    expect(leaf?.value).toBe("usr_me");
    expect(leaf?.display).toBe("Ellen Nakamura");
  });

  it("fails when a context reference cannot be resolved", async () => {
    const outcome = await resolvePredicate(
      { kind: "compare", field: "unit", op: "eq", value: { $context: "current-user-unit" } },
      deps({ resolveContext: () => ({ ok: false, reason: "this user has no unit" }) }),
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems[0]?.code).toBe("context-unresolved");
    expect(outcome.problems[0]?.message).toContain("this user has no unit");
  });

  it("resolves an email to a person and names who was matched", async () => {
    const outcome = await resolvePredicate(
      {
        kind: "compare",
        field: "approver",
        op: "eq",
        value: { $lookup: { entity: "user", by: "email", value: "priya@northwind.example" } },
      },
      deps(),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const [leaf] = resolvedComparisons(outcome.predicate);
    expect(leaf?.value).toBe("usr_1");
    expect(leaf?.display).toBe("Priya Raman");
  });

  it("reports a lookup that matches nobody, naming the entity searched", async () => {
    const outcome = await resolvePredicate(
      {
        kind: "compare",
        field: "approver",
        op: "eq",
        value: { $lookup: { entity: "user", by: "email", value: "ghost@example.com" } },
      },
      deps(),
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems[0]?.code).toBe("lookup-not-found");
    expect(outcome.problems[0]?.message).toBe(
      'No user was found with email "ghost@example.com".',
    );
  });

  it("reports an ambiguous lookup with the number of matches", async () => {
    const outcome = await resolvePredicate(
      {
        kind: "compare",
        field: "approver",
        op: "eq",
        value: { $lookup: { entity: "user", by: "email", value: "ambiguous@example.com" } },
      },
      deps(),
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems[0]?.code).toBe("lookup-ambiguous");
    expect(outcome.problems[0]?.message).toContain("matches 3 user records");
  });

  it("abandons the whole predicate when one reference of several fails", async () => {
    const lookup = vi.fn(
      (_e: string, _b: string, value: string): LookupResolution =>
        value === "ghost@example.com"
          ? { ok: false, reason: "not-found" }
          : { ok: true, value: "usr_1", display: "Priya Raman" },
    );

    const outcome = await resolvePredicate(
      {
        kind: "and",
        predicates: [
          { kind: "compare", field: "createdAt", op: "lt", value: "11.09.2025" },
          { kind: "compare", field: "owner", op: "eq", value: { $context: "current-user" } },
          {
            kind: "compare",
            field: "approver",
            op: "eq",
            value: { $lookup: { entity: "user", by: "email", value: "ghost@example.com" } },
          },
        ],
      },
      deps({ lookupEntity: lookup }),
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // One problem, naming the condition that failed — not three.
    expect(outcome.problems).toHaveLength(1);
    expect(outcome.problems[0]).toMatchObject({ code: "lookup-not-found", field: "approver" });
  });

  it("reports every failure in one pass", async () => {
    const outcome = await resolvePredicate(
      {
        kind: "and",
        predicates: [
          { kind: "compare", field: "owner", op: "eq", value: { $context: "nope" } },
          {
            kind: "compare",
            field: "approver",
            op: "eq",
            value: { $lookup: { entity: "user", by: "email", value: "ghost@example.com" } },
          },
        ],
      },
      deps(),
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems.map((problem) => problem.code)).toEqual([
      "context-unresolved",
      "lookup-not-found",
    ]);
  });

  it("renders an enum value by its label", async () => {
    const outcome = await resolvePredicate(
      { kind: "compare", field: "status", op: "eq", value: "active" },
      deps(),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(resolvedComparisons(outcome.predicate)[0]?.display).toBe("Active");
  });
});

describe("date interpretation", () => {
  it("reads a numeric date the way the application declares", () => {
    expect(interpretDate("11.09.2025", { dateOrder: "DMY" })).toMatchObject({
      iso: "2025-09-11",
    });
    expect(interpretDate("11.09.2025", { dateOrder: "MDY" })).toMatchObject({
      iso: "2025-11-09",
    });
    expect(interpretDate("2025-09-11", { dateOrder: "MDY" })).toMatchObject({
      iso: "2025-09-11",
    });
  });

  it("always renders the month by name, never numerically", () => {
    const date = interpretDate("11.09.2025", { dateOrder: "DMY", locale: "en-GB" });

    expect(date?.display).toBe("11 September 2025");
    expect(date?.display).not.toMatch(/\d{2}[./-]\d{2}/);
  });

  it("rejects a date that does not exist", () => {
    expect(interpretDate("31.02.2025", { dateOrder: "DMY" })).toBeNull();
    expect(interpretDate("not a date", { dateOrder: "DMY" })).toBeNull();
  });

  it("carries the unambiguous reading into the resolved predicate", async () => {
    const outcome = await resolvePredicate(
      { kind: "compare", field: "createdAt", op: "lt", value: "11.09.2025" },
      deps(),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const [leaf] = resolvedComparisons(outcome.predicate);
    expect(leaf?.value).toBe("2025-09-11");
    expect(leaf?.display).toBe("11 September 2025");
  });

  it("fails a date it cannot read, naming the expected format", async () => {
    const outcome = await resolvePredicate(
      { kind: "compare", field: "createdAt", op: "lt", value: "sometime last autumn" },
      deps(),
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problems[0]?.message).toContain("DMY");
  });
});
