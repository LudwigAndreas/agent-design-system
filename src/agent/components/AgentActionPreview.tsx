import { Button } from "../../design-system/Button";
import { IconAlert, IconSparkle } from "../../design-system/icons";
import { cx } from "../../design-system/types";
import type { AgentActionPreviewModel } from "../types/events";

export interface AgentActionPreviewProps {
  action: AgentActionPreviewModel;
  onConfirm: () => void;
  onCancel: () => void;
  /** `pending` shows the buttons; the others show the outcome instead. */
  status?: "pending" | "confirmed" | "cancelled";
  className?: string;
}

/**
 * The change the agent is proposing.
 *
 * Rendered as a lightweight block — a hairline, a subject, a before/after —
 * so it reads like a callout inside the transcript rather than a modal card.
 * It is the one place in the agent panel that gets a container, because it is
 * the one place that asks the user for a decision.
 */
export function AgentActionPreview({
  action,
  onConfirm,
  onCancel,
  status = "pending",
  className,
}: AgentActionPreviewProps) {
  const resolved = status !== "pending";

  return (
    <div
      className={cx("agent-change", action.destructive && "agent-change--destructive", className)}
      role="group"
      aria-label={action.title}
    >
      <div className="agent-change__head">
        {action.destructive ? (
          <IconAlert size={13} style={{ color: "var(--color-danger)" }} />
        ) : (
          <IconSparkle size={13} style={{ color: "var(--color-agent)" }} />
        )}
        <span>{action.title}</span>
      </div>

      {action.description ? <p className="agent-change__reason">{action.description}</p> : null}

      <div className="agent-change__list">
        {action.changes.map((change, index) => (
          <div key={index}>
            <div className="agent-change__subject">{change.label}</div>
            {change.from !== undefined || change.to !== undefined ? (
              <div className="agent-change__diff">
                <span className="agent-change__from">{change.from ?? "—"}</span>
                <span aria-hidden="true">→</span>
                <span className="agent-change__to">{change.to ?? "—"}</span>
                {/* The arrow is decorative; assistive tech reads this instead. */}
                <span className="visually-hidden">
                  changing from {change.from ?? "empty"} to {change.to ?? "empty"}
                </span>
              </div>
            ) : null}
            {change.detail ? <div className="agent-change__detail">{change.detail}</div> : null}
          </div>
        ))}
      </div>

      {resolved ? (
        <p className="agent-change__resolved">
          {status === "confirmed" ? "Confirmed by you" : "Cancelled — nothing was changed"}
        </p>
      ) : (
        <div className="agent-change__actions">
          <Button size="sm" variant="tertiary" onClick={onCancel}>
            {action.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            size="sm"
            variant={action.destructive ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {action.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      )}
    </div>
  );
}
