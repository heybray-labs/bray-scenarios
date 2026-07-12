import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@heybray/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import { useAuth } from "@heybray/react/hooks/use-auth";
import { LeaderboardPanel } from "@/components/points/LeaderboardPanel";
import { RecentStarsPanel } from "@/components/points/RecentStarsPanel";
import { YourProgressPanel, ALL_CATEGORIES_SLUG } from "@/components/points/YourProgressPanel";
import { HeroFeaturedCarousel } from "@/components/roleplays/browse/HeroFeaturedCarousel";
import { HomepageCarouselRows } from "@/components/roleplays/browse/HomepageCarouselRows";
import { useScenarioAdminActions } from "@/hooks/use-scenario-admin-actions";
import EditRoleplayDialog from "@/components/roleplays/edit-roleplay-dialog";

export default function HomePage() {
  const { hasPermission } = useAuth();
  const [, navigate] = useLocation();
  const canManage = hasPermission("roleplay:manage");

  const admin = useScenarioAdminActions();

  const { data: taxonomy } = useQuery<{
    dimensions: Array<{
      slug: string;
      options: Array<{ slug: string; label: string; color: string; icon: string; usageCount?: number }>;
    }>;
  }>({
    queryKey: ["/api/roleplay-classifications"],
  });

  const categoryOptions = useMemo(() => {
    const options = taxonomy?.dimensions.find((d) => d.slug === "category")?.options ?? [];
    return options
      .filter((option) => (option.usageCount ?? 0) > 0)
      .map((option) => ({
        slug: option.slug,
        label: option.label,
        icon: option.icon,
        color: option.color,
        usageCount: option.usageCount ?? 0,
      }));
  }, [taxonomy]);

  const leaderboardCategoryOptions =
    taxonomy?.dimensions
      .find((d) => d.slug === "category")
      ?.options.map((option) => ({
        slug: option.slug,
        label: option.label,
        icon: option.icon,
        color: option.color,
      })) ?? [];

  return (
    <MainLayout>
      <div className="w-full px-4 lg:px-6 py-6 flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-3.5rem)]">
        <div className="min-w-0 lg:w-[75%] flex flex-col gap-6 overflow-auto">
          <HeroFeaturedCarousel />
          <HomepageCarouselRows
            canManage={canManage}
            cardPropsFor={admin.cardPropsFor}
            categoryOptions={categoryOptions}
          />
        </div>

        <aside className="w-full lg:w-[25%] shrink-0 flex flex-col gap-4 min-h-[20rem] lg:min-h-0">
          <YourProgressPanel
            onCategorySelect={(slug) => {
              if (slug === ALL_CATEGORIES_SLUG) {
                navigate("/search");
                return;
              }
              navigate(`/search?category=${encodeURIComponent(slug)}`);
            }}
          />
          <LeaderboardPanel
            categoryOptions={leaderboardCategoryOptions}
          />
          <RecentStarsPanel />
        </aside>
      </div>

      {canManage && (
        <>
          {admin.editId && (
            <EditRoleplayDialog
              roleplayId={admin.editId}
              open={!!admin.editId}
              onOpenChange={(open) => !open && admin.setEditId(null)}
            />
          )}
          <Dialog
            open={!!admin.deleteTarget}
            onOpenChange={(open) => {
              if (!open && !admin.bulkPending) admin.setDeleteTarget(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {admin.deleteTarget?.ids.length === 1
                    ? "Delete scenario?"
                    : `Delete ${admin.deleteTarget?.ids.length} scenarios?`}
                </DialogTitle>
                <DialogDescription>
                  {admin.deleteTarget?.ids.length === 1
                    ? `Delete "${admin.deleteTarget?.title ?? "this scenario"}"? This cannot be undone.`
                    : `Delete ${admin.deleteTarget?.ids.length} scenarios? This cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={admin.bulkPending}
                  onClick={() => admin.setDeleteTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={admin.bulkPending}
                  onClick={() => void admin.executeDelete()}
                >
                  {admin.bulkPending ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={!!admin.duplicateResult}
            onOpenChange={(open) => {
              if (!open) admin.setDuplicateResult(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Scenario duplicated</DialogTitle>
                <DialogDescription>
                  "{admin.duplicateResult?.title}" was created as a draft.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => admin.setDuplicateResult(null)}>
                  OK
                </Button>
                <Button
                  onClick={() => {
                    admin.setEditId(admin.duplicateResult!.id);
                    admin.setDuplicateResult(null);
                  }}
                >
                  Open
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </MainLayout>
  );
}
