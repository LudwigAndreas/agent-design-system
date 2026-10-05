import {
  LIST_OPERATORS,
  UNARY_OPERATORS,
  isContextRef,
  isLookupRef,
  type AgentQueryLocale,
  type ComparisonPredicate,
  type QueryField,
  type QueryLiteral,
  type QueryPredicate,
  type QueryProblem,
  type QuerySchema,
  type ResolvedPredicate,
} from "../../types/query";
import type { ContextResolution, LookupResolution } from "../../types/registry";
import { findField } from "./validate";

/**
 * Resolution: turning a predicate the agent can express into one the
 * application can execute.
 *
 * Three things happen here, all of them things the agent must not do itself:
 * context references become values it never sees, human identifiers become
 * entity references, and ambiguous literals become one unambiguous reading.
 *
 * Resolution runs after shape validation and before the write. If any part of
 * it fails the whole query is abandoned — a half-resolved predicate is a
 * different query from the one that was asked for.
 */

export interface ResolveDeps {
  schema: QuerySchema;
  locale?: AgentQueryLocale;
  /** Renders a reference id back to a label, for display. */
  describeValue?: (entity: string, value: QueryLiteral) => string | undefined;
  resolveContext?: (id: string) => Promise<ContextResolution> | ContextResolution;
  lookupEntity?: (
    entity: string,
    by: string,
    value: string,
  ) => Promise<LookupResolution> | LookupResolution;
}

export type ResolveOutcome =
  | { ok: true; predicate: ResolvedPredicate }
  | { ok: false; problems: QueryProblem[] };

export async function resolvePredicate(
  predicate: QueryPredicate,
  deps: ResolveDeps,
): Promise<ResolveOutcome> {
  const problems: QueryProblem[] = [];
  const resolved = await walk(predicate, deps, problems);
  // Collect every failure before giving up, so one round trip tells the agent
  // everything that is wrong.
  return problems.length > 0 ? { ok: false, problems } : { ok: true, predicate: resolved };
}

async function walk(
  predicate: QueryPredicate,
  deps: ResolveDeps,
  problems: QueryProblem[],
): Promise<ResolvedPredicate> {
  switch (predicate.kind) {
    case "compare":
      return resolveComparison(predicate, deps, problems);
    case "not":
      return { kind: "not", predicate: await walk(predicate.predicate, deps, problems) };
    default: {
      const children: ResolvedPredicate[] = [];
      for (const child of predicate.predicates) {
        children.push(await walk(child, deps, problems));
      }
      return { kind: predicate.kind, predicates: children };
    }
  }
}

async function resolveComparison(
  comparison: ComparisonPredicate,
  deps: ResolveDeps,
  problems: QueryProblem[],
): Promise<ResolvedPredicate> {
  const field = findField(deps.schema, comparison.field)!;
  const base = { kind: "compare" as const, field: field.id, label: field.label, op: comparison.op };

  if (UNARY_OPERATORS.includes(comparison.op)) {
    return { ...base, display: comparison.op === "isEmpty" ? "is empty" : "is not empty" };
  }

  const value = comparison.value;

  if (isContextRef(value)) {
    if (!deps.resolveContext) {
      problems.push({
        code: "context-unresolved",
        field: field.id,
        message: `This application cannot resolve "${value.$context}".`,
      });
      return { ...base, display: value.$context };
    }
    const outcome = await deps.resolveContext(value.$context);
    if (!outcome.ok) {
      problems.push({
        code: "context-unresolved",
        field: field.id,
        message: `"${value.$context}" could not be resolved: ${outcome.reason}`,
      });
      return { ...base, display: value.$context };
    }
    // The resolved value is carried for execution only. `display` is what the
    // user and the agent see.
    return { ...base, value: outcome.value, display: outcome.display };
  }

  if (isLookupRef(value)) {
    const { entity, by, value: identifier } = value.$lookup;
    if (!deps.lookupEntity) {
      problems.push({
        code: "lookup-not-supported",
        field: field.id,
        message: `This application cannot look up ${entity} by ${by}.`,
      });
      return { ...base, display: identifier };
    }
    const outcome = await deps.lookupEntity(entity, by, identifier);
    if (!outcome.ok) {
      problems.push(lookupProblem(field, entity, by, identifier, outcome));
      return { ...base, display: identifier };
    }
    return { ...base, value: outcome.value, display: outcome.display };
  }

  if (LIST_OPERATORS.includes(comparison.op) && Array.isArray(value)) {
    const entries = value as QueryLiteral[];
    return {
      ...base,
      value: entries as QueryLiteral,
      display: entries.map((entry) => displayLiteral(entry, field, deps)).join(", "),
    };
  }

  const literal = value as QueryLiteral;

  if (field.type === "date") {
    const date = interpretDate(String(literal), deps.locale);
    if (!date) {
      problems.push({
        code: "value-type-mismatch",
        field: field.id,
        message:
          `"${String(literal)}" is not a date this application can read. ` +
          `Dates are read as ${deps.locale?.dateOrder ?? "YMD"}, or as ISO (YYYY-MM-DD).`,
      });
      return { ...base, display: String(literal) };
    }
    // The unambiguous reading travels with the predicate, so an interpreted
    // date is visible wherever the query is shown.
    return { ...base, value: date.iso, display: date.display };
  }

  return { ...base, value: literal, display: displayLiteral(literal, field, deps) };
}

