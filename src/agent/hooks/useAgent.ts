import { useContext } from "react";
import { AgentReactContext, type AgentContextValue } from "../react/AgentProvider";

/** The agent runtime for the surrounding `AgentProvider`. */
export function useAgent(): AgentContextValue {
  const context = useContext(AgentReactContext);
  if (!context) {
    throw new Error("useAgent() must be used inside an <AgentProvider>.");
  }
  return context;
}

/** Same, but returns `null` outside a provider — for optional agent support. */
export function useOptionalAgent(): AgentContextValue | null {
  return useContext(AgentReactContext);
}
