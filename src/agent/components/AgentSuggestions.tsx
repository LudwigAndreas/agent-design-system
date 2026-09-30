import { IconSparkle } from "../../design-system/icons";
import { cx } from "../../design-system/types";
import { useAgent } from "../hooks/useAgent";
import { useAgentState } from "../hooks/useAgentRegistry";

export interface AgentSuggestionsProps {
  /** Overrides page and conversation suggestions entirely. */
  suggestions?: string[];
  label?: string;
  max?: number;
  className?: string;
}

/**
 * Contextual prompts, rendered as quiet rows rather than pills so they read as
 * things you could ask rather than as buttons competing with the page.
 *
 * Precedence: explicit prop, then whatever the adapter last suggested, then the
 * current page's own suggestions. Clicking one sends it as an ordinary user
 * message — there is no privileged path.
 */
export function AgentSuggestions({
  suggestions,
  label = "Try asking",
  max = 4,
  className,
}: AgentSuggestionsProps) {
  const agent = useAgent();
  const state = useAgentState();

  const resolved = (
    suggestions ??
    (agent.conversation.suggestions.length > 0
      ? agent.conversation.suggestions
      : (state?.page?.suggestions ?? []))
  ).slice(0, max);

  if (resolved.length === 0) return null;

  return (
    <div className={cx("agent-suggestions", className)}>
      {label ? <span className="agent-suggestions__label">{label}</span> : null}
      {resolved.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="agent-suggestion"
          disabled={agent.busy}
          onClick={() => void agent.sendMessage(suggestion)}
        >
          <IconSparkle size={13} className="agent-suggestion__glyph" />
          {suggestion}
        </button>
      ))}
    </div>
  );
}
