import type { ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import { Checkbox } from "./Checkbox";
import {
  cx,
  resolveAgentMeta,
  AGENT_CHANGE,
  type AgentAwareProps,
  type ChangeHandler,
} from "./types";

export interface Column<Row> {
  id: string;
  header: ReactNode;
  /** Cell renderer. Keep it pure; the agent never sees rendered output. */
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  width?: string;
}

export interface DataTableProps<Row> extends AgentAwareProps {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  /** Current filter. Becomes the agent-readable value of this target. */
  filter?: Record<string, unknown>;
  onFilterChange?: ChangeHandler<Record<string, unknown>>;
  selectedIds?: string[];
  onSelectionChange?: ChangeHandler<string[]>;
  /** Rejects filters the application does not understand. */
  validateFilter?: (filter: Record<string, unknown>) => string | void;
  emptyMessage?: ReactNode;
  caption?: string;
  toolbar?: ReactNode;
  className?: string;
}

/**
 * The table publishes its filter as its agent value and its row summary as
 * state, so "show me accounts that haven't logged in for 30 days" becomes a
 * `filter` action rather than a description the model has to mime.
 */
export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  filter,
  onFilterChange,
  selectedIds,
  onSelectionChange,
  validateFilter,
  emptyMessage = "Nothing to show.",
  caption,
  toolbar,
  className,
  agentId,
  agent,
}: DataTableProps<Row>) {
  const meta = resolveAgentMeta({ agentId, agent }, { role: "table", label: caption });
  const selectable = Boolean(onSelectionChange);
  const selected = selectedIds ?? [];

  const { ref, targetProps } = useAgentTarget<Record<string, unknown>, HTMLDivElement>({
    ...meta,
    handlers: {
      read: () => filter ?? {},
      write: onFilterChange ? (next) => onFilterChange(next, AGENT_CHANGE) : undefined,
      validate: (next) => validateFilter?.(next as Record<string, unknown>),
    },
    getState: () => ({
      state: `${rows.length} row${rows.length === 1 ? "" : "s"}`,
      // Row identity is what the agent needs to act on a selection; the cell
      // markup is not, and is deliberately not published.
      data: {
        rowCount: rows.length,
        rowIds: rows.slice(0, 200).map(rowKey),
        selectedIds: selected,
        columns: columns.map((column) => column.id),
      },
    }),
  });

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const someSelected = selected.length > 0 && !allSelected;

  return (
    <div {...targetProps} ref={ref} className={cx(className)}>
      {toolbar}
      <div className="ds-table-wrap">
        <table className="ds-table">
          {caption ? <caption className="visually-hidden">{caption}</caption> : null}
          <thead>
            <tr>
              {selectable ? (
                <th className="ds-table__check">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    agentId={meta.id ? `${meta.id}.select-all` : undefined}
                    agent={{ label: "Select all rows" }}
                    onCheckedChange={(next, changeMeta) =>
                      onSelectionChange?.(next ? rows.map(rowKey) : [], changeMeta)
                    }
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  style={column.width ? { width: column.width } : undefined}
                  className={column.numeric ? "ds-table__numeric" : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>{emptyMessage}</td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = rowKey(row);
                const isSelected = selected.includes(key);
                return (
                  <tr key={key} data-selected={isSelected || undefined}>
                    {selectable ? (
                      <td className="ds-table__check">
                        <Checkbox
                          checked={isSelected}
                          agent={{ label: `Select row ${key}` }}
                          onCheckedChange={(next, changeMeta) =>
                            onSelectionChange?.(
                              next
                                ? [...selected, key]
                                : selected.filter((id) => id !== key),
                              changeMeta,
                            )
                          }
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={column.numeric ? "ds-table__numeric" : undefined}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="ds-toolbar">{children}</div>;
}

export function ToolbarSpacer() {
  return <div className="ds-toolbar__spacer" />;
}
