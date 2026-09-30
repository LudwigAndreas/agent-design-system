import { useState } from "react";
import { Button } from "../../design-system/Button";
import { EmptyState } from "../../design-system/EmptyState";
import { IconCheck, IconClose, IconMinus } from "../../design-system/icons";
import { Badge, Inline, Stack } from "../../design-system/primitives";
import { SettingsSection } from "../../design-system/Section";
import { Tabs } from "../../design-system/Tabs";
import { cx } from "../../design-system/types";
import { useAgent } from "../hooks/useAgent";
import { useAgentState } from "../hooks/useAgentRegistry";
import type { AgentActionRecord } from "../types/actions";

/**
 * Developer-facing view of the agent layer: what has been executed, and what
 * the agent can currently see. Reading the two side by side is the fastest way
 * to understand why an agent did or did not do something.
 */
export function AgentDemoPanel({ className }: { className?: string }) {
  const agent = useAgent();
  const state = useAgentState();
  const [tab, setTab] = useState("log");

  return (
    <SettingsSection
      id="inspector"
      title="Interaction inspector"
      description="Executed actions and the semantic state the agent reads. Not part of the application UI."
      className={className}
      actions={
        <Inline gap={6}>
          <Badge tone="agent">{agent.adapter.name ?? agent.adapter.id}</Badge>
          <Button size="sm" variant="secondary" onClick={() => void agent.undo()}>
            Undo last
          </Button>
        </Inline>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next)}
        ariaLabel="Inspector view"
        tabs={[
          { value: "log", label: `Actions ${agent.history.length}` },
          { value: "elements", label: `Targets ${state?.elements.length ?? 0}` },
          { value: "state", label: "Readable state" },
        ]}
      >
        {tab === "log" ? <ActionLog history={agent.history} /> : null}
        {tab === "elements" ? <TargetList /> : null}
        {tab === "state" ? (
          <pre className="agent-demo__state">{JSON.stringify(state, null, 2)}</pre>
        ) : null}
      </Tabs>
    </SettingsSection>
  );
}

function StatusGlyph({ status }: { status: AgentActionRecord["status"] }) {
  return (
    <span className="agent-demo__entry-glyph">
      {status === "succeeded" ? (
        <IconCheck size={10} />
      ) : status === "failed" ? (
        <IconClose size={10} />
      ) : status === "cancelled" ? (
        <IconMinus size={10} />
      ) : (
        "·"
      )}
    </span>
  );
}

function ActionLog({ history }: { history: AgentActionRecord[] }) {
  if (history.length === 0) {
    return (
      <EmptyState
        title="No agent actions yet"
        description="Ask the agent to change something, or run one of the examples above."
      />
    );
  }

  return (
    <div className="agent-demo__log">
      {[...history].reverse().map((entry) => (
        <div
          key={entry.action.id}
          className={cx("agent-demo__entry", `agent-demo__entry--${entry.status}`)}
        >
          <StatusGlyph status={entry.status} />
          <span>
            {formatCall(entry)}
            {entry.result?.error ? `  ← ${entry.result.error.code}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Prints the action the way the documentation writes it. */
function formatCall(entry: AgentActionRecord): string {
  const { action } = entry;
  const args: string[] = [action.target];
  if ("value" in action && action.value !== undefined) args.push(JSON.stringify(action.value));
  if ("query" in action) args.push(JSON.stringify(action.query));
  if ("filter" in action) args.push(JSON.stringify(action.filter));
  if ("params" in action && action.params) args.push(JSON.stringify(action.params));
  const source = action.source === "agent" ? "" : ` [${action.source}]`;
  return `${action.type}(${args.join(", ")})${source}`;
}

function TargetList() {
  const agent = useAgent();
  const state = useAgentState();

  if (!state) return null;

  return (
    <Stack gap={0} className="agent-demo__log">
      {state.elements.map((element) => (
        <div key={element.id} className="agent-demo__entry">
          <span>
            {element.id}
            {element.value !== undefined ? ` = ${JSON.stringify(element.value)}` : ""}
            {element.sensitive ? " (sensitive)" : ""}
            {!element.enabled ? " (disabled)" : ""}
            {`  [${element.capabilities.join(",")}]`}
          </span>
          <span className="agent-demo__entry-spacer" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void agent.reveal(element.id)}
            aria-label={`Reveal ${element.id}`}
          >
            reveal
          </Button>
        </div>
      ))}
    </Stack>
  );
}
