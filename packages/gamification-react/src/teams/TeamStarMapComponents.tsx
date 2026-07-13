import { useEffect, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@heybray/ui/components/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@heybray/ui/components/collapsible";
import { apiRequest } from "@heybray/react/lib/queryClient";
import {
  CategoryMasteryBar,
  categoryStarred,
  TIER_BAR_COLORS,
} from "../points/CategoryMasteryBar.tsx";
import { drawerPink } from "./drawer-pink-styles.ts";
import type { ContentHistoryItem } from "./star-map-types.ts";
import { cn } from "@heybray/ui/utils";
import { ChevronDown, Loader2, X } from "lucide-react";

type MemberScenarioHistory = {
  userId: number;
  name: string;
  avatarInitials: string;
  teamName: string | null;
  totalPoints: number;
  passRate: number;
  categories: Array<{
    slug: string;
    label: string;
    total: number;
    starCounts: { gold: number; silver: number; bronze: number };
    scenarios: ContentHistoryItem[];
  }>;
};

export type ScenarioListRowProps = {
  item: ContentHistoryItem;
  teamId: number | "all";
  memberUserId: number;
};

type MemberProgressDrawerProps = {
  teamId: number | "all";
  userId: number | null;
  initialExpandedCategory?: string | null;
  onClose: () => void;
  /** App-supplied row renderer (joins roleplay attempt transcript data). */
  ScenarioListRowComponent: ComponentType<ScenarioListRowProps>;
};

function CategorySection({
  category,
  teamId,
  memberUserId,
  ScenarioListRowComponent,
  defaultOpen,
}: {
  category: MemberScenarioHistory["categories"][number];
  teamId: number | "all";
  memberUserId: number;
  ScenarioListRowComponent: ComponentType<ScenarioListRowProps>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const starred = categoryStarred(category.starCounts);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, category.slug]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg overflow-hidden">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors",
            drawerPink.categoryHeader,
          )}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          <span className="flex-1 min-w-0 text-sm font-medium truncate text-left">
            {category.label}
          </span>
          <CategoryMasteryBar
            starCounts={category.starCounts}
            total={category.total}
            className="flex-none w-[4.5rem] shrink-0"
            size="sm"
          />
          <span className="w-10 text-right tabular-nums text-muted-foreground text-xs shrink-0">
            {starred}/{category.total}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className={cn(
            "border-t border-[hsl(330,65%,90%)] px-2 py-2 space-y-1.5",
            drawerPink.categoryBody,
          )}
        >
          {category.scenarios.map((scenario) => (
            <ScenarioListRowComponent
              key={scenario.contentId}
              item={scenario}
              teamId={teamId}
              memberUserId={memberUserId}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function MemberProgressDrawer({
  teamId,
  userId,
  initialExpandedCategory = null,
  onClose,
  ScenarioListRowComponent,
}: MemberProgressDrawerProps) {
  const { data, isLoading } = useQuery<MemberScenarioHistory>({
    queryKey: [`/api/teams/${teamId}/members/${userId}/scenario-history`],
    queryFn: () =>
      apiRequest("GET", `/api/teams/${teamId}/members/${userId}/scenario-history`),
    enabled: userId != null,
  });

  if (userId == null) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-foreground/35"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-card border-l shadow-xl overflow-y-auto"
        role="dialog"
        aria-label="Member progress"
      >
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-black/5 z-10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {isLoading || !data ? (
            <div className="flex items-center gap-2 text-muted-foreground p-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <header className={cn("px-5 pt-5 pb-4 border-b pr-12", drawerPink.header)}>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {data.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold leading-tight truncate">{data.name}</h2>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {[data.teamName, "Learner"].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-2xl font-bold tabular-nums">
                  {data.totalPoints.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {Math.round(data.passRate * 100)}% pass rate
                </span>
              </div>
            </header>
          )}

          {data && (
            <div className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Scenario history
              </h3>
              <div className="space-y-2">
                {data.categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No categorized scenarios yet.
                  </p>
                ) : (
                  data.categories.map((category) => (
                    <CategorySection
                      key={category.slug}
                      category={category}
                      teamId={teamId}
                      memberUserId={data.userId}
                      ScenarioListRowComponent={ScenarioListRowComponent}
                      defaultOpen={initialExpandedCategory === category.slug}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function TierLegend({ className }: { className?: string }) {
  const items = [
    { label: "Gold", color: TIER_BAR_COLORS.gold },
    { label: "Silver", color: TIER_BAR_COLORS.silver },
    { label: "Bronze", color: TIER_BAR_COLORS.bronze },
    { label: "Not started", color: "var(--muted)" },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-4 text-xs text-muted-foreground", className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-4 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
