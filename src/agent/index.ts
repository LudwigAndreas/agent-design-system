import "./styles/agent.css";

/* ---- types (the architectural source of truth) ------------------------- */
export type * from "./types";

/* ---- core (framework-agnostic) ----------------------------------------- */
export { createAgentEventBus } from "./core/eventBus";
export { createAgentRegistry, resolveAction, type CreateRegistryOptions } from "./core/registry";
export { createAgentRuntime, type AgentNavigation, type AgentRuntime } from "./core/runtime";
export { composePolicy, defaultAgentPolicy } from "./core/policy";
export { buildActionPreview } from "./core/preview";
export {
  ACTION_CAPABILITY,
  resolveCapabilities,
  supportsCapability,
} from "./core/capabilities";

/* ---- react integration -------------------------------------------------- */
export {
  AgentProvider,
  AgentReactContext,
  type AgentContextValue,
  type AgentProviderProps,
} from "./react/AgentProvider";
export {
  conversationReducer,
  describeAction,
  initialConversationState,
  type ConversationCommand,
  type ConversationState,
} from "./react/conversation";

/* ---- hooks ------------------------------------------------------------- */
export * from "./hooks";

/* ---- components -------------------------------------------------------- */
export {
  AgentAppShell,
  useAgentShell,
  useOptionalAgentShell,
  type AgentAppShellProps,
  type AgentPanelSplit,
  type AgentShellState,
} from "./components/AgentAppShell";
export {
  AgentActionPreview,
  type AgentActionPreviewProps,
} from "./components/AgentActionPreview";
export { AgentChat, type AgentChatProps } from "./components/AgentChat";
export {
  AgentContext,
  type AgentContextAction,
  type AgentContextProps,
} from "./components/AgentContext";
export { AgentDemoPanel } from "./components/AgentDemoPanel";
export { AgentMessageView } from "./components/AgentMessages";
export { AgentSpotlight, type AgentSpotlightProps } from "./components/AgentSpotlight";
export {
  AgentStatusRegion,
  type AgentStatusRegionProps,
} from "./components/AgentStatusRegion";
export { AgentSuggestions, type AgentSuggestionsProps } from "./components/AgentSuggestions";
export { Markdown } from "./components/Markdown";
