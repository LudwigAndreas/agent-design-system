import { useState } from "react";
import { AgentContext } from "../../agent/components/AgentContext";
import { Button } from "../../design-system/Button";
import { DataTable, Toolbar, ToolbarSpacer, type Column } from "../../design-system/DataTable";
import { Dialog } from "../../design-system/Dialog";
import { EmptyState } from "../../design-system/EmptyState";
import { IconSearch, IconTable, IconTrash } from "../../design-system/icons";
import { Input } from "../../design-system/Input";
import { Menu } from "../../design-system/Menu";
import { Page } from "../../design-system/Page";
import { Badge } from "../../design-system/primitives";
import { Select } from "../../design-system/Select";
import { useNotifications } from "../../design-system/Notifications";
import { daysSince, useAppStore } from "../state/store";
import type { Account, AccountFilter, AccountStatus } from "../state/types";

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

/**
 * The data screen. Filtering, selection and deletion are all exposed as agent
 * capabilities, with deletion declared as a destructive action so the runtime
 * requires a confirmed preview before it runs.
 */
export function AccountsPage() {
  const { state, dispatch, visibleAccounts } = useAppStore();
  const toast = useNotifications();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { accountFilter: filter, selectedAccountIds: selected } = state;

  const setFilter = (next: Partial<AccountFilter>, source: "user" | "agent" | "system") =>
    dispatch({ type: "set-account-filter", filter: next, source });

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

  const filtered = filter.inactiveDays > 0 || filter.status !== "all" || filter.search.trim();

  const columns: Column<Account>[] = [
    {
      id: "name",
      header: "Account",
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
      id: "lastLogin",
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
        "current filter. The filter accepts `status` (all, active, invited, suspended), " +
        "`inactiveDays` (0 disables the rule; accounts that have never signed in always " +
        "count as inactive) and `search` (matches name, owner, email or id). Deleting " +
        "accounts is permanent and cannot be undone."
      }
      actions={[
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
          id: "accounts.clear-filter",
          label: "Clear the account filter",
          description: "Remove every filter and show all accounts.",
          run: () => setFilter({ status: "all", inactiveDays: 0, search: "" }, "agent"),
        },
      ]}
      suggestions={[
        "Show me accounts that haven't logged in for 30 days",
        "Delete the selected accounts",
        "Clear the filter",
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
                    id: "clear",
                    label: "Clear filters",
                    disabled: !filtered,
                    onSelect: () =>
                      setFilter({ status: "all", inactiveDays: 0, search: "" }, "user"),
                  },
                  {
                    id: "dormant",
                    label: "Show dormant accounts",
                    description: "No sign-in for 30 days",
                    onSelect: () => setFilter({ inactiveDays: 30 }, "user"),
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

          <DataTable
            agentId="accounts.table"
            agent={{
              label: "Accounts table",
              description:
                "The account list. Its value is the active filter; its state carries the " +
                "visible row ids and the current selection.",
            }}
            rows={visibleAccounts}
            columns={columns}
            rowKey={(account) => account.id}
            caption="Accounts"
            filter={filter as unknown as Record<string, unknown>}
            onFilterChange={(next, meta) => setFilter(next as Partial<AccountFilter>, meta.source)}
            validateFilter={(next) => {
              const allowed = ["status", "inactiveDays", "search"];
              const unknown = Object.keys(next).filter((key) => !allowed.includes(key));
              if (unknown.length > 0) {
                return `Unknown filter field(s): ${unknown.join(", ")}. Allowed: ${allowed.join(", ")}.`;
              }
              if (
                next.status !== undefined &&
                !["all", "active", "invited", "suspended"].includes(String(next.status))
              ) {
                return `"${String(next.status)}" is not a valid account status.`;
              }
              return undefined;
            }}
            selectedIds={selected}
            onSelectionChange={(ids) => dispatch({ type: "set-selection", ids, source: "user" })}
            emptyMessage={
              <EmptyState
                align="center"
                icon={<IconTable size={18} />}
                title="No accounts match this filter"
                description="Try a different status, or clear the filter to see everything."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setFilter({ status: "all", inactiveDays: 0, search: "" }, "user")
                    }
                  >
                    Clear filter
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
                    agentId="accounts.search"
                    agent={{ description: "Free-text search over account name, owner and email." }}
                    value={filter.search}
                    placeholder="Search accounts"
                    aria-label="Search accounts"
                    style={{ paddingInlineStart: "26px" }}
                    onValueChange={(next, meta) => setFilter({ search: next }, meta.source)}
                  />
                </div>

                <div style={{ width: 150 }}>
                  <Select
                    agentId="accounts.status-filter"
                    agent={{ description: "Restricts the table to one account status." }}
                    value={filter.status}
                    aria-label="Filter by status"
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "active", label: "Active" },
                      { value: "invited", label: "Invited" },
                      { value: "suspended", label: "Suspended" },
                    ]}
                    onValueChange={(next, meta) =>
                      setFilter({ status: next as AccountFilter["status"] }, meta.source)
                    }
                  />
                </div>

                <div style={{ width: 190 }}>
                  <Select
                    agentId="accounts.inactive-filter"
                    agent={{
                      description:
                        "Restricts the table to accounts with no sign-in for N days. 0 disables it.",
                    }}
                    value={String(filter.inactiveDays)}
                    aria-label="Filter by last sign-in"
                    options={INACTIVE_OPTIONS}
                    onValueChange={(next, meta) =>
                      setFilter({ inactiveDays: Number(next) }, meta.source)
                    }
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
