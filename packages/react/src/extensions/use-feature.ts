import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient.ts";

/**
 * Client half of the EntitlementProvider seam. `undefined` means "no gate" —
 * always enabled, and no request is made. While the request for a real key is
 * in flight (or on error), this defaults to `true` so nothing hides/breaks
 * before the first response — the server-side `requireFeature()` gate is the
 * source of truth.
 */
export function useFeature(key?: string): boolean {
  const { data, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/features", key],
    queryFn: () => apiRequest("GET", `/api/features?keys=${encodeURIComponent(key ?? "")}`),
    enabled: !!key,
  });

  if (!key) return true;
  if (isLoading || !data) return true;
  return data[key] ?? true;
}

/**
 * Batched variant used where several optional feature keys need checking in
 * one place (e.g. filtering a list of panels) — a single request instead of
 * one `useFeature` call per item, and safe to use regardless of how many
 * items are in `keys` (no hook-per-item, so the rules of hooks hold even if
 * the item count changes between renders).
 */
export function useFeatureFlags(keys: (string | undefined)[]): Record<string, boolean> {
  const uniqueKeys = [...new Set(keys.filter((key): key is string => !!key))].sort();
  const cacheKey = uniqueKeys.join(",");

  const { data, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/features", cacheKey],
    queryFn: () => apiRequest("GET", `/api/features?keys=${encodeURIComponent(cacheKey)}`),
    enabled: uniqueKeys.length > 0,
  });

  if (!uniqueKeys.length || isLoading || !data) {
    return Object.fromEntries(uniqueKeys.map((key) => [key, true]));
  }
  return data;
}

export function FeatureGate({
  featureKey,
  children,
  fallback = null,
}: {
  featureKey?: string;
  children: ReactNode;
  fallback?: ReactNode;
}): ReactNode {
  const enabled = useFeature(featureKey);
  return enabled ? children : fallback;
}
