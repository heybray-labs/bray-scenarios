import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@heybray/ui/hooks/use-toast";
import {
  canPublishScenario,
  showPublishValidationToast,
  type ScenarioPublishReadiness,
} from "../lib/scenario-publish-validation";
import { toggleRoleplayPublishStatus } from "../lib/roleplay-publish-toggle";

type PublishVariables = {
  id: number;
  publish: boolean;
};

type UseRoleplayPublishMutationOptions = {
  /** Extra query keys to invalidate after a successful publish toggle. */
  extraInvalidations?: unknown[][];
};

/** Shared publish/unpublish used by intro admin and bulk actions. Cards call toggleRoleplayPublishStatus directly. */
export function useRoleplayPublishMutation(
  options: UseRoleplayPublishMutationOptions = {},
) {
  const queryClient = useQueryClient();

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: PublishVariables) =>
      toggleRoleplayPublishStatus(queryClient, id, publish),
    onSuccess: (_data, { publish }) => {
      for (const queryKey of options.extraInvalidations ?? []) {
        queryClient.invalidateQueries({ queryKey, refetchType: "none" });
      }
      toast({
        title: publish ? "Scenario published" : "Scenario unpublished",
      });
    },
    onError: (error) => {
      toast({
        title: "Publish update failed",
        description: error instanceof Error ? error.message : "Could not update publish status",
        variant: "destructive",
      });
    },
  });

  const attemptPublish = (
    roleplay: ScenarioPublishReadiness & { id: number; status?: string },
    publish: boolean,
  ) => {
    if (publish && !canPublishScenario(roleplay)) {
      showPublishValidationToast(toast, roleplay);
      return;
    }
    publishMutation.mutate({ id: roleplay.id, publish });
  };

  return { publishMutation, attemptPublish };
}
