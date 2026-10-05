import type { StagedRunOutcome } from "../../agent/types/staged";
import type { Account, DirectoryUser, OrgUnit } from "./types";

/**
 * Exporting accounts.
 *
 * One function, two entry points: the toolbar button and the agent's staged
 * export both call this. There is no agent-only export path, so there is one
 * permission check, one audit entry, and one thing to get right.
 *
 * It produces a real file — a spreadsheet-readable CSV with a BOM, which
 * Excel opens natively — rather than pretending to.
 */

export interface ExportContext {
  directory: DirectoryUser[];
  units: OrgUnit[];
}

const COLUMNS: { header: string; value: (account: Account, context: ExportContext) => string }[] = [
  { header: "Account ID", value: (account) => account.id },
  { header: "Name", value: (account) => account.name },
  { header: "Status", value: (account) => account.status },
  { header: "Plan", value: (account) => account.plan },
  { header: "Seats", value: (account) => String(account.seats) },
  { header: "Created", value: (account) => account.createdAt },
  { header: "Last sign-in", value: (account) => account.lastLoginAt?.slice(0, 10) ?? "never" },
  { header: "Owner", value: (account, ctx) => personName(ctx, account.ownerId) },
  { header: "Approver", value: (account, ctx) => personName(ctx, account.approverId) },
  { header: "Unit", value: (account, ctx) => unitLabel(ctx, account.unitId) },
];

const personName = (context: ExportContext, id: string | null): string =>
  context.directory.find((user) => user.id === id)?.name ?? "";

const unitLabel = (context: ExportContext, id: string): string =>
  context.units.find((unit) => unit.id === id)?.name ?? id;

/** Quotes a field only when it needs it, the way a spreadsheet expects. */
function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildAccountsCsv(accounts: Account[], context: ExportContext): string {
  const header = COLUMNS.map((column) => cell(column.header)).join(",");
  const rows = accounts.map((account) =>
    COLUMNS.map((column) => cell(column.value(account, context))).join(","),
  );
  // The BOM is what makes Excel read this as UTF-8 rather than guessing.
  return `﻿${[header, ...rows].join("\r\n")}\r\n`;
}

export function exportAccounts(
  accounts: Account[],
  context: ExportContext,
): StagedRunOutcome {
  if (accounts.length === 0) {
    throw new Error("There are no accounts matching the current query to export.");
  }

  const csv = buildAccountsCsv(accounts, context);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const stamp = new Date().toISOString().slice(0, 10);

  return {
    message: `Exported ${accounts.length} account${accounts.length === 1 ? "" : "s"}`,
    artifact: {
      filename: `accounts-${stamp}.csv`,
      mediaType: "text/csv",
      url: URL.createObjectURL(blob),
      size: blob.size,
    },
  };
}
