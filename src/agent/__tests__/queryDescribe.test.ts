import { describe, expect, it } from "vitest";
import {
  describeCondition,
  describeConditions,
  describeMatchCount,
  describePredicate,
} from "../core/query/describe";
import type { ResolvedPredicate } from "../types/query";

const date: ResolvedPredicate = {
  kind: "compare",
  field: "createdAt",
  label: "Created",
  op: "lt",
  value: "2025-09-11",
  display: "11 September 2025",
};

const owner: ResolvedPredicate = {
  kind: "compare",
  field: "owner",
  label: "Owner",
  op: "eq",
  value: "usr_me",
  display: "Ellen Nakamura",
};

const approver: ResolvedPredicate = {
  kind: "compare",
  field: "approver",
  label: "Approver",
  op: "eq",
  value: "usr_1",
  display: "Priya Raman",
};

describe("describing a resolved query", () => {
  it("reads a condition as a sentence, using the display value", () => {
    expect(describeCondition(date as never)).toBe("Created is before 11 September 2025");
    // Never the numeric form the agent sent.
    expect(describeCondition(date as never)).not.toContain("11.09");
  });

  it("names the person a reference resolved to", () => {
    expect(describeCondition(approver as never)).toBe("Approver is Priya Raman");
  });

  it("joins a conjunction with 'and'", () => {
    const predicate: ResolvedPredicate = {
      kind: "and",
      predicates: [date, owner, approver],
    };

    expect(describePredicate(predicate)).toBe(
      "Created is before 11 September 2025 and Owner is Ellen Nakamura and Approver is Priya Raman",
    );
  });

  it("parenthesises nested disjunction rather than flattening it", () => {
    const predicate: ResolvedPredicate = {
      kind: "and",
      predicates: [date, { kind: "or", predicates: [owner, approver] }],
    };

    expect(describePredicate(predicate)).toBe(
      "Created is before 11 September 2025 and (Owner is Ellen Nakamura or Approver is Priya Raman)",
    );
  });

  it("renders negation explicitly", () => {
    expect(describePredicate({ kind: "not", predicate: owner })).toBe(
      "not (Owner is Ellen Nakamura)",
    );
  });

  it("reads numeric comparisons numerically, not temporally", () => {
    const seats: ResolvedPredicate = {
      kind: "compare",
      field: "seats",
      label: "Seats",
      op: "gt",
      value: 100,
      display: "100",
    };

    expect(describeCondition(seats as never)).toBe("Seats is after 100");
    expect(describeCondition(seats as never, { numericFields: ["seats"] })).toBe(
      "Seats is more than 100",
    );
  });

  it("renders unary operators without a value", () => {
    const empty: ResolvedPredicate = {
      kind: "compare",
      field: "approver",
      label: "Approver",
      op: "isEmpty",
      display: "is empty",
    };

    expect(describeCondition(empty as never)).toBe("Approver is empty");
  });

  it("splits a predicate into one entry per condition, for chips", () => {
    const entries = describeConditions({ kind: "and", predicates: [date, owner] });

    expect(entries.map((entry) => entry.text)).toEqual([
      "Created is before 11 September 2025",
      "Owner is Ellen Nakamura",
    ]);
    expect(entries[0]?.condition.field).toBe("createdAt");
  });

  it("describes an empty query as nothing at all", () => {
    expect(describePredicate({ kind: "and", predicates: [] })).toBe("");
    expect(describePredicate(undefined)).toBe("");
  });

  it("counts matches in words", () => {
    expect(describeMatchCount(0, "account")).toBe("No accounts match");
    expect(describeMatchCount(1, "account")).toBe("1 account matches");
    expect(describeMatchCount(4, "account")).toBe("4 accounts match");
    expect(describeMatchCount(undefined)).toBe("");
  });
});
