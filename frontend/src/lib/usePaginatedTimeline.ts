"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout, parseApiError } from "./api-error";
import type {
  TimelineEntry,
  TimelineFilters,
  TimelineResponse,
} from "../app/workspace/_state/timeline-types";

function buildQuery(filters: TimelineFilters, limit: number, cursor: string | null): string {
  const params = new URLSearchParams();
  if (filters.eventType) params.set("event_type", filters.eventType);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.search) params.set("search", filters.search);
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

/**
 * `useAsyncData` doesn't support accumulation (each call replaces the
 * previous result) — this is a small, purpose-built hook for the
 * "load more" pattern instead: a local accumulator plus an explicit
 * `loadMore()`, with filter changes resetting to page 1.
 */
export function usePaginatedTimeline(apiUrl: string, filters: TimelineFilters, limit = 25) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalMatched, setTotalMatched] = useState(0);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");

  const load = useCallback(
    async (reset: boolean, afterCursor: string | null) => {
      if (!apiUrl) return;
      setStatus("loading");
      setError("");
      try {
        const query = buildQuery(filters, limit, reset ? null : afterCursor);
        const response = await fetchWithTimeout(`${apiUrl}/api/timeline?${query}`);
        if (!response.ok) {
          const apiError = await parseApiError(response, "Could not load your health timeline.");
          throw new Error(apiError.message);
        }
        const data = (await response.json()) as TimelineResponse;
        setEntries((current) => (reset ? data.entries : [...current, ...data.entries]));
        setCursor(data.next_cursor);
        setHasMore(Boolean(data.next_cursor));
        setTotalMatched(data.total_matched);
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your health timeline.");
        setStatus("error");
      }
    },
    // Intentionally not depending on `filters`/`limit` as objects — the
    // effect below depends on their primitive fields instead, so `load`'s
    // own identity changing every render never causes a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiUrl, filters.eventType, filters.dateFrom, filters.dateTo, filters.search, limit],
  );

  // Fetch-on-mount/filter-change from the backend — an external system,
  // not a value derivable from render — so the setState calls inside
  // `load` are intentional here, not a synchronization smell. Deliberately
  // depends on the primitive filter fields, not `load` itself (see its own
  // comment above) or `load` would refire every render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, filters.eventType, filters.dateFrom, filters.dateTo, filters.search, limit]);

  const loadMore = useCallback(() => {
    void load(false, cursor);
  }, [load, cursor]);

  const reload = useCallback(() => {
    void load(true, null);
  }, [load]);

  return { entries, hasMore, totalMatched, status, error, loadMore, reload };
}
