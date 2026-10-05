import { Button } from "../../design-system/Button";
import { IconAlert, IconArrowUp, IconSparkle } from "../../design-system/icons";
import { Spinner } from "../../design-system/primitives";
import { cx } from "../../design-system/types";
import { describeMatchCount, describePredicate } from "../core/query/describe";
import { useAgent } from "../hooks/useAgent";
import type { StagedOperation } from "../types/staged";

export interface AgentStagedOperationProps {
  operation: StagedOperation;
  className?: string;
}

/**
 * An operation the agent prepared and the user has not run.
 *
 * It states plainly that nothing has happened, shows the query and the scope
 * it would run against, and offers exactly one control to proceed. When the
 * inputs have moved it says so before the user commits, and running it then
 * uses current state rather than what was recorded.
 */
export function AgentStagedOperation({ operation, className }: AgentStagedOperationProps) {
  const agent = useAgent();
  const { summary, status } = operation;

  const query = describePredicate(summary.predicate);
  const scope = describeMatchCount(summary.matchCount, "record");
  const pending = status === "staged" || status === "stale";

  return (
    <div
      className={cx(
        "agent-staged",
        status === "stale" && "agent-staged--stale",
        status === "failed" && "agent-staged--failed",
        className,
      )}
      role="group"
      aria-label={operation.label}
    >
      <div className="agent-staged__head">
        {status === "stale" ? (
          <IconAlert size={13} style={{ color: "var(--color-warning)" }} />
        ) : (
          <IconSparkle size={13} style={{ color: "var(--color-agent)" }} />
        )}
        <span>{headline(status)}</span>
      </div>

      <div className="agent-staged__title">{summary.title}</div>
      {summary.description ? (
        <p className="agent-staged__description">{summary.description}</p>
      ) : null}

      {query || scope || summary.inputs?.length ? (
        <dl className="agent-staged__inputs">
          {query ? (
            <>
              <dt>Matching</dt>
              <dd>{query}</dd>
            </>
          ) : null}
          {scope ? (
            <>
              <dt>Scope</dt>
              <dd>{scope}</dd>
            </>
          ) : null}
          {summary.inputs?.map((input) => (
            <div key={input.label} style={{ display: "contents" }}>
              <dt>{input.label}</dt>
              <dd>{input.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {status === "stale" && operation.staleReason ? (
        <p className="agent-staged__stale" role="status">
          {operation.staleReason}
        </p>
      ) : null}

      {status === "failed" && operation.error ? (
        <p className="agent-staged__error" role="alert">
          {operation.error}
        </p>
      ) : null}

      {status === "completed" && operation.result ? (
        <div className="agent-staged__done">
          <span>{operation.result.message}</span>
          {operation.result.artifact ? (
            <a
              className="ds-button ds-button--secondary ds-button--sm"
              href={operation.result.artifact.url}
              download={operation.result.artifact.filename}
            >
              Download {operation.result.artifact.filename}
            </a>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <div className="agent-staged__actions">
          <Button
            size="sm"
            variant="tertiary"
            onClick={() => agent.discardStaged(operation.id)}
          >
            Discard
          </Button>
          <Button
            size="sm"
            variant="primary"
            startIcon={<IconArrowUp size={12} />}
            onClick={() => void agent.triggerStaged(operation.id)}
          >
            {status === "stale" ? "Run with current query" : summary.title}
          </Button>
        </div>
      ) : null}

      {status === "running" ? (
        <div className="agent-staged__actions">
          <span className="agent-staged__running">
            <Spinner label="Running" />
            Running…
          </span>
        </div>
      ) : null}

      {status === "discarded" ? (
        <p className="agent-staged__resolved">Discarded — nothing was done</p>
      ) : null}
    </div>
  );
}

function headline(status: StagedOperation["status"]): string {
  switch (status) {
    case "staged":
      return "Ready to run — nothing has happened yet";
    case "stale":
      return "Ready, but the query has changed";
    case "running":
      return "Running";
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return "Discarded";
  }
}
