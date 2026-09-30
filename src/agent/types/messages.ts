import type {
  AgentActionResult,
  AgentActionStatus,
  ResolvedAgentAction,
} from "./actions";
import type { AgentActionPreviewModel } from "./events";

/** Transcript models. The chat renders these; adapters never render anything. */

export interface AgentMessageBase {
  id: string;
  turnId?: string;
  createdAt: number;
}

export interface AgentAttachment {
  id: string;
  name: string;
  mediaType?: string;
  size?: number;
  /** Object URL or remote URL. The design system does not upload anything. */
  url?: string;
}

export interface UserMessage extends AgentMessageBase {
  role: "user";
  text: string;
  attachments?: AgentAttachment[];
}

export interface AgentCitation {
  id: string;
  label: string;
  /** Semantic target or external href. */
  target?: string;
  href?: string;
}

export interface AssistantMessage extends AgentMessageBase {
  role: "assistant";
  /** Markdown. Rendered by the chat's minimal markdown renderer. */
  text: string;
  streaming?: boolean;
  citations?: AgentCitation[];
  /** Set when the turn ended badly, to offer retry/regenerate. */
  error?: string;
  stopped?: boolean;
}

export interface SystemMessage extends AgentMessageBase {
  role: "system";
  text: string;
  tone?: "info" | "warning" | "danger";
}

export interface ToolMessage extends AgentMessageBase {
  role: "tool";
  toolCallId: string;
  name: string;
  label?: string;
  status: "running" | "succeeded" | "failed";
  summary?: string;
  error?: string;
}

/** A state change the agent performed, with its live lifecycle status. */
export interface ActionMessage extends AgentMessageBase {
  role: "action";
  action: ResolvedAgentAction;
  status: AgentActionStatus;
  label: string;
  result?: AgentActionResult;
  /** True once undo has been used, so the affordance can retire. */
  undone?: boolean;
}

export interface ConfirmationMessage extends AgentMessageBase {
  role: "confirmation";
  action: ResolvedAgentAction;
  preview: AgentActionPreviewModel;
  status: "pending" | "confirmed" | "cancelled";
}

export type AgentMessage =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ToolMessage
  | ActionMessage
  | ConfirmationMessage;

export type AgentMessageRole = AgentMessage["role"];
