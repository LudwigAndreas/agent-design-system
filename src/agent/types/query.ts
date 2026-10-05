/**
 * Query schemas and predicates.
 *
 * A view that can be queried publishes a schema describing what is queryable.
 * The agent fills that schema with a structured predicate. It never writes a
 * query language, and nothing it submits is trusted before it has been checked
 * against the schema.
 *
 * The same predicate drives the visible query interface, so a query the agent
 * built is a query the user can read, amend and clear.
 */

export type QueryFieldType = "string" | "number" | "boolean" | "date" | "enum" | "reference";

export type QueryOperator =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "contains"
  | "startsWith"
  | "in"
  | "isEmpty"
  | "isNotEmpty";

/** Operators that take no value at all. */
export const UNARY_OPERATORS: readonly QueryOperator[] = ["isEmpty", "isNotEmpty"];

/** Operators that take a list rather than a single value. */
export const LIST_OPERATORS: readonly QueryOperator[] = ["in"];

/**
 * What each field type permits unless the author narrows it. Defaults matter:
 * a schema should be cheap to declare, so most fields should need nothing
 * beyond an id, a label and a type.
 */
export const DEFAULT_OPERATORS: Record<QueryFieldType, QueryOperator[]> = {
  string: ["eq", "ne", "contains", "startsWith", "isEmpty", "isNotEmpty"],
  number: ["eq", "ne", "lt", "lte", "gt", "gte"],
  boolean: ["eq"],
  date: ["eq", "ne", "lt", "lte", "gt", "gte"],
  enum: ["eq", "ne", "in"],
  reference: ["eq", "ne", "in", "isEmpty", "isNotEmpty"],
};

export interface QueryEnumValue {
  value: string;
  label?: string;
}

interface QueryFieldBase {
  /** Stable identifier. Part of the public agent API, like a target id. */
  id: string;
  label: string;
  description?: string;
  /** Narrows `DEFAULT_OPERATORS` for this field. Never widens it. */
  operators?: QueryOperator[];
}

export interface QueryFieldString extends QueryFieldBase {
  type: "string";
}

export interface QueryFieldNumber extends QueryFieldBase {
  type: "number";
}

export interface QueryFieldBoolean extends QueryFieldBase {
  type: "boolean";
}

export interface QueryFieldDate extends QueryFieldBase {
  type: "date";
}

export interface QueryFieldEnum extends QueryFieldBase {
  type: "enum";
  values: QueryEnumValue[];
}

export interface QueryFieldReference extends QueryFieldBase {
  type: "reference";
  /** The entity this field points at, e.g. `user`. */
  entity: string;
  /** Fields a human identifier may be looked up by, e.g. `["email"]`. */
  lookupBy?: string[];
}

export type QueryField =
  | QueryFieldString
  | QueryFieldNumber
  | QueryFieldBoolean
  | QueryFieldDate
  | QueryFieldEnum
  | QueryFieldReference;

export interface QuerySchema {
  /** The entity being queried, e.g. `account`. Informational. */
  entity?: string;
  fields: QueryField[];
}

/* ------------------------------------------------------------------ values */

/**
 * A reference to something the application knows and the agent does not —
 * the signed-in user, their unit. The agent names it; the application
 * resolves it; the resolved value never goes back to the agent.
 */
export interface ContextValueRef {
  $context: string;
}

/**
 * A human identifier to be resolved against a directory, such as an email
 * address standing in for a user reference.
 */
export interface LookupValueRef {
  $lookup: {
    entity: string;
    /** The field to look up by, e.g. `email`. */
    by: string;
    value: string;
  };
}

export type QueryLiteral = string | number | boolean | null | string[] | number[];

export type QueryValue = QueryLiteral | ContextValueRef | LookupValueRef;

export const isContextRef = (value: unknown): value is ContextValueRef =>
  typeof value === "object" && value !== null && "$context" in value;

export const isLookupRef = (value: unknown): value is LookupValueRef =>
  typeof value === "object" && value !== null && "$lookup" in value;

export const isValueRef = (value: unknown): value is ContextValueRef | LookupValueRef =>
  isContextRef(value) || isLookupRef(value);

/* -------------------------------------------------------------- predicates */

export interface ComparisonPredicate {
  kind: "compare";
  field: string;
  op: QueryOperator;
  /** Absent for the unary operators. */
  value?: QueryValue;
}

export interface AndPredicate {
  kind: "and";
  predicates: QueryPredicate[];
}

export interface OrPredicate {
  kind: "or";
  predicates: QueryPredicate[];
}

export interface NotPredicate {
  kind: "not";
  predicate: QueryPredicate;
}

export type QueryPredicate =
  | ComparisonPredicate
  | AndPredicate
  | OrPredicate
  | NotPredicate;

/** The empty query. Distinct from "no query has been set". */
export const EMPTY_PREDICATE: AndPredicate = { kind: "and", predicates: [] };

export const isPredicate = (value: unknown): value is QueryPredicate => {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === "compare" || kind === "and" || kind === "or" || kind === "not";
};

