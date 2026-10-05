import {
  DEFAULT_OPERATORS,
  LIST_OPERATORS,
  UNARY_OPERATORS,
  isContextRef,
  isLookupRef,
  isPredicate,
  isValueRef,
  type AgentContextReference,
  type ComparisonPredicate,
  type QueryField,
  type QueryOperator,
  type QueryPredicate,
  type QueryProblem,
  type QuerySchema,
} from "../../types/query";

/**
 * Shape validation: does this predicate make sense against the schema?
 *
 * Runs before anything else, and performs no I/O. A predicate that fails here
 * never reaches a directory lookup and never touches application state. Every
 * problem names what was wrong *and* what would have been valid, because the
 * agent's next move depends on being told the alternatives.
 */

export interface ValidateOptions {
  schema: QuerySchema;
  /** References the application is prepared to resolve. */
  contextReferences?: AgentContextReference[];
}

const list = (values: readonly string[]) => values.join(", ");

export function operatorsFor(field: QueryField): QueryOperator[] {
  const defaults = DEFAULT_OPERATORS[field.type];
  // An author may narrow the defaults but never widen them: a field cannot
  // advertise an operator its type has no meaning for.
  return field.operators ? field.operators.filter((op) => defaults.includes(op)) : defaults;
}

export function findField(schema: QuerySchema, id: string): QueryField | undefined {
  return schema.fields.find((field) => field.id === id);
}

export function validatePredicate(
  predicate: unknown,
  options: ValidateOptions,
): QueryProblem[] {
  if (!isPredicate(predicate)) {
    return [
      {
        code: "not-a-predicate",
        message:
          "A query must be a structured predicate. Raw filter expressions and query " +
          "strings are not accepted. Use { kind: \"compare\", field, op, value } " +
          "combined with { kind: \"and\" | \"or\" | \"not\" }.",
      },
    ];
  }
  return walk(predicate, options);
}

function walk(predicate: QueryPredicate, options: ValidateOptions): QueryProblem[] {
  switch (predicate.kind) {
    case "compare":
      return validateComparison(predicate, options);
    case "not":
      return walk(predicate.predicate, options);
    case "and":
    case "or":
      return predicate.predicates.flatMap((child) => walk(child, options));
    default:
      return [];
  }
}

function validateComparison(
  comparison: ComparisonPredicate,
  options: ValidateOptions,
): QueryProblem[] {
  const { schema } = options;
  const field = findField(schema, comparison.field);

  if (!field) {
    return [
      {
        code: "unknown-field",
        field: comparison.field,
        message:
          `"${comparison.field}" is not a queryable field. ` +
          `Queryable fields are: ${list(schema.fields.map((f) => f.id))}.`,
      },
    ];
  }

  const problems: QueryProblem[] = [];
  const permitted = operatorsFor(field);

  if (!permitted.includes(comparison.op)) {
    problems.push({
      code: "operator-not-permitted",
      field: field.id,
      message:
        `"${comparison.op}" is not permitted on "${field.id}". ` +
        `Permitted operators are: ${list(permitted)}.`,
    });
    // Without a valid operator the value cannot be judged.
    return problems;
  }

  const unary = UNARY_OPERATORS.includes(comparison.op);
  const takesList = LIST_OPERATORS.includes(comparison.op);

  if (unary) {
    if (comparison.value !== undefined) {
      problems.push({
        code: "value-not-allowed",
        field: field.id,
        message: `"${comparison.op}" on "${field.id}" takes no value.`,
      });
    }
    return problems;
  }

  if (comparison.value === undefined) {
    problems.push({
      code: "value-required",
      field: field.id,
      message: `"${comparison.op}" on "${field.id}" requires a value.`,
    });
    return problems;
  }

  // A reference stands in for a value: its shape is checked here, and whether
  // it actually resolves is settled later, by the resolution pass.
  if (isValueRef(comparison.value)) {
    return problems.concat(validateReferenceShape(comparison, field, options));
  }

  if (takesList) {
    if (!Array.isArray(comparison.value)) {
      problems.push({
        code: "value-type-mismatch",
        field: field.id,
        message: `"${comparison.op}" on "${field.id}" requires a list of values.`,
      });
      return problems;
    }
    for (const entry of comparison.value) {
      problems.push(...checkLiteral(entry, field));
    }
    return problems;
  }

  if (Array.isArray(comparison.value)) {
    problems.push({
      code: "value-type-mismatch",
      field: field.id,
      message: `"${comparison.op}" on "${field.id}" takes a single value, not a list.`,
    });
    return problems;
  }

  problems.push(...checkLiteral(comparison.value, field));
  return problems;
}

