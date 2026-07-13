import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Star, Search, LayoutGrid } from "lucide-react";
import { MainLayout } from "@heybray/react/components/MainLayout";
import { type SettingsPanel } from "@heybray/react/components/SettingsModal";
import { AppBrandTitle } from "@heybray/react/components/AppBrandTitle";
import { AboutPanel } from "@heybray/react/components/AboutPanel";
import { UsersManagementPanel } from "@heybray/react/admin/UsersManagementPanel";
import { TeamsManagementPanel } from "@heybray/react/admin/TeamsManagementPanel";
import { MediaManagementPanel } from "@heybray/react/admin/MediaManagementPanel";
import { ClassificationManagementPanel } from "@heybray/react/admin/ClassificationManagementPanel";
import { useAuth } from "@heybray/react/hooks/use-auth";
import { apiRequest } from "@heybray/react/lib/queryClient";
import { HttpError } from "@heybray/react/lib/http-error";
import { useAppConfig } from "@heybray/react/config";
import { Button } from "@heybray/ui/components/button";
import { NoticeBannerButton, noticeLabelClassName } from "@heybray/ui/components/NoticeBanner";
import { RoleplayConfigPanel } from "@/components/RoleplayConfigPanel";
import { FeaturedScenariosPanel } from "@/components/FeaturedScenariosPanel";
import { PointsHistoryDialog } from "@heybray/gamification-react/points/PointsHistoryDialog";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import logo from "@assets/logo.png";

function AppBrand() {
  const { displayName } = useAppConfig();
  return (
    <Link href="/" className="flex items-end gap-2 no-underline">
      <img src={logo} alt="" className="h-8 w-8" />
      <AppBrandTitle appName={displayName} />
    </Link>
  );
}

function AppNavActions() {
  const { user, hasRole } = useAuth();
  const [, navigate] = useLocation();
  const [pointsHistoryOpen, setPointsHistoryOpen] = useState(false);
  const isAdmin = hasRole("admin");

  const { data: teamsAccess } = useQuery<{ teams: unknown[] }>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/teams");
      } catch (error) {
        if (error instanceof HttpError && error.status === 403) {
          return { teams: [] };
        }
        throw error;
      }
    },
    enabled: !!user,
    retry: false,
    throwOnError: false,
  });

  const showStarMapNav = (teamsAccess?.teams?.length ?? 0) > 0 || isAdmin;

  const { data: pointsData } = useQuery<{ total: number; monthTotal: number }>({
    queryKey: ["/api/points/me"],
    queryFn: () => apiRequest("GET", "/api/points/me"),
    enabled: !!user,
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => navigate("/search")}
        aria-label="Search scenarios"
      >
        <Search className="h-5 w-5" />
      </Button>

      {showStarMapNav && (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-1.5 hidden sm:inline-flex"
          onClick={() => navigate("/team-star-map")}
        >
          <LayoutGrid className="h-4 w-4" />
          Star Map
        </Button>
      )}

      <NoticeBannerButton
        variant="rewards"
        layout="rewards"
        onClick={() => setPointsHistoryOpen(true)}
        title="View points history"
      >
        <Star className="h-4 w-4 fill-[var(--featured-star-fill)] text-[var(--featured-star)] shrink-0" />
        <span className="flex items-center gap-3">
          <span className="flex flex-col items-start leading-tight">
            <span className={noticeLabelClassName()}>This month</span>
            <span className="font-bold tabular-nums">{pointsData?.monthTotal ?? 0}</span>
          </span>
          <span className="h-8 w-px bg-[var(--rewards-banner-border)]" aria-hidden />
          <span className="flex flex-col items-start leading-tight">
            <span className={noticeLabelClassName()}>All time</span>
            <span className="font-bold tabular-nums">{pointsData?.total ?? 0}</span>
          </span>
        </span>
      </NoticeBannerButton>

      <PointsHistoryDialog open={pointsHistoryOpen} onOpenChange={setPointsHistoryOpen} />
    </>
  );
}

const appSettingsPanels: SettingsPanel[] = [
  {
    value: "ai",
    label: "AI",
    render: ({ open, onDirtyChange }) => (
      <RoleplayConfigPanel key={open ? "open" : "closed"} onDirtyChange={onDirtyChange} />
    ),
  },
  { value: "users", label: "Users", render: () => <UsersManagementPanel /> },
  { value: "teams", label: "Teams", render: () => <TeamsManagementPanel /> },
  {
    value: "media",
    label: "Media",
    requiresManage: true,
    render: () => <MediaManagementPanel renderCover={(id) => <ScenarioCover mediaId={id} />} />,
  },
  {
    value: "classifications",
    label: "Classifications",
    requiresManage: true,
    render: () => <ClassificationManagementPanel />,
  },
  {
    value: "homepage",
    label: "Homepage",
    requiresManage: true,
    render: () => <FeaturedScenariosPanel />,
  },
  {
    value: "about",
    label: "About",
    render: () => <AboutPanel logoSrc={logo} />,
  },
];

// The app's manage-permission string; supplied explicitly to the platform shell
// rather than defaulted inside it.
const MANAGE_PERMISSION = "roleplay:manage";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <MainLayout
      brand={<AppBrand />}
      actions={<AppNavActions />}
      settingsPanels={appSettingsPanels}
      managePermission={MANAGE_PERMISSION}
    >
      {children}
    </MainLayout>
  );
}
