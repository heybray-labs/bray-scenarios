import { useState } from "react";
import { Link } from "wouter";
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
import { LogOut, Settings, Star } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { PointsHistoryDialog } from "@/components/points/PointsHistoryDialog";
import { AppBrandTitle } from "@/components/AppBrandTitle";
import { APPLICATION_DISPLAY_NAME } from "@/lib/app-config";
import { apiRequest } from "@/lib/queryClient";
import logo from "@assets/logo.png";

export function Navbar() {
  const { user, logout, hasRole } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pointsHistoryOpen, setPointsHistoryOpen] = useState(false);
  const isAdmin = hasRole("admin");

  const { data: pointsData } = useQuery<{ total: number; monthTotal: number }>({
    queryKey: ["/api/points/me"],
    queryFn: () => apiRequest("GET", "/api/points/me"),
    enabled: !!user,
  });

  const fullName =
    [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";
  const initials =
    [user?.profile?.firstName?.[0], user?.profile?.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  return (
    <nav
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: "#FFD6E7", height: "56px" }}
    >
      <div className="w-full h-full flex items-center justify-between px-4">
        <Link href="/" className="flex items-end gap-2 no-underline">
          <img src={logo} alt="" className="h-8 w-8" />
          <AppBrandTitle appName={APPLICATION_DISPLAY_NAME} />
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <button
                type="button"
                onClick={() => setPointsHistoryOpen(true)}
                className="flex items-center gap-3 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm hover:bg-amber-100 transition-colors"
                title="View points history"
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-500 shrink-0" />
                <span className="flex items-center gap-3 text-amber-900">
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700/80">
                      This month
                    </span>
                    <span className="font-bold tabular-nums">{pointsData?.monthTotal ?? 0}</span>
                  </span>
                  <span className="h-8 w-px bg-amber-200" aria-hidden />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700/80">
                      All time
                    </span>
                    <span className="font-bold tabular-nums">{pointsData?.total ?? 0}</span>
                  </span>
                </span>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 rounded-full px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-gray-900">{fullName}</span>
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
