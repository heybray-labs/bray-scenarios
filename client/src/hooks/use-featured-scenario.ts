import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type FeaturedManageItem = {
  roleplayId: number;
};

export function useFeaturedScenarioManage(enabled = true) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("roleplay:manage") && enabled;

  const { data, isLoading } = useQuery<{ items: FeaturedManageItem[] }>({
    queryKey: ["/api/roleplays/featured/manage"],
    queryFn: () => apiRequest("GET", "/api/roleplays/featured/manage"),
    enabled: canManage,
  });

  const mutation = useMutation({
    mutationFn: (roleplayIds: number[]) =>
      apiRequest("PUT", "/api/roleplays/featured/manage", { roleplayIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/featured/manage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/featured"] });
    },
  });

  const featuredIds = data?.items.map((item) => item.roleplayId) ?? [];

  const isFeatured = (roleplayId: number) => featuredIds.includes(roleplayId);

  const setFeatured = async (roleplayId: number, next: boolean) => {
    const nextIds = next
      ? [...featuredIds.filter((id) => id !== roleplayId), roleplayId]
      : featuredIds.filter((id) => id !== roleplayId);
    try {
      await mutation.mutateAsync(nextIds);
      toast({
        title: next ? "Added to homepage hero" : "Removed from homepage hero",
      });
    } catch (error) {
      toast({
        title: "Featured update failed",
        description: error instanceof Error ? error.message : "Could not update featured list",
        variant: "destructive",
      });
      throw error;
    }
  };

  const toggleFeatured = async (roleplayId: number) => {
    await setFeatured(roleplayId, !isFeatured(roleplayId));
  };

  return {
    isFeatured,
    setFeatured,
    toggleFeatured,
    isLoading,
    pending: mutation.isPending,
    canManage,
  };
}
