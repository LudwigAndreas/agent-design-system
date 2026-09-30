import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useOptionalAgent } from "../hooks/useAgent";
import { AgentPageScopeContext } from "../hooks/useAgentPageContext";
import type { AgentDeclaredAction } from "../types/state";

export interface AgentContextAction extends AgentDeclaredAction {
  /** The application function this action runs. Business logic lives here. */
  run: (params?: Record<string, unknown>) => void | Promise<void>;
}

export interface AgentContextProps {
  /** Semantic page id, e.g. `settings.notifications`. */
  page: string;
  title?: string;
  description?: string;
  /**
   * Prose the agent should know about this screen: what it is for, what the
   * constraints are, what the numbers mean. Far better than hoping a model
   * infers all of it from rendered markup.
   */
  context?: string;
  /** Named capabilities beyond raw element manipulation. */
  actions?: AgentContextAction[];
  /** Contextual prompts offered by `AgentSuggestions`. */
  suggestions?: string[];
  children: ReactNode;
}

/**
 * Declares page-level context and capabilities for the agent, and scopes every
 * nested target to this page. Renders nothing of its own.
 */
export function AgentContext({
  page,
  title,
  description,
  context,
  actions,
  suggestions,
  children,
}: AgentContextProps) {
  const agent = useOptionalAgent();

  // Handlers are read late so a declared action always runs current closures.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const declared = useMemo<AgentDeclaredAction[]>(
    () =>
      (actions ?? []).map(({ run: _run, ...rest }) => rest),
    // Identity of `run` must not cause re-registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify((actions ?? []).map(({ run: _run, ...rest }) => rest))],
  );

  const suggestionsKey = JSON.stringify(suggestions ?? []);

  useEffect(() => {
    if (!agent) return;
    return agent.registry.registerPage({
      id: page,
      title,
      description,
      context,
      actions: declared,
      suggestions: JSON.parse(suggestionsKey) as string[],
    });
  }, [agent, page, title, description, context, declared, suggestionsKey]);

  // Each declared action is also a first-class `invoke` target, so the agent
  // reaches it through the same registry path as any other action.
  useEffect(() => {
    if (!agent) return;
    const unregisters = declared.map((action) =>
      agent.registry.register({
        id: action.id,
        label: action.label,
        description: action.description,
        role: "action",
        requiresConfirmation: action.requiresConfirmation ?? action.destructive,
        page,
        handlers: {
          invoke: async (params) => {
            const match = actionsRef.current?.find((candidate) => candidate.id === action.id);
            if (!match) {
              throw new Error(`Declared action "${action.id}" is no longer available.`);
            }
            await match.run(params);
          },
        },
      }),
    );
    return () => unregisters.forEach((unregister) => unregister());
  }, [agent, declared, page]);

  const scope = useMemo(() => ({ page }), [page]);

  return <AgentPageScopeContext.Provider value={scope}>{children}</AgentPageScopeContext.Provider>;
}
