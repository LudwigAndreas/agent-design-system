import {
  resolvedComparisons,
  type QueryOperator,
  type ResolvedComparison,
  type ResolvedPredicate,
} from "../../types/query";

/**
 * Rendering a resolved predicate back into words.
 *
 * This is where an interpreted date stops being `11.09.2025` and becomes
 * `11 September 2025`, and where a looked-up reference stops being an opaque
 * id and becomes a person's name. Everything consequential the user is asked
 * to approve goes through here first.
 */

const OPERATOR_PHRASE: Record<QueryOperator, string> = {
  eq: "is",
  ne: "is not",
  lt: "is before",
  lte: "is on or before",
  gt: "is after",
  gte: "is on or after",
  contains: "contains",
  startsWith: "starts with",
  in: "is one of",
  isEmpty: "is empty",
  isNotEmpty: "is set",
};

/** Numeric fields read better with "less than" than with "is before". */
const NUMERIC_PHRASE: Partial<Record<QueryOperator, string>> = {
  lt: "is less than",
  lte: "is at most",
  gt: "is more than",
  gte: "is at least",
};

export interface DescribeOptions {
  /** Fields whose comparisons should read numerically rather than temporally. */
  numericFields?: string[];
}

/** One condition, as a sentence fragment: `Created is before 11 September 2025`. */
export function describeCondition(
  condition: ResolvedComparison,
  options: DescribeOptions = {},
): string {
  const numeric = options.numericFields?.includes(condition.field);
  const phrase =
    (numeric ? NUMERIC_PHRASE[condition.op] : undefined) ?? OPERATOR_PHRASE[condition.op];

  return condition.value === undefined
    ? `${condition.label} ${phrase}`
    : `${condition.label} ${phrase} ${condition.display}`;
}

/**
 * The whole predicate as readable text.
 *
 * Nested disjunction and negation are parenthesised rather than flattened,
 * because a query the user cannot read accurately is worse than one they
 * cannot read at all.
 */
export function describePredicate(
  predicate: ResolvedPredicate | undefined,
  options: DescribeOptions = {},
): string {
  if (!predicate) return "";

  switch (predicate.kind) {
    case "compare":
      return describeCondition(predicate, options);

    case "not": {
      const inner = describePredicate(predicate.predicate, options);
      return inner ? `not (${inner})` : "";
    }

    default: {
      const joiner = predicate.kind === "and" ? " and " : " or ";
      const parts = predicate.predicates
        .map((child) =>
          child.kind === "compare"
            ? describePredicate(child, options)
            : `(${describePredicate(child, options)})`,
        )
        .filter(Boolean);
      return parts.join(joiner);
    }
  }
}

/** Each condition on its own, for rendering as a row of removable chips. */
export function describeConditions(
  predicate: ResolvedPredicate | undefined,
  options: DescribeOptions = {},
): { condition: ResolvedComparison; text: string }[] {
  return resolvedComparisons(predicate).map((condition) => ({
    condition,
    text: describeCondition(condition, options),
  }));
}

/** `4 accounts match`, or `No accounts match`. */
export function describeMatchCount(count: number | undefined, noun = "record"): string {
  if (count === undefined) return "";
  if (count === 0) return `No ${noun}s match`;
  return `${count} ${noun}${count === 1 ? "" : "s"} match${count === 1 ? "es" : ""}`;
}
