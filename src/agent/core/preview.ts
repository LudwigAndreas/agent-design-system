import type { AgentAction, ResolvedAgentAction } from "../types/actions";
import type { AgentActionPreviewModel, AgentPreviewChange } from "../types/events";
import type { AgentActionPolicy } from "../types/policy";
import type { AgentElementState } from "../types/state";

function display(value: unknown, element?: AgentElementState): string {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === null || value === undefined || value === "") return "Empty";
  if (typeof value === "object") return JSON.stringify(value);
  const option = element?.options?.find((o) => o.value === String(value));
  return option?.label ?? String(value);
}

/** Builds the structured before/after the user confirms against. */
export function buildActionPreview(
  action: ResolvedAgentAction | AgentAction,
  element: AgentElementState | undefined,
  policy: AgentActionPolicy,
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
    case "invoke":
      title = policy.destructive ? "Agent wants to run a destructive action" : "Agent wants to run";
      changes.push({
        label: element?.label ?? subject ?? "Action",
        detail: element?.description,
      });
      break;
    case "filter":
      title = "Agent wants to filter";
      changes.push({ label: subject ?? "Filter", detail: JSON.stringify(action.filter) });
      break;
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
