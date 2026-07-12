import { useState, type ReactNode } from "react";
import { Button } from "@heybray/ui/components/button";
import { Avatar, AvatarFallback } from "@heybray/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "../hooks/use-auth.ts";
import { initialsFromUser } from "../lib/user-display.ts";
import { SettingsModal, type SettingsPanel } from "./SettingsModal.tsx";

export interface NavbarProps {
  /** App-provided branding (logo + title), typically linking home. */
  brand?: ReactNode;
  /** App-provided nav controls (search, gamification, etc.), shown when signed in. */
  actions?: ReactNode;
  /** Settings tabs; the (admin) gear opens the modal when provided. */
  settingsPanels?: SettingsPanel[];
  managePermission?: string;
}

export function Navbar({ brand, actions, settingsPanels, managePermission }: NavbarProps) {
  const { user, logout, hasRole } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isAdmin = hasRole("admin");

  const fullName =
    [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";
  const initials = initialsFromUser(user);

  const hasSettings = isAdmin && !!settingsPanels?.length;

  return (
    <nav
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: "var(--nav-bar-bg)", height: "56px" }}
    >
      <div className="w-full h-full flex items-center justify-between px-4">
        {brand}

        <div className="flex items-center gap-3">
          {user && (
            <>
              {actions}

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
                  {hasSettings && (
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

              {hasSettings && managePermission && (
                <SettingsModal
                  open={settingsOpen}
                  onOpenChange={setSettingsOpen}
                  panels={settingsPanels!}
                  managePermission={managePermission}
                />
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function MainLayout({
  children,
  brand,
  actions,
  settingsPanels,
  managePermission,
}: {
  children: ReactNode;
} & NavbarProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        brand={brand}
        actions={actions}
        settingsPanels={settingsPanels}
        managePermission={managePermission}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
