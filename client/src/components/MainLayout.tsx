import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Star, Search, LayoutGrid } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { PointsHistoryDialog } from "@/components/points/PointsHistoryDialog";
import { AppBrandTitle } from "@/components/AppBrandTitle";
import { NoticeBannerButton, noticeLabelClassName } from "@/components/ui/NoticeBanner";
import { initialsFromUser } from "@/lib/user-display";
import { APPLICATION_DISPLAY_NAME } from "@/lib/app-config";
import { apiRequest } from "@/lib/queryClient";
import { HttpError } from "@/lib/http-error";
import logo from "@assets/logo.png";

export function Navbar() {
  const { user, logout, hasRole } = useAuth();
  const [, navigate] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const fullName =
    [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";
  const initials = initialsFromUser(user);

  return (
    <nav
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: "var(--nav-bar-bg)", height: "56px" }}
    >
      <div className="w-full h-full flex items-center justify-between px-4">
        <Link href="/" className="flex items-end gap-2 no-underline">
          <img src={logo} alt="" className="h-8 w-8" />
          <AppBrandTitle appName={APPLICATION_DISPLAY_NAME} />
        </Link>

        <div className="flex items-center gap-3">
          {user && (
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
                    <span className={noticeLabelClassName()}>
                      This month
                    </span>
                    <span className="font-bold tabular-nums">{pointsData?.monthTotal ?? 0}</span>
                  </span>
                  <span className="h-8 w-px bg-[var(--rewards-banner-border)]" aria-hidden />
                  <span className="flex flex-col items-start leading-tight">
                    <span className={noticeLabelClassName()}>
                      All time
                    </span>
                    <span className="font-bold tabular-nums">{pointsData?.total ?? 0}</span>
                  </span>
                </span>
              </NoticeBannerButton>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 rounded-full px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{fullName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user.email}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setSettingsOpen(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {isAdmin && (
                <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
              )}
              <PointsHistoryDialog open={pointsHistoryOpen} onOpenChange={setPointsHistoryOpen} />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
