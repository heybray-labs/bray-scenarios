import type { QueryClient } from "@tanstack/react-query";
import type { ScenarioPublishReadiness } from "./scenario-publish-validation";

export type RoleplayBrowseCachePatch = ScenarioPublishReadiness & {
  status?: string;
  published?: boolean;
  publishedAt?: string | null;
};

function patchBrowseItem<T extends { id?: number }>(
  item: T,
  roleplayId: number,
  patch: RoleplayBrowseCachePatch,
): T {
  return item.id === roleplayId ? ({ ...item, ...patch } as T) : item;
}

/** Immediately update cached browse/search rows after publish/unpublish. */
export function syncRoleplayInBrowseCaches(
  queryClient: QueryClient,
  roleplayId: number,
  patch: RoleplayBrowseCachePatch,
) {
  queryClient.setQueriesData(
    {
      predicate: (query) => {
        const root = query.queryKey[0];
        return typeof root === "string" && root.startsWith("/api/roleplays");
      },
    },
    (old: unknown) => {
      if (!old || typeof old !== "object") return old;

      if ("pages" in old && Array.isArray((old as { pages: unknown[] }).pages)) {
        const typed = old as {
          pages: Array<{ items?: Array<{ id?: number }> }>;
        };
        return {
          ...typed,
          pages: typed.pages.map((page) =>
            page.items
              ? {
                  ...page,
                  items: page.items.map((item) =>
                    patchBrowseItem(item, roleplayId, patch),
                  ),
                }
              : page,
          ),
        };
      }

      if ("items" in old && Array.isArray((old as { items: unknown[] }).items)) {
        const typed = old as { items: Array<{ id?: number }> };
        return {
          ...typed,
          items: typed.items.map((item) =>
            patchBrowseItem(item, roleplayId, patch),
          ),
        };
      }

      return old;
    },
  );
}

/** Mark browse/list caches stale without refetching — syncRoleplayInBrowseCaches already patched UI. */
export function invalidateRoleplayBrowseQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const root = query.queryKey[0];
      return typeof root === "string" && root.startsWith("/api/roleplays");
    },
    // Avoid immediate refetch: Express ETag can 304 identical list bodies and clobber the patch.
    refetchType: "none",
  });
}

export function browsePatchForPublishResponse(data: {
  status?: string;
  published?: boolean;
  publishedAt?: string | null;
  personaAiConfigured?: boolean;
  graderAiConfigured?: boolean;
  canPublish?: boolean;
}): RoleplayBrowseCachePatch {
  const published = data.status === "published" || data.published === true;
  return {
    status: published ? "published" : (data.status ?? "draft"),
    published: published ? true : (data.published ?? false),
    publishedAt: data.publishedAt ?? (published ? new Date().toISOString() : null),
    personaAiConfigured: data.personaAiConfigured ?? published,
    graderAiConfigured: data.graderAiConfigured ?? published,
    canPublish: data.canPublish ?? false,
  };
}

export function browsePatchForUnpublishResponse(data: {
  status?: string;
  published?: boolean;
  personaAiConfigured?: boolean;
  graderAiConfigured?: boolean;
  canPublish?: boolean;
}): RoleplayBrowseCachePatch {
  return {
    status: data.status ?? "draft",
    published: data.published ?? false,
    publishedAt: null,
    personaAiConfigured: data.personaAiConfigured ?? false,
    graderAiConfigured: data.graderAiConfigured ?? false,
    canPublish: data.canPublish ?? false,
  };
}
