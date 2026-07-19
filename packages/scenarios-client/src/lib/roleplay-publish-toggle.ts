import type { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@heybray/react/lib/queryClient";
import {
  browsePatchForPublishResponse,
  browsePatchForUnpublishResponse,
  invalidateRoleplayBrowseQueries,
  syncRoleplayInBrowseCaches,
} from "./invalidate-roleplay-queries";

/** POST publish/unpublish and patch browse caches. Shared by card menu and mutation hook. */
export async function toggleRoleplayPublishStatus(
  queryClient: QueryClient,
  roleplayId: number,
  publish: boolean,
) {
  const data = await apiRequest(
    "POST",
    `/api/roleplays/${roleplayId}/${publish ? "publish" : "unpublish"}`,
  );
  syncRoleplayInBrowseCaches(
    queryClient,
    roleplayId,
    publish
      ? browsePatchForPublishResponse(data ?? {})
      : browsePatchForUnpublishResponse(data ?? {}),
  );
  invalidateRoleplayBrowseQueries(queryClient);
  queryClient.invalidateQueries({
    queryKey: [`/api/roleplays/${roleplayId}`],
    refetchType: "none",
  });
  return data;
}
