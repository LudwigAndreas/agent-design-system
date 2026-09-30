import { createContext, useContext } from "react";

/**
 * Lets a target know which page context it is nested in, without every
 * component having to thread a `page` prop through.
 */
export interface AgentPageScope {
  page?: string;
  /** Set when the scope is a dialog, so state can group elements by dialog. */
  dialog?: string;
}

export const AgentPageScopeContext = createContext<AgentPageScope>({});

export function useAgentPageScope(): AgentPageScope {
  return useContext(AgentPageScopeContext);
}
