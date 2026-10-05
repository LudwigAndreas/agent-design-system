import { useState } from "react";
import { AgentContext } from "../../agent/components/AgentContext";
import {
  EMPTY_PREDICATE,
  addComparison,
  comparisons,
  isEmptyPredicate,
  removeComparisonAt,
  type ComparisonPredicate,
  type QueryPredicate,
} from "../../agent/types/query";
import { Button } from "../../design-system/Button";
import { DataTable, Toolbar, ToolbarSpacer, type Column } from "../../design-system/DataTable";
import { Dialog } from "../../design-system/Dialog";
import { EmptyState } from "../../design-system/EmptyState";
import { IconSearch, IconTable, IconTrash } from "../../design-system/icons";
import { Input } from "../../design-system/Input";
import { Menu } from "../../design-system/Menu";
import { Page } from "../../design-system/Page";
import { Badge } from "../../design-system/primitives";
import { QueryChips } from "../../design-system/QueryChips";
import { Select } from "../../design-system/Select";
import { useNotifications } from "../../design-system/Notifications";
import { ACCOUNT_QUERY_SCHEMA } from "../state/accountQuery";
import { exportAccounts } from "../state/exportAccounts";
import { daysSince, dormantPredicate, useAppStore } from "../state/store";
import type { Account, AccountStatus } from "../state/types";

const STATUS_TONE: Record<AccountStatus, "success" | "warning" | "danger"> = {
  active: "success",
  invited: "warning",
  suspended: "danger",
};

const INACTIVE_OPTIONS = [
  { value: "0", label: "Any last sign-in" },
  { value: "30", label: "No sign-in for 30 days" },
  { value: "60", label: "No sign-in for 60 days" },
  { value: "90", label: "No sign-in for 90 days" },
];

/** Reads a single-condition value out of the query, for the toolbar controls. */
function conditionValue(query: QueryPredicate, field: string): string | undefined {
  const match = comparisons(query).find((leaf) => leaf.field === field);
  return typeof match?.value === "string" ? match.value : undefined;
}

/** Conjoins two predicates, flattening when the left is already a conjunction. */
function conjoin(left: QueryPredicate, right: QueryPredicate): QueryPredicate {
  if (isEmptyPredicate(left)) return right;
  if (left.kind === "and") return { kind: "and", predicates: [...left.predicates, right] };
  return { kind: "and", predicates: [left, right] };
}

/**
 * Replaces every condition on a field, then adds the new one.
 *
 * The toolbar controls are a shorthand over the predicate, not a second
 * filter model: setting the status dropdown edits the same tree the agent
 * writes and the chips render.
 */
function setCondition(
  query: QueryPredicate,
  field: string,
  comparison: ComparisonPredicate | null,
): QueryPredicate {
  let next = query;
  for (let index = comparisons(next).length - 1; index >= 0; index -= 1) {
    if (comparisons(next)[index]?.field === field) {
      next = removeComparisonAt(next, index);
    }
  }
  return comparison ? addComparison(next, comparison) : next;
}

/**
 * The data screen. Querying, selection and deletion are all exposed as agent
 * capabilities, with deletion declared destructive and export declared as
 * staging, so the runtime asks before one and hands the other to the user.
 */
