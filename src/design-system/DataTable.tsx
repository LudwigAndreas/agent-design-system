import { useMemo, type ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import {
  EMPTY_PREDICATE,
  type QueryField,
  type QueryPredicate,
  type QuerySchema,
} from "../agent/types/query";
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
  /**
   * How this column can be queried.
   *
   * `false` makes the column non-queryable, which is also the default when a
   * table declares no `query` at all. Anything else is merged over a default
   * derived from the column: its id, its header as a label, and `number` or
   * `string` inferred from `numeric` — so a queryable column usually needs
   * only `{ query: true }` or a type.
   */
  query?: boolean | Partial<Omit<QueryField, "id">>;
}

export interface DataTableProps<Row> extends AgentAwareProps {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  /**
   * The active query. Becomes the agent-readable value of this target, and
   * is what the condition chips render.
   */
  query?: QueryPredicate;
  onQueryChange?: ChangeHandler<QueryPredicate>;
  /**
   * Declares what is queryable. Omit to derive it from the columns marked
   * `query`; omit both and the table is simply not queryable.
   */
  querySchema?: QuerySchema;
  selectedIds?: string[];
  onSelectionChange?: ChangeHandler<string[]>;
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
  query,
  onQueryChange,
  querySchema,
  selectedIds,
  onSelectionChange,
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

  // A derived schema is usually enough: authoring cost is what decides
  // whether this survives across many tables.
  const schema = useMemo(
    () => querySchema ?? deriveSchema(columns),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by shape
    [querySchema, JSON.stringify(columns.map((column) => [column.id, column.numeric, column.query]))],
  );

  const { ref, targetProps } = useAgentTarget<QueryPredicate, HTMLDivElement>({
    ...meta,
    // Presence of a schema is what makes the target query-capable.
    querySchema: schema,
    handlers: {
      read: () => query ?? EMPTY_PREDICATE,
      write: onQueryChange ? (next) => onQueryChange(next, AGENT_CHANGE) : undefined,
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

/**
 * Builds a query schema from the columns that opted in.
 *
 * The default is deliberately useful — id, header as label, type inferred
 * from `numeric` — so declaring a queryable column costs one word. Returns
 * undefined when nothing opted in, which leaves the table non-queryable
 * rather than guessing.
 */
export function deriveSchema<Row>(columns: Column<Row>[]): QuerySchema | undefined {
  const fields = columns.flatMap((column): QueryField[] => {
    if (!column.query) return [];
    const base = {
      id: column.id,
      label: typeof column.header === "string" ? column.header : column.id,
      type: column.numeric ? ("number" as const) : ("string" as const),
    };
    if (column.query === true) return [base];
    return [{ ...base, ...column.query } as QueryField];
  });

  return fields.length > 0 ? { fields } : undefined;
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="ds-toolbar">{children}</div>;
}

export function ToolbarSpacer() {
  return <div className="ds-toolbar__spacer" />;
}
