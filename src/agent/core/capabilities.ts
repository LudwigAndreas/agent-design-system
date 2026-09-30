import type { AgentActionType } from "../types/actions";
import type { AgentCapability } from "../types/metadata";
import type { AgentTargetRegistration } from "../types/registry";

/** Which capability each action type consumes. */
export const ACTION_CAPABILITY: Record<AgentActionType, AgentCapability> = {
  navigate: "navigate",
  "open-dialog": "open",
  "close-dialog": "close",
  "set-value": "write",
  toggle: "write",
  "select-option": "write",
  check: "write",
  uncheck: "write",
  submit: "submit",
  focus: "focus",
  reveal: "focus",
  "scroll-to": "focus",
  search: "write",
  filter: "write",
  invoke: "invoke",
};

const HANDLER_FOR_CAPABILITY: Record<AgentCapability, keyof AgentTargetRegistration["handlers"]> = {
  read: "read",
  write: "write",
  focus: "focus",
  navigate: "focus",
  open: "open",
  close: "close",
  submit: "submit",
  invoke: "invoke",
};

/**
 * Capabilities a target actually has. Derived from the handlers it supplied,
 * then narrowed by any explicit `capabilities` list, so a component cannot
 * accidentally advertise more than it implements.
 */
export function resolveCapabilities(
  registration: Pick<
    AgentTargetRegistration,
    "handlers" | "capabilities" | "readable" | "writable"
  >,
): AgentCapability[] {
  const { handlers } = registration;
  const derived = new Set<AgentCapability>();

  if (handlers.read) derived.add("read");
  if (handlers.write) derived.add("write");
  if (handlers.focus) {
    derived.add("focus");
    derived.add("navigate");
  }
  if (handlers.reveal) derived.add("focus");
  if (handlers.open) derived.add("open");
  if (handlers.close) derived.add("close");
  if (handlers.submit) derived.add("submit");
  if (handlers.invoke) derived.add("invoke");

  if (registration.readable === false) derived.delete("read");
  if (registration.writable === false) derived.delete("write");

  if (!registration.capabilities) return [...derived];
  return registration.capabilities.filter((c) => derived.has(c));
}

export function supportsCapability(
  registration: AgentTargetRegistration,
  capability: AgentCapability,
): boolean {
  if (!resolveCapabilities(registration).includes(capability)) return false;
  return Boolean(registration.handlers[HANDLER_FOR_CAPABILITY[capability]]);
}