/** Flattens a predicate tree into its comparison leaves, in order. */
export function comparisons(predicate: QueryPredicate | undefined): ComparisonPredicate[] {
  if (!predicate) return [];
  switch (predicate.kind) {
    case "compare":
      return [predicate];
    case "not":
      return comparisons(predicate.predicate);
    default:
      return predicate.predicates.flatMap(comparisons);
  }
}

/** True when the predicate constrains nothing. */
export function isEmptyPredicate(predicate: QueryPredicate | undefined): boolean {
  return comparisons(predicate).length === 0;
}

/**
 * Removes the nth comparison from a predicate, counting in the order
 * `comparisons()` returns them — which is the order the chips are rendered.
 * Combinators left with nothing in them collapse away.
 */
export function removeComparisonAt(
  predicate: QueryPredicate,
  index: number,
): QueryPredicate {
  let seen = 0;

  const prune = (node: QueryPredicate): QueryPredicate | null => {
    switch (node.kind) {
      case "compare":
        return seen++ === index ? null : node;
      case "not": {
        const inner = prune(node.predicate);
        return inner ? { kind: "not", predicate: inner } : null;
      }
      default: {
        const kept = node.predicates
          .map(prune)
          .filter((child): child is QueryPredicate => child !== null);
        if (kept.length === 0) return null;
        return kept.length === 1 ? kept[0]! : { kind: node.kind, predicates: kept };
      }
    }
  };

  return prune(predicate) ?? EMPTY_PREDICATE;
}

/** Adds a condition to a predicate, conjoining it with whatever is there. */
export function addComparison(
  predicate: QueryPredicate | undefined,
  comparison: ComparisonPredicate,
): QueryPredicate {
  if (!predicate || isEmptyPredicate(predicate)) return comparison;
  if (predicate.kind === "and") {
    return { kind: "and", predicates: [...predicate.predicates, comparison] };
  }
  return { kind: "and", predicates: [predicate, comparison] };
}

/* ---------------------------------------------------------------- resolved */

/**
 * A predicate after resolution: every value is a literal, and every leaf
 * carries the text to show the user. `display` is what makes an interpreted
 * date or a looked-up person visible before anything consequential happens.
 */
export interface ResolvedComparison {
  kind: "compare";
  field: string;
  label: string;
  op: QueryOperator;
  value?: QueryLiteral;
  /** Human-readable rendering of the value, e.g. `11 September 2025`. */
  display: string;
}

export interface ResolvedAnd {
  kind: "and";
  predicates: ResolvedPredicate[];
}

export interface ResolvedOr {
  kind: "or";
  predicates: ResolvedPredicate[];
}

export interface ResolvedNot {
  kind: "not";
  predicate: ResolvedPredicate;
}

export type ResolvedPredicate = ResolvedComparison | ResolvedAnd | ResolvedOr | ResolvedNot;

export function resolvedComparisons(
  predicate: ResolvedPredicate | undefined,
): ResolvedComparison[] {
  if (!predicate) return [];
  switch (predicate.kind) {
    case "compare":
      return [predicate];
    case "not":
      return resolvedComparisons(predicate.predicate);
    default:
      return predicate.predicates.flatMap(resolvedComparisons);
  }
}

/** Strips display metadata, leaving the predicate the application queries with. */
export function toPlainPredicate(predicate: ResolvedPredicate): QueryPredicate {
  switch (predicate.kind) {
    case "compare":
      return predicate.value === undefined
        ? { kind: "compare", field: predicate.field, op: predicate.op }
        : { kind: "compare", field: predicate.field, op: predicate.op, value: predicate.value };
    case "not":
      return { kind: "not", predicate: toPlainPredicate(predicate.predicate) };
    default:
      return { kind: predicate.kind, predicates: predicate.predicates.map(toPlainPredicate) };
  }
}

/* ------------------------------------------------------------------ errors */

export type QueryErrorCode =
  | "not-a-predicate"
  | "unknown-field"
  | "operator-not-permitted"
  | "value-type-mismatch"
  | "value-not-permitted"
  | "value-required"
  | "value-not-allowed"
  | "unknown-context-reference"
  | "context-unresolved"
  | "lookup-not-found"
  | "lookup-ambiguous"
  | "lookup-not-supported";

export interface QueryProblem {
  code: QueryErrorCode;
  /** Sentence naming what was wrong and what would have been valid. */
  message: string;
  /** The field the problem concerns, when it concerns one. */
  field?: string;
}

/* ------------------------------------------------- context reference decls */

/**
 * What the application is prepared to resolve. Published so the agent can
 * tell which references exist and which fields they are compatible with.
 */
export interface AgentContextReference {
  id: string;
  description: string;
  /** The type the reference resolves to, for compatibility with a field. */
  type: QueryFieldType;
  /** Set when `type` is `reference`: the entity it resolves to. */
  entity?: string;
}

/** How the application reads numeric dates, so `11.09.2025` is unambiguous. */
export type DateFieldOrder = "DMY" | "MDY" | "YMD";

export interface AgentQueryLocale {
  dateOrder: DateFieldOrder;
  /** BCP 47 tag used to render resolved dates back to the user. */
  locale?: string;
}