function lookupProblem(
  field: QueryField,
  entity: string,
  by: string,
  identifier: string,
  outcome: Extract<LookupResolution, { ok: false }>,
): QueryProblem {
  switch (outcome.reason) {
    case "not-found":
      return {
        code: "lookup-not-found",
        field: field.id,
        message: `No ${entity} was found with ${by} "${identifier}".`,
      };
    case "ambiguous":
      return {
        code: "lookup-ambiguous",
        field: field.id,
        message:
          `"${identifier}" matches ${outcome.matches} ${entity} records. ` +
          `Narrow it to one before querying.`,
      };
    default:
      return {
        code: "lookup-not-supported",
        field: field.id,
        message: `${entity} cannot be looked up by ${by}.`,
      };
  }
}

function displayLiteral(value: QueryLiteral, field: QueryField, deps: ResolveDeps): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (field.type === "reference") {
    // An id on its own means nothing to the person reading it.
    return deps.describeValue?.(field.entity, value) ?? String(value);
  }
  if (field.type === "enum") {
    const match = field.values.find((entry) => entry.value === value);
    return match?.label ?? String(value);
  }
  if (field.type === "date") {
    const date = interpretDate(String(value), deps.locale);
    return date?.display ?? String(value);
  }
  return String(value);
}

/* -------------------------------------------------------------------- dates */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMERIC = /^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/;

export interface InterpretedDate {
  /** `YYYY-MM-DD`, the value the application queries with. */
  iso: string;
  /** `11 September 2025` — never a numeric form that could be misread. */
  display: string;
}

/**
 * Reads a date the way the application declares dates are written.
 *
 * `11.09.2025` is September 11th under DMY and November 9th under MDY, and a
 * model will pick one confidently either way. The application decides, and the
 * reading is always rendered back with the month named so the user can catch
 * it before anything consequential happens.
 */
export function interpretDate(
  input: string,
  locale: AgentQueryLocale | undefined,
): InterpretedDate | null {
  const trimmed = input.trim();

  const iso = ISO.exec(trimmed);
  if (iso) {
    return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), locale);
  }

  const numeric = NUMERIC.exec(trimmed);
  if (!numeric) return null;

  const [a, b, c] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
  switch (locale?.dateOrder ?? "YMD") {
    case "DMY":
      return build(c, b, a, locale);
    case "MDY":
      return build(c, a, b, locale);
    default:
      return build(a, b, c, locale);
  }
}

function build(
  year: number,
  month: number,
  day: number,
  locale: AgentQueryLocale | undefined,
): InterpretedDate | null {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects the 31st of a 30-day month rather than rolling into the next one.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    iso: `${year}-${pad(month)}-${pad(day)}`,
    display: date.toLocaleDateString(locale?.locale ?? "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}
