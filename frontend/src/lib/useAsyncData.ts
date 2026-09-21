"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Distinguishes "still loading" from "failed" from "loaded" — the three
 * states most one-shot fetches in this app previously collapsed into a
 * single empty value, so a failed request looked identical to one still
 * in flight (see e.g. the Sources panel's old permanent "still loading" text).
 */
export type AsyncDataState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "ready"; data: T; error: null };

/**
 * `fetcher` should be a stable reference (wrap it in `useCallback` in the
 * caller) — this hook reloads whenever `fetcher` changes, rather than
 * taking its own deps array, so it can't get out of sync with what the
 * fetcher actually closes over.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<AsyncDataState<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  const reload = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    fetcher()
      .then((data) => setState({ status: "ready", data, error: null }))
      .catch((error: unknown) => {
        setState({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : "Something went wrong.",
        });
      });
  }, [fetcher]);

  useEffect(() => {
    // Intentional: this effect's whole purpose is triggering the fetch
    // (an external system) whenever `fetcher` changes, not synchronizing
    // React state that could instead be computed during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { ...state, reload };
}