function validateReferenceShape(
  comparison: ComparisonPredicate,
  field: QueryField,
  options: ValidateOptions,
): QueryProblem[] {
  const value = comparison.value;

  if (isContextRef(value)) {
    const declared = options.contextReferences ?? [];
    const match = declared.find((reference) => reference.id === value.$context);
    if (!match) {
      return [
        {
          code: "unknown-context-reference",
          field: field.id,
          message:
            `"${value.$context}" is not an available context reference. ` +
            (declared.length > 0
              ? `Available references are: ${list(declared.map((r) => r.id))}.`
              : "This application declares no context references."),
        },
      ];
    }
    if (match.type !== field.type) {
      return [
        {
          code: "value-type-mismatch",
          field: field.id,
          message:
            `"${value.$context}" resolves to a ${match.type}, which cannot be ` +
            `compared with "${field.id}" (${field.type}).`,
        },
      ];
    }
    if (field.type === "reference" && match.entity && match.entity !== field.entity) {
      return [
        {
          code: "value-type-mismatch",
          field: field.id,
          message:
            `"${value.$context}" resolves to a ${match.entity} reference, but ` +
            `"${field.id}" refers to ${field.entity}.`,
        },
      ];
    }
    return [];
  }

  if (isLookupRef(value)) {
    if (field.type !== "reference") {
      return [
        {
          code: "value-type-mismatch",
          field: field.id,
          message: `Lookups are only valid on reference fields; "${field.id}" is a ${field.type}.`,
        },
      ];
    }
    const { entity, by } = value.$lookup;
    if (entity !== field.entity) {
      return [
        {
          code: "value-type-mismatch",
          field: field.id,
          message: `"${field.id}" refers to ${field.entity}, not ${entity}.`,
        },
      ];
    }
    const lookupBy = field.lookupBy ?? [];
    if (lookupBy.length > 0 && !lookupBy.includes(by)) {
      return [
        {
          code: "lookup-not-supported",
          field: field.id,
          message:
            `"${field.id}" cannot be looked up by "${by}". ` +
            `Supported lookups are: ${list(lookupBy)}.`,
        },
      ];
    }
    return [];
  }

  return [];
}

function checkLiteral(value: unknown, field: QueryField): QueryProblem[] {
  switch (field.type) {
    case "string":
      return typeof value === "string"
        ? []
        : [typeMismatch(field, "a string", value)];

    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? []
        : [typeMismatch(field, "a number", value)];

    case "boolean":
      return typeof value === "boolean" ? [] : [typeMismatch(field, "a boolean", value)];

    case "date":
      // A date arrives as a string. Whether it *parses* is the resolution
      // pass's problem, because reading it needs the application's locale.
      return typeof value === "string"
        ? []
        : [typeMismatch(field, "a date, written as a string", value)];

    case "enum": {
      if (typeof value !== "string") return [typeMismatch(field, "a string", value)];
      const permitted = field.values.map((entry) => entry.value);
      return permitted.includes(value)
        ? []
        : [
            {
              code: "value-not-permitted",
              field: field.id,
              message:
                `"${value}" is not a permitted value for "${field.id}". ` +
                `Permitted values are: ${list(permitted)}.`,
            },
          ];
    }

    case "reference":
      return typeof value === "string"
        ? []
        : [
            typeMismatch(
              field,
              `a ${field.entity} id, or a lookup such as ` +
                `{ $lookup: { entity: "${field.entity}", by: "email", value: "…" } }`,
              value,
            ),
          ];

    default:
      return [];
  }
}

function typeMismatch(field: QueryField, expected: string, received: unknown): QueryProblem {
  return {
    code: "value-type-mismatch",
    field: field.id,
    message:
      `"${field.id}" expects ${expected}, but received ${describe(received)}.`,
  };
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  return `a ${typeof value}`;
}
