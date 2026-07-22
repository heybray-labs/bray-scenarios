/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Copyright (C) 2026 Heybray
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppConfigProvider, type AppConfig } from "@heybray/react/config";
import { AppLayout } from "./AppLayout.tsx";

const navigate = vi.fn();

vi.mock("@heybray/react/components/MainLayout", () => ({
  MainLayout: ({
    actions,
    children,
  }: {
    actions?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <div data-testid="nav-actions">{actions}</div>
      {children}
    </div>
  ),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ["/", navigate],
}));

vi.mock("../layout-context", () => ({
  usePackageLayoutEnabled: () => true,
}));

vi.mock("@heybray/react/extensions/admin-registry", () => ({
  getAdminPanels: () => [],
}));

vi.mock("@heybray/react/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "learner@test.local", profile: { firstName: "Test" } },
    hasRole: () => true,
    hasPermission: () => true,
    logout: vi.fn(),
  }),
}));

vi.mock("@heybray/react/lib/queryClient", () => ({
  apiRequest: vi.fn(async (method: string, path: string) => {
    if (method === "GET" && path === "/api/teams") {
      return { teams: [{ id: 1 }] };
    }
    if (method === "GET" && path === "/api/points/me") {
      return { total: 50, monthTotal: 5 };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  }),
}));

const appConfig: AppConfig = {
  displayName: "Scenarios",
  urls: { repo: "https://example.com/repo" },
  routes: {
    contentPath: () => "/",
    teamStarMapPath: "/team-star-map",
  },
};

describe("AppLayout navbar actions", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("renders gamification controls in MainLayout.actions", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AppConfigProvider value={appConfig}>
          <AppLayout>
            <div>Page content</div>
          </AppLayout>
        </AppConfigProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTitle("View points history")).toBeTruthy();
    expect(screen.getByText("This month")).toBeTruthy();
    expect(screen.getByText("All time")).toBeTruthy();
    expect(await screen.findByText("5")).toBeTruthy();
    expect(await screen.findByText("50")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Star Map" })).toBeTruthy();
    expect(screen.getByLabelText("Search scenarios")).toBeTruthy();
  });
});
