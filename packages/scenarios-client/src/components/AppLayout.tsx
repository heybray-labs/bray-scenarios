import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import { MainLayout } from "@heybray/react/components/MainLayout";
import { AppBrandTitle } from "@heybray/react/components/AppBrandTitle";
import { getAdminPanels } from "@heybray/react/extensions/admin-registry";
import { useAppConfig } from "@heybray/react/config";
import { Button } from "@heybray/ui/components/button";
import { GamificationNavActions } from "@heybray/gamification-react";
import logo from "../assets/logo.png";
import { usePackageLayoutEnabled } from "../layout-context";

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
  const [, navigate] = useLocation();
  return (
    <GamificationNavActions
      leading={
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => navigate("/search")}
          aria-label="Search scenarios"
        >
          <Search className="h-5 w-5" />
        </Button>
      }
    />
  );
}

// The app's manage-permission string; supplied explicitly to the platform shell
// rather than defaulted inside it.
const MANAGE_PERMISSION = "roleplay:manage";

export function AppLayout({ children }: { children: ReactNode }) {
  const usePackageLayout = usePackageLayoutEnabled();
  if (!usePackageLayout) {
    return <>{children}</>;
  }

  return (
    <MainLayout
      brand={<AppBrand />}
      actions={<AppNavActions />}
      settingsPanels={getAdminPanels()}
      managePermission={MANAGE_PERMISSION}
    >
      {children}
    </MainLayout>
  );
}
