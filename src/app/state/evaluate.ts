import {
  type QueryLiteral,
  type QueryOperator,
  type QueryPredicate,
} from "../../agent/types/query";

/**
 * Evaluating a predicate against the application's own data.
 *
 * This is the application's half of the contract: the agent layer validates
 * and resolves a predicate, and the application decides what it means. A real
 * backend would compile the same tree to SQL or OData instead; nothing about
 * the predicate model assumes it is evaluated in memory.
 */

export type FieldAccessor<Row> = (row: Row) => QueryLiteral | null | undefined;

export function evaluatePredicate<Row>(
  row: Row,
  predicate: QueryPredicate | undefined,
  fields: Record<string, FieldAccessor<Row>>,
): boolean {
  if (!predicate) return true;

  switch (predicate.kind) {
    case "and":
      return predicate.predicates.every((child) => evaluatePredicate(row, child, fields));
    case "or":
      // An empty disjunction matches nothing, which is the honest reading.
      return predicate.predicates.some((child) => evaluatePredicate(row, child, fields));
    case "not":
      return !evaluatePredicate(row, predicate.predicate, fields);
    case "compare": {
      const accessor = fields[predicate.field];
      // An unknown field cannot have been validated, so this is a bug rather
      // than a user error. Matching nothing is the safe reading.
      if (!accessor) return false;
      return compare(accessor(row), predicate.op, predicate.value as QueryLiteral | undefined);
    }
    default:
      return true;
  }
}

function compare(
  actual: QueryLiteral | null | undefined,
  op: QueryOperator,
  expected: QueryLiteral | undefined,
): boolean {
  switch (op) {
    case "isEmpty":
      return actual === null || actual === undefined || actual === "";
    case "isNotEmpty":
      return !(actual === null || actual === undefined || actual === "");
    default:
      break;
  }

  if (actual === null || actual === undefined) {
    // A missing value is not equal to anything, but it is "not equal to"
    // everything — which is what makes `ne` usable for finding gaps.
    return op === "ne";
  }

  if (op === "in") {
    const list = Array.isArray(expected) ? (expected as QueryLiteral[]) : [];
    return list.some((entry) => looseEquals(actual, entry));
  }

  if (expected === null || expected === undefined) return false;

  switch (op) {
    case "eq":
      return looseEquals(actual, expected);
    case "ne":
      return !looseEquals(actual, expected);
    case "contains":
      return String(actual).toLowerCase().includes(String(expected).toLowerCase());
    case "startsWith":
      return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
    case "lt":
      return order(actual, expected) < 0;
    case "lte":
      return order(actual, expected) <= 0;
    case "gt":
      return order(actual, expected) > 0;
    case "gte":
      return order(actual, expected) >= 0;
    default:
      return false;
  }
}

const looseEquals = (a: QueryLiteral, b: QueryLiteral) =>
  typeof a === typeof b ? a === b : String(a) === String(b);

/**
 * ISO dates sort correctly as strings, including when one side is a full
 * timestamp and the other is a plain date — which is exactly the case when a
 * `lastLoginAt` timestamp is compared with a date the user typed.
 */
function order(a: QueryLiteral, b: QueryLiteral): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = String(a);
  const right = String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}
