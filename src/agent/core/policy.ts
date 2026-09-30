import type { AgentActionPolicy, AgentPolicyContext, AgentPolicyResolver } from "../types/policy";

/**
 * The built-in default. It is intentionally conservative about *asking* and
 * says nothing about authorization — the application's handlers decide what is
 * permitted; policy only decides what the user is shown first.
 */
export function defaultAgentPolicy(context: AgentPolicyContext): AgentActionPolicy {
  const { action, element } = context;

  // Low-risk navigation and inspection: never interrupt the user for these.
  switch (action.type) {
    case "navigate":
    case "focus":
    case "reveal":
    case "scroll-to":
    case "open-dialog":
    case "close-dialog":
    case "search":
    case "filter":
      return { requiresConfirmation: false };
    default:
      break;
  }

  if (element?.requiresConfirmation) {
    return {
      requiresConfirmation: true,
      reason: `${element.label ?? element.id} is marked as requiring confirmation.`,
      sensitive: element.sensitive,
    };
  }

  if (element?.sensitive) {
    return {
      requiresConfirmation: true,
      reason: `${element.label ?? element.id} holds sensitive information.`,
      sensitive: true,
    };
  }

  if (action.type === "invoke" || action.type === "submit") {
    // Named actions and submissions have side effects outside the UI.
    return {
      requiresConfirmation: true,
      reason: "This action has effects beyond the current screen.",
    };
  }

  return { requiresConfirmation: false };
}

/** Runs the application's resolver over the default, if one was provided. */
export function composePolicy(
  resolver: AgentPolicyResolver | undefined,
  context: AgentPolicyContext,
): AgentActionPolicy {
  const base = defaultAgentPolicy(context);
  if (!resolver) return base;
  const override = resolver(context);
  return override ? { ...base, ...override } : base;
}
