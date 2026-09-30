import type { AgentAdapter, AgentTurnContext } from "../../agent/types/adapter";
import type { AgentEvent } from "../../agent/types/events";
import type { AgentReadableState } from "../../agent/types/state";

/**
 * A deterministic, offline stand-in for a model provider.
 *
 * It exists to prove the boundary: the design system never imports a vendor
 * SDK, and everything below `src/agent` sees only `AgentTurnContext` in and
 * `AgentEvent` out. Swapping this for a real Claude or OpenAI backend means
 * writing a different adapter — see `httpAgentAdapter.ts` — and changing
 * nothing else.
 *
 * The matching here is intentionally simple keyword logic. A real adapter would
 * hand the readable state and action schema to a model and let it choose.
 */

const TYPING_DELAY_MS = 14;

async function* say(turnId: string, text: string): AsyncGenerator<AgentEvent> {
  // Stream by word, so the UI's streaming path is exercised for real.
  const words = text.split(/(\s+)/);
  for (const word of words) {
    await sleep(TYPING_DELAY_MS);
    yield { type: "text-delta", turnId, delta: word };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Matcher {
  id: string;
  test(input: string): boolean;
  run(context: AgentTurnContext): AsyncGenerator<AgentEvent>;
}

const has = (input: string, ...terms: string[]) => terms.every((term) => input.includes(term));
const any = (input: string, ...terms: string[]) => terms.some((term) => input.includes(term));

function findElement(state: AgentReadableState, ...idFragments: string[]) {
  return state.elements.find((element) =>
    idFragments.some((fragment) => element.id === fragment),
  );
}

const MATCHERS: Matcher[] = [
  /* ---- Example 1: navigate and explain ------------------------------- */
  {
    id: "navigate-notifications",
    test: (input) =>
      any(input, "notification") && any(input, "take me", "go to", "show me", "open", "settings"),
    async *run(context) {
      yield* say(context.turnId, "Taking you to notification settings.");
      const navigation = await context.execute({
        type: "navigate",
        target: "settings.notifications",
        reason: "The user asked to see notification settings.",
      });
      if (!navigation.success) {
        yield* say(context.turnId, ` I couldn't get there: ${navigation.message}`);
        return;
      }
      await context.execute({ type: "reveal", target: "notifications.email" });

      // Read the *post-navigation* state rather than the turn-start snapshot.
      const state = context.getState();
      const email = findElement(state, "notifications.email");
      const push = findElement(state, "notifications.push");
      const frequency = findElement(state, "notifications.frequency");

      yield* say(
        context.turnId,
        `\n\nEmail notifications are currently **${email?.value ? "on" : "off"}**, ` +
          `push is **${push?.value ? "on" : "off"}**, and the digest runs ` +
          `**${frequency?.value ?? "unknown"}**.\n\n` +
          "From here you can:\n" +
          "- turn any channel on or off\n" +
          "- change how often digests are sent\n" +
          "- reset everything back to the defaults",
      );
      yield {
        type: "suggestions-updated",
        turnId: context.turnId,
        suggestions: [
          "Turn off email notifications",
          "Change the notification frequency to weekly",
          "Turn on SMS notifications",
        ],
      };
    },
  },

  /* ---- Example 2: toggle a switch ------------------------------------ */
  {
    id: "toggle-channel",
    test: (input) =>
      any(input, "email", "push", "sms", "text message", "quiet hours") &&
      any(input, "turn off", "turn on", "disable", "enable", "switch off", "switch on", "stop"),
    async *run(context) {
      const input = context.input.text.toLowerCase();
      const channel = input.includes("push")
        ? "push"
        : any(input, "sms", "text message")
          ? "sms"
          : input.includes("quiet")
            ? "quiet-hours"
            : "email";
      const target = `notifications.${channel}`;
      const enable = any(input, "turn on", "enable", "switch on") && !any(input, "turn off");

      let state = context.getState();
      if (!findElement(state, target)) {
        // The control is on another screen: go there first.
        yield* say(context.turnId, "Opening notification settings first.\n\n");
        await context.execute({ type: "navigate", target: "settings.notifications" });
        state = context.getState();
      }

      const element = findElement(state, target);
      if (!element) {
        yield* say(context.turnId, `I couldn't find a ${channel} notification setting.`);
        return;
      }

      if (element.value === enable) {
        yield* say(
          context.turnId,
          `${element.label ?? channel} is already ${enable ? "on" : "off"}, so there's nothing to change.`,
        );
        return;
      }

      const result = await context.execute({
        type: "toggle",
        target,
        value: enable,
        reason: `The user asked to turn ${channel} notifications ${enable ? "on" : "off"}.`,
      });

      // Report what the application actually did, never what was requested.
      if (result.success) {
        yield* say(
          context.turnId,
          `Done — ${element.label ?? channel} is now ${result.value ? "on" : "off"}.`,
        );
      } else if (result.status === "cancelled") {
        yield* say(context.turnId, "No problem, I've left that as it was.");
      } else {
        yield* say(
          context.turnId,
          `I couldn't change that.\n\n${result.error?.userMessage ?? result.message}\n\n` +
            "You can try again, or change it directly on this page.",
        );
      }
    },
  },

  /* ---- Example 3: select an option ----------------------------------- */
  {
    id: "set-frequency",
    test: (input) =>
      any(input, "frequency", "how often", "digest") ||
      (any(input, "notification") && any(input, "weekly", "daily", "monthly", "realtime")),
    async *run(context) {
      const input = context.input.text.toLowerCase();
      const wanted = ["realtime", "daily", "weekly", "monthly"].find((option) =>
        input.includes(option),
      );

      let state = context.getState();
      if (!findElement(state, "notifications.frequency")) {
        await context.execute({ type: "navigate", target: "settings.notifications" });
        state = context.getState();
      }
      const element = findElement(state, "notifications.frequency");

      if (!wanted) {
        const options = element?.options?.map((option) => option.label ?? option.value) ?? [];
        yield* say(
          context.turnId,
          `The digest currently runs **${element?.value}**. You can choose: ${options.join(", ")}.`,
        );
        return;
      }

      const result = await context.execute({
        type: "select-option",
        target: "notifications.frequency",
        value: wanted,
        reason: `The user asked for ${wanted} notifications.`,
      });

      if (result.success) {
        await context.execute({ type: "reveal", target: "notifications.frequency" });
        yield* say(context.turnId, `Notification frequency is now **${result.value}**.`);
      } else {
        yield* say(context.turnId, result.error?.userMessage ?? "I couldn't change that.");
      }
    },
  },

  /* ---- Example 4: filter a table ------------------------------------- */
  {
    id: "filter-accounts",
    test: (input) =>
      any(input, "account") &&
      any(input, "logged in", "log in", "sign in", "signed in", "inactive", "dormant", "filter", "show me"),
    async *run(context) {
      const match = /(\d+)\s*day/.exec(context.input.text);
      const days = match ? Number(match[1]) : 30;

      yield* say(context.turnId, `Looking for accounts with no sign-in in ${days} days.\n\n`);

      yield {
        type: "tool-started",
        turnId: context.turnId,
        toolCallId: "tool_accounts",
        name: "account_search",
        label: "Searching your accounts",
      };

      await context.execute({ type: "navigate", target: "accounts" });
      const result = await context.execute({
        type: "filter",
        target: "accounts.table",
        filter: { status: "all", inactiveDays: days, search: "" },
        reason: `The user asked for accounts inactive for ${days} days.`,
      });

      const state = context.getState();
      const table = findElement(state, "accounts.table");
      const rowCount = (table?.data?.rowCount as number | undefined) ?? 0;

      yield {
        type: "tool-completed",
        turnId: context.turnId,
        toolCallId: "tool_accounts",
        summary: `Found ${rowCount} matching account${rowCount === 1 ? "" : "s"}`,
      };

      if (!result.success) {
        yield* say(context.turnId, result.error?.userMessage ?? "I couldn't apply that filter.");
        return;
      }

      await context.execute({ type: "reveal", target: "accounts.table" });
      yield* say(
        context.turnId,
        `The table now shows **${rowCount} account${rowCount === 1 ? "" : "s"}** with no sign-in ` +
          `in the last ${days} days. Never-signed-in accounts are included, since they are the ` +
          `strongest case.\n\nSelect rows and I can suspend or delete them for you.`,
      );
      yield {
        type: "suggestions-updated",
        turnId: context.turnId,
        suggestions: ["Delete the selected accounts", "Suspend these accounts", "Clear the filter"],
      };
    },
  },

  /* ---- Example 5: destructive action with confirmation ---------------- */
  {
    id: "delete-accounts",
    test: (input) => any(input, "delete", "remove") && any(input, "account", "record", "selected", "these"),
    async *run(context) {
      let state = context.getState();
      if (!findElement(state, "accounts.delete-selected")) {
        await context.execute({ type: "navigate", target: "accounts" });
        state = context.getState();
      }

      const table = findElement(state, "accounts.table");
      const selected = (table?.data?.selectedIds as string[] | undefined) ?? [];

      if (selected.length === 0) {
        yield* say(
          context.turnId,
          "Nothing is selected, so there's nothing for me to delete. Select the rows you " +
            "want removed — or tell me which accounts, and I'll filter to them first.",
        );
        return;
      }

      yield* say(
        context.turnId,
        `I can delete ${selected.length} selected account${selected.length === 1 ? "" : "s"}. ` +
          "This can't be undone, so please confirm.\n\n",
      );

      const result = await context.execute({
        type: "invoke",
        target: "accounts.delete-selected",
        reason: `The user asked to delete ${selected.length} selected account(s).`,
      });

      if (result.success) {
        const after = context.getState();
        const remaining =
          (findElement(after, "accounts.table")?.data?.rowCount as number | undefined) ?? 0;
        yield* say(
          context.turnId,
          `Deleted. The table now shows ${remaining} account${remaining === 1 ? "" : "s"}.`,
        );
      } else if (result.status === "cancelled") {
        yield* say(context.turnId, "Cancelled — nothing was deleted.");
      } else {
        yield* say(
          context.turnId,
          `The deletion failed.\n\n${result.error?.userMessage ?? result.message}`,
        );
      }
    },
  },

  /* ---- other useful behaviours ---------------------------------------- */
  {
    id: "two-factor",
    test: (input) => any(input, "two-factor", "two factor", "2fa", "mfa"),
    async *run(context) {
      const enable = !any(context.input.text.toLowerCase(), "off", "disable", "remove");
      await context.execute({ type: "navigate", target: "settings.security" });
      const result = await context.execute({
        type: "toggle",
        target: "security.two-factor",
        value: enable,
        reason: "The user asked to change two-factor authentication.",
      });
      yield* say(
        context.turnId,
        result.success
          ? `Two-factor authentication is now ${result.value ? "on" : "off"}.`
          : result.status === "cancelled"
            ? "Left unchanged — security settings need your confirmation."
            : (result.error?.userMessage ?? "I couldn't change that."),
      );
    },
  },
  {
    id: "theme",
    test: (input) => any(input, "dark mode", "light mode", "theme"),
    async *run(context) {
      const input = context.input.text.toLowerCase();
      const theme = input.includes("dark") ? "dark" : input.includes("light") ? "light" : "system";
      await context.execute({ type: "navigate", target: "settings.appearance" });
      const result = await context.execute({
        type: "select-option",
        target: "appearance.theme",
        value: theme,
        reason: "The user asked to change the theme.",
      });
      yield* say(
        context.turnId,
        result.success
          ? `Theme set to ${result.value}.`
          : (result.error?.userMessage ?? "I couldn't change the theme."),
      );
    },
  },
  {
    id: "reset-notifications",
    test: (input) => has(input, "reset") && any(input, "notification", "preference"),
    async *run(context) {
      await context.execute({ type: "navigate", target: "settings.notifications" });
      const result = await context.execute({
        type: "invoke",
        target: "notifications.reset",
        reason: "The user asked to reset notification preferences.",
      });
      yield* say(
        context.turnId,
        result.success
          ? "Notification preferences are back to their defaults."
          : result.status === "cancelled"
            ? "Cancelled — your preferences are unchanged."
            : (result.error?.userMessage ?? "I couldn't reset them."),
      );
    },
  },
  {
    id: "rename",
    test: (input) => any(input, "my name", "change name", "call me"),
    async *run(context) {
      const match = /(?:to|call me)\s+"?([\w '-]{2,40})"?\s*$/i.exec(context.input.text);
      if (!match) {
        yield* say(context.turnId, 'Tell me the new name, for example: change my name to "Jo Fields".');
        return;
      }
      await context.execute({ type: "navigate", target: "settings.profile" });
      const result = await context.execute({
        type: "set-value",
        target: "profile.name",
        value: match[1]!.trim(),
        reason: "The user asked to change their display name.",
      });
      yield* say(
        context.turnId,
        result.success
          ? `Your name is now ${result.value}.`
          : (result.error?.userMessage ?? "I couldn't update your name."),
      );
    },
  },
  {
    id: "explain-state",
    test: (input) => any(input, "what can", "explain", "where am i", "current", "status", "help"),
    async *run(context) {
      const state = context.getState();
      const page = state.page;
      const writable = state.elements.filter((element) =>
        element.capabilities.includes("write"),
      );

      yield* say(
        context.turnId,
        `You're on **${page?.title ?? state.route}**. ${page?.context ?? ""}\n\n` +
          `I can change ${writable.length} thing${writable.length === 1 ? "" : "s"} on this ` +
          `screen:\n${writable
            .slice(0, 8)
            .map(
              (element) =>
                `- ${element.label ?? element.id}` +
                (element.value !== undefined ? ` (currently ${JSON.stringify(element.value)})` : ""),
            )
            .join("\n")}` +
          (page?.actions?.length
            ? `\n\nAnd I can run: ${page.actions.map((action) => action.label).join(", ")}.`
            : ""),
      );
    },
  },
];

export function createLocalAgentAdapter(): AgentAdapter {
  return {
    id: "local-rules",
    name: "Local rules adapter",

    async *sendMessage(context) {
      const input = context.input.text.toLowerCase();
      const matcher = MATCHERS.find((candidate) => candidate.test(input));

      if (!matcher) {
        yield* say(
          context.turnId,
          "I can navigate this app and change things for you. Try:\n\n" +
            "- Take me to notification settings\n" +
            "- Turn off email notifications\n" +
            "- Change the notification frequency to weekly\n" +
            "- Show me accounts that haven't logged in for 30 days\n" +
            "- Delete the selected accounts\n\n" +
            "*(This demo adapter matches keywords instead of calling a model — the " +
            "architecture around it is the real part.)*",
        );
        return;
      }

      yield* matcher.run(context);
    },
  };
}
