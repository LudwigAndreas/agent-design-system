import type { AgentAction, ResolvedAgentAction } from "../types/actions";
import type { AgentActionPreviewModel, AgentPreviewChange } from "../types/events";
import type { AgentActionPolicy } from "../types/policy";
import type { AgentElementState } from "../types/state";
import type { ResolvedPredicate } from "../types/query";
import { describeMatchCount, describePredicate } from "./query/describe";

function display(value: unknown, element?: AgentElementState): string {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === null || value === undefined || value === "") return "Empty";
  if (typeof value === "object") return JSON.stringify(value);
  const option = element?.options?.find((o) => o.value === String(value));
  return option?.label ?? String(value);
}

/**
 * Context the preview needs to describe a query: the one being applied, and
 * the one an operation will run against.
 */
export interface PreviewQueryContext {
  /** The resolved query this action is applying, for a `filter`. */
  predicate?: ResolvedPredicate;
  /** The target whose current query an invoked operation runs against. */
  queryTarget?: string;
  resolvedQuery?: (target: string) => ResolvedPredicate | undefined;
  matchCount?: (target: string) => number | undefined;
}

/** Builds the structured before/after the user confirms against. */
export function buildActionPreview(
  action: ResolvedAgentAction | AgentAction,
  element: AgentElementState | undefined,
  policy: AgentActionPolicy,
  query: PreviewQueryContext = {},
): AgentActionPreviewModel {
  const subject = element?.label ?? element?.id ?? ("target" in action ? action.target : undefined);
  const changes: AgentPreviewChange[] = [];
  let title = "Agent wants to make a change";

  switch (action.type) {
    case "toggle":
    case "check":
    case "uncheck":
    case "set-value":
    case "select-option": {
      const next =
        action.type === "check"
          ? true
          : action.type === "uncheck"
            ? false
            : action.type === "toggle"
              ? (action.value ?? !element?.value)
              : action.value;
      title = "Agent wants to change";
      changes.push({
        label: subject ?? "Value",
        from: display(element?.value, element),
        to: display(next, element),
      });
      break;
    }
    case "submit":
      title = "Agent wants to submit";
      changes.push({ label: subject ?? "Form", detail: "Submit the current values" });
      break;
    case "invoke": {
      title = policy.destructive ? "Agent wants to run a destructive action" : "Agent wants to run";
      changes.push({
        label: element?.label ?? subject ?? "Action",
        detail: element?.description,
      });
      // An operation that runs against a query shows that query, resolved,
      // and how much it currently matches — so the user approves a real
      // scope rather than an abstraction.
      const target = query.queryTarget;
      if (target) {
        const resolved = query.resolvedQuery?.(target);
        const text = describePredicate(resolved);
        if (text) changes.push({ label: "Matching", detail: text });
        const count = query.matchCount?.(target);
        const counted = describeMatchCount(count);
        if (counted) changes.push({ label: "Scope", detail: counted });
      }
      break;
    }
    case "filter": {
      title = "Agent wants to filter";
      const text = describePredicate(query.predicate);
      changes.push({
        label: subject ?? "Filter",
        detail: text || "Clear the current filter",
      });
      break;
    }
    default:
      changes.push({ label: subject ?? action.type });
  }

  return {
    title,
    subject,
    changes,
    description: action.reason ?? policy.reason,
    destructive: policy.destructive,
    sensitive: policy.sensitive,
    confirmLabel: policy.confirmLabel ?? (policy.destructive ? "Delete" : "Confirm"),
    cancelLabel: "Cancel",
    action,
  };
}
