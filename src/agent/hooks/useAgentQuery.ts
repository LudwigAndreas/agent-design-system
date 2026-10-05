import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { QueryPredicate, ResolvedPredicate } from "../types/query";
import { useOptionalAgent } from "./useAgent";

/**
 * Resolves a predicate for display.
 *
 * Both actors go through this: a query the agent applied and a condition the
 * user composed are resolved the same way, so a chip reads "Priya Raman" and
 * "11 September 2025" regardless of who built it. That is the practical
 * consequence of there being one predicate model rather than two.
 *
 * Returns undefined outside a provider, or while resolution is in flight, so
 * callers fall back to rendering the raw predicate.
 */
export function useAgentQuery(
  target: string | undefined,
  predicate: QueryPredicate | undefined,
): ResolvedPredicate | undefined {
  const agent = useOptionalAgent();
  const [resolved, setResolved] = useState<ResolvedPredicate>();
  const key = JSON.stringify(predicate ?? null);
  // The context value changes identity on every provider render. Depending on
  // it would cancel each in-flight resolution before it landed, so the hook
  // would never produce anything. The registry itself is stable.
  const registry = agent?.registry;

  // The target may not be registered yet on first render — a chip row above
  // the table it describes is exactly that case. Re-resolving on registry
  // changes means the chips fill in as soon as the target appears.
  const version = useSyncExternalStore(
    useMemo(
      () => (listener: () => void) => registry?.subscribe(listener) ?? (() => {}),
      [registry],
    ),
    () => registry?.getVersion() ?? 0,
    () => 0,
  );

  useEffect(() => {
    if (!registry || !target || !predicate) {
      setResolved(undefined);
      return;
    }

    let cancelled = false;
    void registry.prepareQuery(target, JSON.parse(key) as QueryPredicate).then((preparation) => {
      // A later predicate may have landed while this one was resolving.
      if (cancelled) return;
      setResolved(preparation.ok ? preparation.resolved : undefined);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value
  }, [registry, target, key, version]);

  return resolved;
}
