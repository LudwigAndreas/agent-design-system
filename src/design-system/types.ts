import type { ActionSource } from "../agent/types/actions";
import type { AgentElementMetadata } from "../agent/types/metadata";

/**
 * Who caused a change. Every design-system change callback receives this, so
 * the application can distinguish a click from an agent write without keeping
 * a parallel bookkeeping system.
 */
export interface ChangeMeta {
  source: ActionSource;
}

export type ChangeHandler<V> = (value: V, meta: ChangeMeta) => void;

export const USER_CHANGE: ChangeMeta = { source: "user" };
export const AGENT_CHANGE: ChangeMeta = { source: "agent" };

/**
 * Mixed into every agent-controllable component. `agentId` is the shorthand;
 * `agent` is the full metadata form. Neither is ever rendered.
 */
export interface AgentAwareProps {
  agentId?: string;
  agent?: Partial<AgentElementMetadata>;
}

export interface ResolvedAgentMeta extends Omit<AgentElementMetadata, "id"> {
  id?: string;
}

/**
 * Merges the two authoring styles and fills in defaults from the component's
 * own props, so `<Switch agentId="x" label="Email" />` already publishes a
 * useful label and role without extra ceremony.
 */
export function resolveAgentMeta(
  props: AgentAwareProps,
  defaults: Omit<ResolvedAgentMeta, "id"> = {},
): ResolvedAgentMeta {
  const { agentId, agent } = props;
  return {
    ...defaults,
    ...agent,
    id: agent?.id ?? agentId,
    label: agent?.label ?? defaults.label,
    description: agent?.description ?? defaults.description,
    role: agent?.role ?? defaults.role,
  };
}

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
