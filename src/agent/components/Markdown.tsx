import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for assistant text.
 *
 * It builds React elements directly and never touches `innerHTML`, so model
 * output cannot inject markup. It covers what assistant messages actually use:
 * paragraphs, headings, fenced code, lists, blockquotes, and inline emphasis,
 * code and links. Anything else renders as plain text, which is the right
 * failure mode for streamed, half-finished content.
 */
export function Markdown({ text }: { text: string }) {
  return <>{renderBlocks(text)}</>;
}

function renderBlocks(text: string): ReactNode[] {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    // Fenced code. An unterminated fence still renders, because text streams in.
    const fence = /^```(\w+)?\s*$/.exec(line.trim());
    if (fence) {
      const language = fence[1];
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index]!.trim())) {
        body.push(lines[index]!);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={key++} data-language={language}>
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const Tag = (["h3", "h4", "h5", "h6"] as const)[level - 1]!;
      blocks.push(<Tag key={key++}>{renderInline(heading[2]!)}</Tag>);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]!)) {
        quoted.push(lines[index]!.replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={key++}>{renderInline(quoted.join(" "))}</blockquote>);
      continue;
    }

    const bullet = /^\s*[-*]\s+/;
    const ordered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || ordered.test(line)) {
      const isOrdered = ordered.test(line);
      const pattern = isOrdered ? ordered : bullet;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index]!)) {
        items.push(lines[index]!.replace(pattern, ""));
        index += 1;
      }
      const List = isOrdered ? "ol" : "ul";
      blocks.push(
        <List key={key++}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </List>,
      );
      continue;
    }

    // Everything else is a paragraph: consume until a blank line or new block.
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^```/.test(lines[index]!.trim()) &&
      !/^#{1,4}\s/.test(lines[index]!) &&
      !/^>\s?/.test(lines[index]!) &&
      !bullet.test(lines[index]!) &&
      !ordered.test(lines[index]!)
    ) {
      paragraph.push(lines[index]!);
      index += 1;
    }
    blocks.push(<p key={key++}>{renderInline(paragraph.join(" "))}</p>);
  }

  return blocks;
}

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    lastIndex = start + token.length;

    if (token.startsWith("`")) {
      nodes.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        const href = link[2]!;
        // Only http(s) and mailto survive; model output is untrusted input.
        const safe = /^(https?:|mailto:)/i.test(href);
        nodes.push(
          safe ? (
            <a key={key++} href={href} target="_blank" rel="noreferrer noopener">
              {link[1]}
            </a>
          ) : (
            <Fragment key={key++}>{link[1]}</Fragment>
          ),
        );
      } else {
        nodes.push(token);
      }
    }
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
