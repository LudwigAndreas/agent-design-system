import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Button } from "../../design-system/Button";
import {
  IconArrowUp,
  IconClose,
  IconCollapse,
  IconExpand,
  IconMore,
  IconPlus,
  IconSparkle,
} from "../../design-system/icons";
import { Menu } from "../../design-system/Menu";
import { Badge } from "../../design-system/primitives";
import { Tooltip } from "../../design-system/Tooltip";
import { cx } from "../../design-system/types";
import { useAgent } from "../hooks/useAgent";
import { useAgentState } from "../hooks/useAgentRegistry";
import type { AgentAttachment } from "../types/messages";
import { AgentMessageView } from "./AgentMessages";
import { AgentSuggestions } from "./AgentSuggestions";
import { useOptionalAgentShell } from "./AgentAppShell";

export interface AgentChatProps {
  children?: ReactNode;
  className?: string;
}

/**
 * The agent panel's contents.
 *
 * Compound, so an application can reorder or replace any part:
 *
 * ```tsx
 * <AgentChat>
 *   <AgentChat.Header />
 *   <AgentChat.Messages />
 *   <AgentChat.Composer />
 * </AgentChat>
 * ```
 */
export function AgentChat({ children, className }: AgentChatProps) {
  return (
    <div className={cx("agent-chat", className)}>
      {children ?? (
        <>
          <Header />
          <Messages />
          <Composer />
        </>
      )}
    </div>
  );
}

function Header({ title = "Agent" }: { title?: string }) {
  const agent = useAgent();
  const state = useAgentState();
  // Null outside AgentAppShell; the layout controls then simply disappear.
  const shell = useOptionalAgentShell();

  return (
    <header className="agent-chat__header">
      <div className="agent-chat__identity">
        <span className="agent-chat__mark" aria-hidden="true">
          <IconSparkle size={14} />
        </span>
        <span className="agent-chat__title">{title}</span>
        <span className="agent-chat__context">
          · {state?.page?.title ?? state?.route ?? "workspace"}
        </span>
      </div>

      {agent.busy ? <Badge tone="agent">Working</Badge> : null}

      <Menu
        label="Agent options"
        align="end"
        trigger={
          <Button size="sm" variant="ghost" iconOnly aria-label="Agent options">
            <IconMore size={14} />
          </Button>
        }
        items={[
          {
            id: "clear",
            label: "Clear conversation",
            disabled: agent.conversation.messages.length === 0,
            onSelect: agent.clear,
          },
          ...(shell
            ? [
                {
                  id: "fullscreen",
                  label: shell.fullscreen ? "Exit full width" : "Expand to full width",
                  icon: shell.fullscreen ? <IconCollapse size={14} /> : <IconExpand size={14} />,
                  onSelect: shell.toggleFullscreen,
                },
              ]
            : []),
        ]}
      />

      {shell ? (
        <Tooltip content="Close agent">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            aria-label="Close agent panel"
            onClick={() => shell.setOpen(false)}
          >
            <IconClose size={14} />
          </Button>
        </Tooltip>
      ) : null}
    </header>
  );
}

function Messages({ emptyState }: { emptyState?: ReactNode }) {
  const agent = useAgent();
  const state = useAgentState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Follow the stream only while the user is already at the bottom; yanking
  // the view away from someone who scrolled up is hostile.
  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    pinnedToBottom.current = distance < 48;
  };

  useLayoutEffect(() => {
    if (!pinnedToBottom.current) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [agent.conversation.messages, agent.conversation.thinking]);

  const { messages, thinking } = agent.conversation;

  return (
    <div
      ref={scrollRef}
      className="agent-chat__messages"
      onScroll={onScroll}
      role="log"
      aria-label="Conversation"
      aria-busy={agent.busy}
    >
      {messages.length === 0 ? (
        <div className="agent-chat__intro">
          {emptyState ?? (
            <>
              <p className="agent-chat__intro-text">
                I can explain this workspace, take you to the right place, and change things
                for you. Anything consequential, I&rsquo;ll check with you first.
              </p>
              <AgentSuggestions label={`On ${state?.page?.title ?? "this page"}`} />
            </>
          )}
        </div>
      ) : (
        messages.map((message, index) => (
          <AgentMessageView
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))
      )}
      {thinking ? <span className="agent-message__thinking">{thinking}</span> : null}
    </div>
  );
}

function Composer({
  placeholder = "Ask anything…",
  allowAttachments = false,
}: {
  placeholder?: string;
  allowAttachments?: boolean;
}) {
  const agent = useAgent();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to the CSS max-height.
  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  const submit = () => {
    if (agent.busy || (!text.trim() && attachments.length === 0)) return;
    const payload = text;
    const files = attachments;
    setText("");
    setAttachments([]);
    void agent.sendMessage(payload, files.length > 0 ? files : undefined);
  };

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    setAttachments((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `att_${Date.now()}_${index}`,
        name: file.name,
        mediaType: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      })),
    ]);
    event.target.value = "";
  };

  return (
    <form
      className="agent-chat__composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 ? (
        <div className="agent-chat__attachments" style={{ marginBlockEnd: "var(--space-6)" }}>
          {attachments.map((attachment) => (
            <Badge key={attachment.id}>
              {attachment.name}
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                style={{ display: "grid", cursor: "pointer", color: "inherit" }}
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((item) => item.id !== attachment.id),
                  )
                }
              >
                <IconClose size={10} />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="agent-chat__field">
        {allowAttachments ? (
          <label
            className="ds-button ds-button--ghost ds-button--sm ds-button--icon"
            style={{ height: 24, width: 24 }}
          >
            <IconPlus size={14} />
            <span className="visually-hidden">Add attachment</span>
            <input type="file" multiple onChange={onFiles} style={{ display: "none" }} />
          </label>
        ) : null}

        <textarea
          ref={inputRef}
          className="agent-chat__input"
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label="Message the agent"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />

        {agent.busy ? (
          <button
            type="button"
            className="agent-chat__send"
            aria-label="Stop generating"
            onClick={agent.stop}
          >
            <span
              aria-hidden="true"
              style={{ width: 8, height: 8, background: "currentColor", borderRadius: 1 }}
            />
          </button>
        ) : (
          <button
            type="submit"
            className="agent-chat__send"
            aria-label="Send"
            disabled={!text.trim() && attachments.length === 0}
          >
            <IconArrowUp size={14} />
          </button>
        )}
      </div>

      <span className="agent-chat__hint">Enter to send · Shift+Enter for a new line</span>
    </form>
  );
}

AgentChat.Header = Header;
AgentChat.Messages = Messages;
AgentChat.Composer = Composer;
AgentChat.Suggestions = function Suggestions() {
  return (
    <div style={{ padding: "0 var(--space-12) var(--space-8)" }}>
      <AgentSuggestions />
    </div>
  );
};
