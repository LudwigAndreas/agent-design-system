import { describe, expect, it } from "vitest";
import { operatorsFor, validatePredicate } from "../core/query/validate";
import type { AgentContextReference, QueryPredicate, QuerySchema } from "../types/query";

const SCHEMA: QuerySchema = {
  entity: "account",
  fields: [
    { id: "name", label: "Name", type: "string" },
    { id: "seats", label: "Seats", type: "number" },
    { id: "active", label: "Active", type: "boolean" },
    { id: "createdAt", label: "Created", type: "date" },
    {
      id: "status",
      label: "Status",
      type: "enum",
      values: [{ value: "active" }, { value: "invited" }, { value: "suspended" }],
    },
    {
      id: "owner",
      label: "Owner",
      type: "reference",
      entity: "user",
      lookupBy: ["email"],
    },
    // Deliberately equality-only, to exercise operator narrowing.
    { id: "plan", label: "Plan", type: "string", operators: ["eq"] },
  ],
};

const CONTEXT: AgentContextReference[] = [
  { id: "current-user", description: "The signed-in user", type: "reference", entity: "user" },
  { id: "current-user-unit", description: "Their unit", type: "string" },
];

const check = (predicate: unknown) =>
  validatePredicate(predicate, { schema: SCHEMA, contextReferences: CONTEXT });

describe("predicate validation", () => {
  it("accepts a multi-condition conjunction", () => {
    const predicate: QueryPredicate = {
      kind: "and",
      predicates: [
        { kind: "compare", field: "createdAt", op: "lt", value: "2025-09-11" },
        { kind: "compare", field: "owner", op: "eq", value: { $context: "current-user" } },
        {
          kind: "compare",
          field: "owner",
          op: "eq",
          value: { $lookup: { entity: "user", by: "email", value: "someone@example.com" } },
        },
      ],
    };

    expect(check(predicate)).toEqual([]);
  });

  it("refuses a query submitted as a string", () => {
    const problems = check("createdAt lt 2025-09-11 and ownerId eq 'me'");

    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("not-a-predicate");
    expect(problems[0]?.message).toMatch(/structured predicate/i);
  });

  it("refuses anything that is not a predicate at all", () => {
    expect(check({ createdAt: "2025-09-11" })[0]?.code).toBe("not-a-predicate");
    expect(check(null)[0]?.code).toBe("not-a-predicate");
    expect(check(42)[0]?.code).toBe("not-a-predicate");
  });

  it("names an unknown field and lists the queryable ones", () => {
    const problems = check({ kind: "compare", field: "nope", op: "eq", value: "x" });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("unknown-field");
    expect(problems[0]?.message).toContain('"nope" is not a queryable field');
    expect(problems[0]?.message).toContain("name, seats, active, createdAt, status, owner, plan");
  });

  it("names the permitted operators when one is not allowed", () => {
    const problems = check({ kind: "compare", field: "plan", op: "gt", value: "team" });

    expect(problems[0]?.code).toBe("operator-not-permitted");
    expect(problems[0]?.message).toContain('"gt" is not permitted on "plan"');
    expect(problems[0]?.message).toContain("Permitted operators are: eq");
  });

  it("narrows but never widens the default operators for a type", () => {
    // `contains` is a string default, but `plan` declares only `eq`.
    expect(operatorsFor(SCHEMA.fields[6]!)).toEqual(["eq"]);
    // A field asking for an operator its type has no meaning for gets nothing.
    expect(
      operatorsFor({ id: "x", label: "X", type: "boolean", operators: ["contains", "eq"] }),
    ).toEqual(["eq"]);
  });

  it("lists the permitted values when an enum value is wrong", () => {
    const problems = check({ kind: "compare", field: "status", op: "eq", value: "archived" });

    expect(problems[0]?.code).toBe("value-not-permitted");
    expect(problems[0]?.message).toContain('"archived" is not a permitted value');
    expect(problems[0]?.message).toContain("active, invited, suspended");
  });

  it("rejects a value of the wrong type", () => {
    expect(check({ kind: "compare", field: "seats", op: "eq", value: "many" })[0]).toMatchObject({
      code: "value-type-mismatch",
      field: "seats",
    });
    expect(check({ kind: "compare", field: "active", op: "eq", value: "yes" })[0]).toMatchObject({
      code: "value-type-mismatch",
    });
  });

  it("requires a value for binary operators and forbids one for unary", () => {
    expect(check({ kind: "compare", field: "name", op: "eq" })[0]?.code).toBe("value-required");
    expect(
      check({ kind: "compare", field: "name", op: "isEmpty", value: "x" })[0]?.code,
    ).toBe("value-not-allowed");
    expect(check({ kind: "compare", field: "name", op: "isEmpty" })).toEqual([]);
  });

  it("checks list operators against the element type", () => {
    expect(check({ kind: "compare", field: "status", op: "in", value: ["active"] })).toEqual([]);
    expect(
      check({ kind: "compare", field: "status", op: "in", value: "active" })[0]?.code,
    ).toBe("value-type-mismatch");
    expect(
      check({ kind: "compare", field: "status", op: "in", value: ["nope"] })[0]?.code,
    ).toBe("value-not-permitted");
  });

  it("rejects an undeclared context reference and lists the available ones", () => {
    const problems = check({
      kind: "compare",
      field: "owner",
      op: "eq",
      value: { $context: "current-tenant" },
    });

    expect(problems[0]?.code).toBe("unknown-context-reference");
    expect(problems[0]?.message).toContain("current-user, current-user-unit");
  });

  it("rejects a context reference whose type does not fit the field", () => {
    const problems = check({
      kind: "compare",
      field: "seats",
      op: "eq",
      value: { $context: "current-user" },
    });

    expect(problems[0]?.code).toBe("value-type-mismatch");
    expect(problems[0]?.message).toContain("cannot be compared");
  });

  it("rejects a lookup against the wrong entity or an unsupported field", () => {
    expect(
      check({
        kind: "compare",
        field: "owner",
        op: "eq",
        value: { $lookup: { entity: "team", by: "email", value: "x@y.z" } },
      })[0]?.code,
    ).toBe("value-type-mismatch");

    expect(
      check({
        kind: "compare",
        field: "owner",
        op: "eq",
        value: { $lookup: { entity: "user", by: "phone", value: "123" } },
      })[0],
    ).toMatchObject({ code: "lookup-not-supported" });
  });

  it("rejects a lookup on a field that is not a reference", () => {
    const problems = check({
      kind: "compare",
      field: "name",
      op: "eq",
      value: { $lookup: { entity: "user", by: "email", value: "x@y.z" } },
    });

    expect(problems[0]?.code).toBe("value-type-mismatch");
    expect(problems[0]?.message).toMatch(/only valid on reference fields/i);
  });

  it("reports every problem in a compound predicate, not just the first", () => {
    const problems = check({
      kind: "and",
      predicates: [
        { kind: "compare", field: "nope", op: "eq", value: "x" },
        { kind: "compare", field: "status", op: "eq", value: "archived" },
        { kind: "not", predicate: { kind: "compare", field: "seats", op: "eq", value: "many" } },
      ],
    });

    expect(problems.map((problem) => problem.code)).toEqual([
      "unknown-field",
      "value-not-permitted",
      "value-type-mismatch",
    ]);
  });

  it("accepts an empty conjunction as the empty query", () => {
    expect(check({ kind: "and", predicates: [] })).toEqual([]);
  });
});
