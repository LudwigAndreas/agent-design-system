import { useAgentQuery } from "../agent/hooks/useAgentQuery";
import { describeConditions } from "../agent/core/query/describe";
import {
  comparisons,
  removeComparisonAt,
  EMPTY_PREDICATE,
  type QueryPredicate,
  type QuerySchema,
} from "../agent/types/query";
import { Button } from "./Button";
import { IconClose } from "./icons";
import { cx, USER_CHANGE, type ChangeHandler } from "./types";

export interface QueryChipsProps {
  /** The active query. */
  query: QueryPredicate | undefined;
  onQueryChange?: ChangeHandler<QueryPredicate>;
  /** The target this query belongs to, used to resolve values for display. */
  target?: string;
  /** Used to label conditions when resolution is unavailable. */
  schema?: QuerySchema;
  className?: string;
}

/**
 * The active query, as removable conditions.
 *
 * This is the requirement that one predicate model serves both actors, made
 * visible: a condition the agent added and one the user added render
 * identically here, and removing either re-queries the same way. There is no
 * separate agent query path to inspect.
 *
 * Values are shown resolved — a person's name, a named month — because the
 * numeric form the agent sent is exactly what the user needs to be able to
 * catch.
 */
export function QueryChips({
  query,
  onQueryChange,
  target,
  schema,
  className,
}: QueryChipsProps) {
  const resolved = useAgentQuery(target, query);
  const leaves = comparisons(query);

  if (leaves.length === 0) return null;

  // Resolved text where available; otherwise a readable fallback built from
  // the schema, so the chips never show raw JSON.
  const described = resolved
    ? describeConditions(resolved).map((entry) => entry.text)
    : leaves.map((leaf) => fallbackText(leaf, schema));

  return (
    <div className={cx("ds-chips", className)} role="list" aria-label="Active query">
      {described.map((text, index) => (
        <span className="ds-chip" role="listitem" key={`${text}-${index}`}>
          <span className="ds-chip__text">{text}</span>
          {onQueryChange ? (
            <button
              type="button"
              className="ds-chip__remove"
              aria-label={`Remove condition: ${text}`}
              onClick={() =>
                onQueryChange(
                  query ? removeComparisonAt(query, index) : EMPTY_PREDICATE,
                  USER_CHANGE,
                )
              }
            >
              <IconClose size={10} />
            </button>
          ) : null}
        </span>
      ))}

      {onQueryChange && leaves.length > 1 ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onQueryChange(EMPTY_PREDICATE, USER_CHANGE)}
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

function fallbackText(
  leaf: ReturnType<typeof comparisons>[number],
  schema: QuerySchema | undefined,
): string {
  const field = schema?.fields.find((candidate) => candidate.id === leaf.field);
  const label = field?.label ?? leaf.field;
  if (leaf.value === undefined) return `${label} ${leaf.op}`;
  if (typeof leaf.value === "object" && leaf.value !== null) {
    // An unresolved reference: say what it is rather than print its shape.
    return `${label} ${leaf.op} …`;
  }
  return `${label} ${leaf.op} ${String(leaf.value)}`;
}
