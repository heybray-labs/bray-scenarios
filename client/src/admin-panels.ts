/**
 * Registers Scenarios' settings panels with the platform's AdminRegistry.
 * Imported once from `App.tsx` before render — a module-level side effect,
 * the same pattern `server/db.ts` uses for `setMediaUsageHook`/
 * `setClassificationLinks`. Zero UI change from the previous static array:
 * same 7 panels, same order, same gating.
 */
import { createElement } from "react";
import { registerAdminPanel } from "@heybray/react/extensions/admin-registry";
import { RoleplayConfigPanel } from "@/components/RoleplayConfigPanel";
import { FeaturedScenariosPanel } from "@/components/FeaturedScenariosPanel";
import { UsersManagementPanel } from "@heybray/react/admin/UsersManagementPanel";
import { TeamsManagementPanel } from "@heybray/react/admin/TeamsManagementPanel";
import { MediaManagementPanel } from "@heybray/react/admin/MediaManagementPanel";
import { ClassificationManagementPanel } from "@heybray/react/admin/ClassificationManagementPanel";
import { AboutPanel } from "@heybray/react/components/AboutPanel";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import logo from "@assets/logo.png";

registerAdminPanel({
  value: "ai",
  label: "AI",
  render: ({ open, onDirtyChange }) =>
    createElement(RoleplayConfigPanel, { key: open ? "open" : "closed", onDirtyChange }),
});

registerAdminPanel({
  value: "users",
  label: "Users",
  render: () => createElement(UsersManagementPanel),
});

registerAdminPanel({
  value: "teams",
  label: "Teams",
  render: () => createElement(TeamsManagementPanel),
});

registerAdminPanel({
  value: "media",
  label: "Media",
  requiresManage: true,
  render: () =>
    createElement(MediaManagementPanel, {
      contentNoun: "scenario",
      contentInvalidateKey: "/api/roleplays",
      renderCover: (id: number) => createElement(ScenarioCover, { mediaId: id }),
    }),
});

registerAdminPanel({
  value: "classifications",
  label: "Classifications",
  requiresManage: true,
  render: () =>
    createElement(ClassificationManagementPanel, {
      contentNoun: "scenario",
      taxonomyEndpoint: "/api/roleplay-classifications",
    }),
});

registerAdminPanel({
  value: "homepage",
  label: "Homepage",
  requiresManage: true,
  render: () => createElement(FeaturedScenariosPanel),
});

registerAdminPanel({
  value: "about",
  label: "About",
  render: () => createElement(AboutPanel, { logoSrc: logo }),
});