export function AccountsPage() {
  const { state, dispatch, visibleAccounts } = useAppStore();
  const toast = useNotifications();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { accountQuery: query, selectedAccountIds: selected } = state;

  const setQuery = (next: QueryPredicate, source: "user" | "agent" | "system") =>
    dispatch({ type: "set-account-query", query: next, source });

  const deleteSelected = (source: "user" | "agent") => {
    const count = selected.length;
    if (count === 0) return;
    const removed = state.accounts.filter((account) => selected.includes(account.id));
    dispatch({ type: "delete-accounts", ids: selected, source });
    toast.notify({
      tone: "success",
      title: `Deleted ${count} account${count === 1 ? "" : "s"}`,
      description: removed.map((account) => account.name).join(", "),
      source,
    });
  };

  // One export, reached from the toolbar button and from the agent's staged
  // operation alike.
  const runExport = () =>
    exportAccounts(visibleAccounts, { directory: state.directory, units: state.units });

  const exportNow = () => {
    try {
      const outcome = runExport();
      toast.notify({
        tone: "success",
        title: outcome.message,
        description: outcome.artifact?.filename,
        source: "user",
        action: outcome.artifact
          ? {
              label: "Download",
              onClick: () => {
                const link = document.createElement("a");
                link.href = outcome.artifact!.url;
                link.download = outcome.artifact!.filename;
                link.click();
              },
            }
          : undefined,
      });
    } catch (error) {
      toast.notify({
        tone: "danger",
        title: "Export failed",
        description: error instanceof Error ? error.message : String(error),
        source: "user",
      });
    }
  };

  const statusValue = conditionValue(query, "status") ?? "all";
  const inactiveValue = (() => {
    const leaf = comparisons(query).find(
      (candidate) => candidate.field === "lastLoginAt" && candidate.op === "lt",
    );
    if (!leaf || typeof leaf.value !== "string") return "0";
    const days = Math.round((Date.now() - Date.parse(leaf.value)) / 86_400_000);
    return INACTIVE_OPTIONS.some((option) => option.value === String(days)) ? String(days) : "0";
  })();

  /** The dormant shorthand writes the same disjunction the agent would. */
  const setDormant = (days: number, source: "user" | "agent" | "system") => {
    let next = query;
    for (let index = comparisons(next).length - 1; index >= 0; index -= 1) {
      if (comparisons(next)[index]?.field === "lastLoginAt") {
        next = removeComparisonAt(next, index);
      }
    }
    setQuery(days === 0 ? next : conjoin(next, dormantPredicate(days)), source);
  };
  const searchValue = conditionValue(query, "name") ?? "";

  const columns: Column<Account>[] = [
    {
      id: "name",
      header: "Account",
      query: { type: "string", label: "Name" },
      cell: (account) => (
        <>
          <div className="ds-table__primary">{account.name}</div>
          <div className="ds-table__secondary" style={{ fontSize: "var(--text-12)" }}>
            {account.owner} · {account.email}
          </div>
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (account) => (
        <Badge dot tone={STATUS_TONE[account.status]}>
          {account.status}
        </Badge>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      cell: (account) => <span className="ds-table__secondary">{account.plan}</span>,
    },
    { id: "seats", header: "Seats", numeric: true, cell: (account) => account.seats },
    {
      id: "lastLoginAt",
      header: "Last sign-in",
      numeric: true,
      cell: (account) => {
        const days = daysSince(account.lastLoginAt);
        return (
          <span className="ds-table__secondary">{days === null ? "never" : `${days}d ago`}</span>
        );
      },
    },
  ];

  return (
    <AgentContext
      page="accounts"
      title="Accounts"
      description="Customer accounts and their activity"
      context={
        `${state.accounts.length} accounts in total, ${visibleAccounts.length} matching the ` +
        "current query. Query the table through `accounts.table` using its published " +
        "schema. Use the `current-user` reference for 'mine' and `current-user-unit` for " +
        "'my unit'; compare owner or approver to an email with a lookup. Deleting " +
        "accounts is permanent. Exporting prepares a file and hands it to the user."
      }
      actions={[
        {
          id: "accounts.export",
          label: "Export matching accounts",
          description: "Prepare a spreadsheet of the accounts matching the current query.",
          stages: true,
          queryTarget: "accounts.table",
          run: runExport,
        },
        {
          id: "accounts.delete-selected",
          label: "Delete selected accounts",
          description: "Permanently delete every currently selected account.",
          destructive: true,
          requiresConfirmation: true,
          run: () => deleteSelected("agent"),
        },
        {
          id: "accounts.suspend-selected",
          label: "Suspend selected accounts",
          description: "Set every selected account's status to suspended.",
          requiresConfirmation: true,
          run: () => {
            dispatch({ type: "suspend-accounts", ids: selected, source: "agent" });
            toast.notify({
              tone: "warning",
              title: `Suspended ${selected.length} account(s)`,
              source: "agent",
            });
          },
        },
        {
          id: "accounts.clear-query",
          label: "Clear the account query",
          description: "Remove every condition and show all accounts.",
          run: () => setQuery(EMPTY_PREDICATE, "agent"),
        },
      ]}
      suggestions={[
        "Show me accounts that haven't logged in for 30 days",
        "All accounts created before 11.09.2025 that are mine, in my unit, approved by priya@northwind.example — export them",
        "Clear the query",
      ]}
    >
      <Page>
        <Page.Content width="wide">
          <Page.Header
            eyebrow="Workspace"
            title="Accounts"
            description="Every customer account, with plan, seats and last sign-in."
            actions={
              <Menu
                align="end"
                label="Account actions"
                trigger={
                  <Button size="sm" variant="secondary">
                    Actions
                  </Button>
                }
                items={[
                  {
                    id: "export",
                    label: "Export matching accounts",
                    description: `${visibleAccounts.length} rows`,
                    onSelect: exportNow,
                  },
                  {
                    id: "clear",
                    label: "Clear query",
                    disabled: isEmptyPredicate(query),
                    onSelect: () => setQuery(EMPTY_PREDICATE, "user"),
                  },
                  { id: "sep", separator: true },
                  {
                    id: "delete",
                    label: "Delete selected",
                    icon: <IconTrash size={14} />,
                    danger: true,
                    disabled: selected.length === 0,
                    onSelect: () => setDeleteDialogOpen(true),
                  },
                ]}
              />
            }
          />

          {/*
            The active query, however it was built. A condition the agent
            added and one the user added are indistinguishable here, which is
            the point.
          */}
          <QueryChips
            query={query}
            target="accounts.table"
            schema={ACCOUNT_QUERY_SCHEMA}
            onQueryChange={(next, meta) => setQuery(next, meta.source)}
          />

          <DataTable
            agentId="accounts.table"
            agent={{
              label: "Accounts table",
              description:
                "The account list. Its value is the active query; its state carries the " +
                "visible row ids and the current selection.",
            }}
            rows={visibleAccounts}
            columns={columns}
            rowKey={(account) => account.id}
            caption="Accounts"
            querySchema={ACCOUNT_QUERY_SCHEMA}
            query={query}
            onQueryChange={(next, meta) => setQuery(next, meta.source)}
            selectedIds={selected}
            onSelectionChange={(ids) => dispatch({ type: "set-selection", ids, source: "user" })}
            emptyMessage={
              <EmptyState
                align="center"
                icon={<IconTable size={18} />}
                title="No accounts match this query"
                description="Remove a condition, or clear the query to see everything."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuery(EMPTY_PREDICATE, "user")}
                  >
                    Clear query
                  </Button>
                }
              />
            }
            toolbar={
              <Toolbar>
                <div style={{ position: "relative", width: "min(240px, 100%)" }}>
                  <IconSearch
                    size={13}
                    style={{
                      position: "absolute",
                      insetInlineStart: "var(--space-8)",
                      insetBlockStart: "50%",
                      translate: "0 -50%",
                      color: "var(--color-text-muted)",
                      pointerEvents: "none",
                    }}
                  />
                  <Input
                    value={searchValue}
                    placeholder="Search by name"
                    aria-label="Search accounts by name"
                    style={{ paddingInlineStart: "26px" }}
                    onValueChange={(next, meta) =>
                      setQuery(
                        setCondition(
                          query,
                          "name",
                          next ? { kind: "compare", field: "name", op: "contains", value: next } : null,
                        ),
                        meta.source,
                      )
                    }
                  />
                </div>

                <div style={{ width: 150 }}>
                  <Select
                    value={statusValue}
                    aria-label="Filter by status"
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "active", label: "Active" },
                      { value: "invited", label: "Invited" },
                      { value: "suspended", label: "Suspended" },
                    ]}
                    onValueChange={(next, meta) =>
                      setQuery(
                        setCondition(
                          query,
                          "status",
                          next === "all"
                            ? null
                            : { kind: "compare", field: "status", op: "eq", value: next },
                        ),
                        meta.source,
                      )
                    }
                  />
                </div>

                <div style={{ width: 190 }}>
                  <Select
                    value={inactiveValue}
                    aria-label="Filter by last sign-in"
                    options={INACTIVE_OPTIONS}
                    onValueChange={(next, meta) => setDormant(Number(next), meta.source)}
                  />
                </div>

                <ToolbarSpacer />

                <span style={{ fontSize: "var(--text-13)", color: "var(--color-text-tertiary)" }}>
                  {selected.length > 0
                    ? `${selected.length} selected`
                    : `${visibleAccounts.length} of ${state.accounts.length}`}
                </span>

                {selected.length > 0 ? (
                  <Button
                    agentId="accounts.open-delete-dialog"
                    agent={{ description: "Opens the delete confirmation dialog." }}
                    size="sm"
                    variant="secondary"
                    destructive
                    startIcon={<IconTrash size={13} />}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete
                  </Button>
                ) : null}
              </Toolbar>
            }
          />
        </Page.Content>
      </Page>

      <Dialog
        agentId="dialog.delete-accounts"
        agent={{ description: "Confirmation dialog for permanently deleting selected accounts." }}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${selected.length} account${selected.length === 1 ? "" : "s"}?`}
        description="This permanently removes the accounts and their history. It cannot be undone."
        footer={
          <>
            <Button variant="tertiary" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              agentId="dialog.delete-accounts.confirm"
              variant="danger"
              onClick={() => {
                deleteSelected("user");
                setDeleteDialogOpen(false);
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <ul style={{ fontSize: "var(--text-13)", color: "var(--color-text-secondary)" }}>
          {state.accounts
            .filter((account) => selected.includes(account.id))
            .map((account) => (
              <li key={account.id}>
                {account.name} — {account.owner}
              </li>
            ))}
        </ul>
      </Dialog>
    </AgentContext>
  );
}
