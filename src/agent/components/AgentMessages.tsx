import { Button } from "../../design-system/Button";
import {
  IconAlert,
  IconCheck,
  IconClose,
  IconMinus,
  IconSparkle,
  IconUndo,
} from "../../design-system/icons";
import { Badge, Spinner } from "../../design-system/primitives";
import { cx } from "../../design-system/types";
import { useAgent } from "../hooks/useAgent";
import type {
  ActionMessage,
  AgentMessage,
  AssistantMessage,
  ConfirmationMessage,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from "../types/messages";
import { AgentActionPreview } from "./AgentActionPreview";
import { AgentStagedOperation } from "./AgentStagedOperation";
import { Markdown } from "./Markdown";

/**
 * One transcript entry.
 *
 * Turns are labelled — "You", "Agent" — rather than bubbled or aligned, so the
 * panel reads as a transcript inside the workspace. Activity the agent
 * performed is rendered as quiet rows, deliberately lighter than anything that
 * asks the user for a decision.
 */
export function AgentMessageView({
  message,
  isLast = true,
}: {
  message: AgentMessage;
  /** Only the final entry offers turn-level affordances such as regenerate. */
  isLast?: boolean;
}) {
  switch (message.role) {
    case "user":
      return <UserMessageView message={message} />;
    case "assistant":
      return <AssistantMessageView message={message} isLast={isLast} />;
    case "tool":
      return <ToolMessageView message={message} />;
    case "action":
      return <ActionMessageView message={message} />;
    case "confirmation":
      return <ConfirmationMessageView message={message} />;
    case "system":
      return <SystemMessageView message={message} />;
    default:
      return null;
  }
}

function Turn({
  role,
  children,
  className,
}: {
  role?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("agent-turn", className)}>
      {role ? <span className="agent-turn__role">{role}</span> : null}
      <div className="agent-turn__body">{children}</div>
    </div>
  );
}

function UserMessageView({ message }: { message: UserMessage }) {
  return (
    <Turn role="You" className="agent-turn--user">
      {message.text}
      {message.attachments?.length ? (
        <div className="agent-chat__attachments" style={{ marginBlockStart: "var(--space-6)" }}>
          {message.attachments.map((attachment) => (
            <Badge key={attachment.id}>{attachment.name}</Badge>
          ))}
        </div>
      ) : null}
    </Turn>
  );
}

function AssistantMessageView({
  message,
  isLast,
}: {
  message: AssistantMessage;
  isLast: boolean;
}) {
  const agent = useAgent();

  return (
    <div className="agent-turn">
      <span className="agent-turn__role">Agent</span>

      {message.text ? (
        <div className="agent-message__text">
          <Markdown text={message.text} />
          {message.streaming ? <span className="agent-message__caret" aria-hidden="true" /> : null}
        </div>
      ) : null}

      {message.citations?.length ? (
        <div className="agent-message__citations">
          {message.citations.map((citation) => (
            <button
              key={citation.id}
              type="button"
              className="agent-citation"
              onClick={() => {
                // A citation that points at UI should take the user there.
                if (citation.target) void agent.reveal(citation.target);
                else if (citation.href) window.open(citation.href, "_blank", "noopener");
              }}
            >
              {citation.label}
            </button>
          ))}
        </div>
      ) : null}

      {message.stopped ? <span className="agent-message__thinking">Stopped</span> : null}

      {message.error ? (
        <div className="agent-message__error" role="alert">
          <span>{message.error}</span>
          <Button size="sm" variant="secondary" onClick={() => void agent.retry()}>
            Try again
          </Button>
        </div>
      ) : null}

      {isLast && !message.streaming && !message.error && message.text ? (
        <div className="agent-message__actions">
          <Button
            size="sm"
            variant="ghost"
            disabled={agent.busy}
            onClick={() => void agent.regenerate()}
          >
            Regenerate
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ToolMessageView({ message }: { message: ToolMessage }) {
  return (
    <div className={cx("agent-row", message.status === "failed" && "agent-row--failed")}>
      <span className="agent-row__glyph">
        {message.status === "running" ? (
          <Spinner />
        ) : message.status === "succeeded" ? (
          <IconCheck size={12} />
        ) : (
          <IconClose size={12} />
        )}
      </span>
      <span className="agent-row__body">
        <span className="agent-row__label">
          {message.status === "running"
            ? `${message.label ?? message.name}…`
            : (message.summary ?? message.error ?? message.label ?? message.name)}
        </span>
        <span className="agent-row__target">{message.name}</span>
      </span>
    </div>
  );
}

function ActionMessageView({ message }: { message: ActionMessage }) {
  const agent = useAgent();
  const canUndo = Boolean(message.result?.undo) && !message.undone;
  const failed = message.status === "failed";

  // A staged operation renders from the live store, so the row reflects what
  // has happened to it since — stale, run, discarded — rather than freezing
  // at the moment it was prepared.
  if (message.stagedId) {
    const operation = agent.stagedOperations.find(
      (candidate) => candidate.id === message.stagedId,
    );
    if (operation) return <AgentStagedOperation operation={operation} />;
  }

  return (
    <div
      className={cx(
        "agent-row",
        message.status === "succeeded" && "agent-row--done",
        failed && "agent-row--failed",
        message.status === "cancelled" && "agent-row--cancelled",
      )}
    >
      <span className="agent-row__glyph">
        {message.status === "executing" ? (
          <Spinner />
        ) : message.status === "succeeded" ? (
          <IconCheck size={12} />
        ) : failed ? (
          <IconAlert size={12} />
        ) : (
          <IconMinus size={12} />
        )}
      </span>

      <span className="agent-row__body">
        <span className="agent-row__label">{message.label}</span>
        <span className="agent-row__target">
          {message.action.type}({message.action.target})
        </span>
      </span>

      <span
        className={cx(
          "agent-row__trailing",
          (failed || message.undone) && "agent-row__trailing--persistent",
        )}
      >
        {message.undone ? <Badge>Undone</Badge> : null}
        {canUndo ? (
          <Button
            size="sm"
            variant="ghost"
            startIcon={<IconUndo size={12} />}
            onClick={() => void agent.undo(message.action.id)}
          >
            Undo
          </Button>
        ) : null}
        {failed ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void agent.executeAction({ ...message.action, id: undefined })}
          >
            Retry
          </Button>
        ) : null}
      </span>
    </div>
  );
}

function ConfirmationMessageView({ message }: { message: ConfirmationMessage }) {
  const agent = useAgent();

  return (
    <AgentActionPreview
      action={message.preview}
      status={message.status}
      onConfirm={() => agent.confirm(message.action.id)}
      onCancel={() => agent.cancel(message.action.id)}
    />
  );
}

function SystemMessageView({ message }: { message: SystemMessage }) {
  return (
    <div className={cx("agent-row", message.tone === "danger" && "agent-row--failed")}>
      <span className="agent-row__glyph">
        <IconSparkle size={12} />
      </span>
      <span className="agent-row__body">
        <span className="agent-row__label">{message.text}</span>
      </span>
    </div>
  );
}
