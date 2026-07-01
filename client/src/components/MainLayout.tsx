import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { AppBrandTitle } from "@/components/AppBrandTitle";
import { APPLICATION_DISPLAY_NAME } from "@/lib/app-config";
import logo from "@assets/logo.png";

export function Navbar() {
  const { user, logout, hasRole } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isAdmin = hasRole("admin");

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
