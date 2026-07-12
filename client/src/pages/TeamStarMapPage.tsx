import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/MainLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CategoryMasteryBar,
} from "@/components/points/CategoryMasteryBar";
import {
  MemberProgressDrawer,
  TierLegend,
} from "@/components/teams/TeamStarMapComponents";
import { PermissionDeniedScreen } from "@/components/errors";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { HttpError } from "@/lib/http-error";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Flame,
  Loader2,
  Search,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { resolveRewardTierDisplay } from "@shared/schemas/points";

type TeamSummary = {
  id: number;
  name: string;
  managerId: number | null;
  managerName: string | null;
  memberCount: number;
};

type StarMapMember = {
  userId: number;
  name: string;
  avatarInitials: string;
  lastActiveAt: string | null;
  totalPoints: number;
  monthPoints: number;
  starCounts: { gold: number; silver: number; bronze: number };
  publishedCount: number;
  passRate: number;
  categoryMastery: Array<{
    slug: string;
    label: string;
    total: number;
    gold: number;
    silver: number;
    bronze: number;
  }>;
};

type StarMapData = {
  team: { id: number | "all"; name: string; managerName: string | null };
  categories: Array<{ slug: string; label: string }>;
  members: StarMapMember[];
  teamSummary: {
    totalPoints: number;
    monthPoints: number;
    starCounts: { gold: number; silver: number; bronze: number };
    passRate: number;
    activeThisWeek: number;
    memberCount: number;
  };
};

type SortColumn = "member" | "summary" | "all" | string;
type SortDirection = "asc" | "desc";

const ALL_TEAMS_ID = "all" as const;

type DrawerSelection = {
  userId: number;
  categorySlug: string | null;
};

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function memberMedalCounts(
  member: StarMapMember,
  column: "all" | string,
): { gold: number; silver: number; bronze: number } {
  if (column === "all") {
    return member.starCounts;
  }
  const cat = member.categoryMastery.find((c) => c.slug === column);
  return cat
    ? { gold: cat.gold, silver: cat.silver, bronze: cat.bronze }
    : { gold: 0, silver: 0, bronze: 0 };
}

function compareMedalCounts(
  a: { gold: number; silver: number; bronze: number },
  b: { gold: number; silver: number; bronze: number },
): number {
  if (a.gold !== b.gold) return a.gold - b.gold;
  if (a.silver !== b.silver) return a.silver - b.silver;
  return a.bronze - b.bronze;
}

function compareMembers(
  a: StarMapMember,
  b: StarMapMember,
  column: SortColumn,
  direction: SortDirection,
): number {
  let cmp = 0;
  if (column === "member") {
    cmp = a.name.localeCompare(b.name);
  } else if (column === "summary") {
    cmp = a.totalPoints - b.totalPoints;
  } else {
    cmp = compareMedalCounts(memberMedalCounts(a, column), memberMedalCounts(b, column));
  }
  return direction === "asc" ? cmp : -cmp;
}

function SortableHeader({
  label,
  column,
  align = "left",
  sortColumn,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  align?: "left" | "center" | "right";
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const active = sortColumn === column;
  return (
    <th
      className={cn(
        "py-3",
        align === "left" && "text-left pl-4",
        align === "center" && "text-center px-2",
        align === "right" && "text-right pr-4",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 hover:opacity-80 transition-opacity",
          align === "center" && "mx-auto",
          align === "right" && "ml-auto",
          column === "member" && "min-w-[12rem]",
        )}
        aria-sort={
          active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
        }
      >
        {label}
        <ChevronsUpDown
          className={cn(
            "h-3 w-3 shrink-0",
            active ? "opacity-100" : "opacity-50",
            active && sortDirection === "asc" && "rotate-180",
          )}
        />
      </button>
    </th>
  );
}

function MatrixCell({
  starCounts,
  total,
  emphasized,
}: {
  starCounts: { gold: number; silver: number; bronze: number };
  total: number;
  emphasized?: boolean;
}) {
  return (
    <div className={cn("px-2 py-2", emphasized && "bg-primary/5")}>
      <CategoryMasteryBar
        starCounts={starCounts}
        total={total}
        className="flex-none w-[4.5rem] mx-auto"
        size="sm"
      />
    </div>
  );
}

function FooterCell({
  members,
  categorySlug,
}: {
  members: StarMapMember[];
  categorySlug: "all" | string;
}) {
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  let totalPossible = 0;

  for (const member of members) {
    if (categorySlug === "all") {
      gold += member.starCounts.gold;
      silver += member.starCounts.silver;
      bronze += member.starCounts.bronze;
      totalPossible += member.publishedCount;
    } else {
      const cat = member.categoryMastery.find((c) => c.slug === categorySlug);
      if (cat) {
        gold += cat.gold;
        silver += cat.silver;
        bronze += cat.bronze;
        totalPossible += cat.total;
      }
    }
  }

  const starCounts = { gold, silver, bronze };

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <CategoryMasteryBar
        starCounts={starCounts}
        total={totalPossible}
        className="flex-none w-[4.5rem]"
        size="sm"
      />
    </div>
  );
}

export default function TeamStarMapPage() {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("roleplay:manage");
  const [selectedTeamId, setSelectedTeamId] = useState<number | typeof ALL_TEAMS_ID | null>(null);
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("summary");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [drawerSelection, setDrawerSelection] = useState<DrawerSelection | null>(null);

  const openDrawer = (userId: number, categorySlug: string | null) => {
    setDrawerSelection({ userId, categorySlug });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection(column === "member" ? "asc" : "desc");
  };

  const {
    data: teamsData,
    isLoading: teamsLoading,
    error: teamsError,
  } = useQuery<{ teams: TeamSummary[] }>({
    queryKey: ["/api/teams"],
    queryFn: () => apiRequest("GET", "/api/teams"),
    retry: false,
  });

  const activeTeamId = useMemo(() => {
    if (selectedTeamId != null) return selectedTeamId;
    if (isAdmin && !teamsData?.teams.length) return ALL_TEAMS_ID;
    if (!teamsData?.teams.length) return null;
    if (teamsData.teams.length === 1 && !isAdmin) return teamsData.teams[0].id;
    return teamsData.teams[0].id;
  }, [selectedTeamId, teamsData, isAdmin]);

  const showSwitcher =
    isAdmin || (teamsData?.teams.length ?? 0) > 1;

  const {
    data: starMap,
    isLoading: mapLoading,
  } = useQuery<StarMapData>({
    queryKey: [`/api/teams/${activeTeamId}/star-map`],
    queryFn: () => apiRequest("GET", `/api/teams/${activeTeamId}/star-map`),
    enabled: activeTeamId != null,
  });

  const filteredMembers = useMemo(() => {
    if (!starMap) return [];
    let rows = [...starMap.members];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((m) => m.name.toLowerCase().includes(q));
    }

    rows.sort((a, b) => compareMembers(a, b, sortColumn, sortDirection));

    return rows;
  }, [starMap, search, sortColumn, sortDirection]);

  if (teamsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      </MainLayout>
    );
  }

  if (teamsError instanceof HttpError && teamsError.status === 403) {
    return (
      <MainLayout>
        <PermissionDeniedScreen />
      </MainLayout>
    );
  }

  const noTeams = !isAdmin && !teamsData?.teams.length;

  return (
    <MainLayout>
      <div className="max-w-[76rem] mx-auto px-6 py-6 pb-16">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded px-2 py-0.5 mb-1.5">
              Team view
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold">Star Map</h1>
              {showSwitcher && activeTeamId != null && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 font-semibold">
                      {activeTeamId === ALL_TEAMS_ID
                        ? "All teams"
                        : teamsData?.teams.find((t) => t.id === activeTeamId)?.name ??
                          starMap?.team.name ??
                          "Select team"}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {isAdmin && (
                      <DropdownMenuItem onSelect={() => setSelectedTeamId(ALL_TEAMS_ID)}>
                        All teams
                      </DropdownMenuItem>
                    )}
                    {teamsData?.teams.map((team) => (
                      <DropdownMenuItem
                        key={team.id}
                        onSelect={() => setSelectedTeamId(team.id)}
                      >
                        {team.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {noTeams ? (
                "You don't manage any teams yet — contact an admin."
              ) : (
                <>
                  {starMap?.teamSummary.memberCount ?? 0} members
                  {isAdmin && " · Viewing as admin"}
                  {!isAdmin &&
                    teamsData?.teams.length &&
                    ` · You manage ${teamsData.teams.length} team${teamsData.teams.length === 1 ? "" : "s"}`}
                </>
              )}
            </p>
          </div>
        </header>

        {noTeams ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm max-w-sm mx-auto">
              No teams are assigned to you yet. Ask an admin to create a team and set you as its
              manager in Settings → Teams.
            </p>
          </div>
        ) : mapLoading || !starMap ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading star map…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
              <SummaryCard
                label="Team points"
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                value={starMap.teamSummary.totalPoints.toLocaleString()}
                delta={
                  starMap.teamSummary.monthPoints > 0
                    ? `+${starMap.teamSummary.monthPoints} this month`
                    : undefined
                }
              />
              <SummaryCard
                label="Tier record"
                icon={<Star className="h-3.5 w-3.5" />}
                value={
                  <span className="flex items-center gap-3 text-base font-semibold">
                    <TierCount level={3} count={starMap.teamSummary.starCounts.gold} />
                    <TierCount level={2} count={starMap.teamSummary.starCounts.silver} />
                    <TierCount level={1} count={starMap.teamSummary.starCounts.bronze} />
                  </span>
                }
              />
              <SummaryCard
                label="Pass rate"
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                value={`${Math.round(starMap.teamSummary.passRate * 100)}%`}
                hint="Average per-member pass rate"
              />
              <SummaryCard
                label="Practicing this week"
                icon={<Flame className="h-3.5 w-3.5" />}
                value={`${starMap.teamSummary.activeThisWeek} of ${starMap.teamSummary.memberCount}`}
                hint="Members with ≥1 attempt this ISO week"
              />
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
                <div className="flex items-center gap-2 border rounded-md px-2.5 py-1.5 text-sm text-muted-foreground min-w-[11rem]">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members…"
                    className="border-0 h-auto p-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm min-w-[48rem]">
                  <thead>
                    <tr className="border-b border-primary bg-primary text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                      <SortableHeader
                        label="Member"
                        column="member"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Summary"
                        column="summary"
                        align="right"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="All Categories"
                        column="all"
                        align="center"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      {starMap.categories.map((cat) => (
                        <SortableHeader
                          key={cat.slug}
                          label={cat.label}
                          column={cat.slug}
                          align="center"
                          sortColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {starMap.members.length > 0 && (
                      <tr className="bg-accent border-b-2 border-primary/25">
                        <td className="py-3 pl-4 text-xs font-semibold uppercase tracking-wide text-foreground">
                          Team total
                        </td>
                        <td className="text-right pr-4 py-2.5">
                          <p className="font-bold tabular-nums">
                            {starMap.teamSummary.totalPoints.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {Math.round(starMap.teamSummary.passRate * 100)}% pass
                          </p>
                        </td>
                        <td className="p-0 border-x border-primary/15 bg-primary/15">
                          <FooterCell
                            members={starMap.members}
                            categorySlug="all"
                          />
                        </td>
                        {starMap.categories.map((cat) => (
                          <td key={cat.slug} className="p-0">
                            <FooterCell
                              members={starMap.members}
                              categorySlug={cat.slug}
                            />
                          </td>
                        ))}
                      </tr>
                    )}
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={starMap.categories.length + 3}
                          className="py-12 text-center text-muted-foreground"
                        >
                          {starMap.members.length === 0
                            ? "No members on this team yet."
                            : "No members match your search."}
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((member) => {
                        const isSelected = drawerSelection?.userId === member.userId;
                        return (
                        <tr
                          key={member.userId}
                          className={cn(
                            "border-b group transition-colors",
                            isSelected && "bg-muted/40",
                          )}
                        >
                          <td
                            className="py-2.5 pl-4 cursor-pointer hover:bg-muted/60"
                            onClick={() => openDrawer(member.userId, null)}
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs font-semibold bg-muted">
                                  {member.avatarInitials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{member.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatRelativeDate(member.lastActiveAt)}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto shrink-0" />
                            </div>
                          </td>
                          <td
                            className="text-right pr-4 py-2.5 cursor-pointer hover:bg-muted/60"
                            onClick={() => openDrawer(member.userId, null)}
                          >
                            <p className="font-bold tabular-nums">
                              {member.totalPoints.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {Math.round(member.passRate * 100)}% pass
                            </p>
                          </td>
                          <td
                            className={cn(
                              "p-0 border-x bg-primary/5 cursor-pointer hover:bg-primary/10",
                              isSelected && drawerSelection?.categorySlug === null && "ring-2 ring-inset ring-primary/30",
                            )}
                            onClick={() => openDrawer(member.userId, null)}
                          >
                            <MatrixCell
                              emphasized
                              starCounts={member.starCounts}
                              total={member.publishedCount}
                            />
                          </td>
                          {starMap.categories.map((cat) => {
                            const row =
                              member.categoryMastery.find((c) => c.slug === cat.slug) ?? {
                                gold: 0,
                                silver: 0,
                                bronze: 0,
                                total: 0,
                              };
                            const isCategorySelected =
                              isSelected && drawerSelection?.categorySlug === cat.slug;
                            return (
                              <td
                                key={cat.slug}
                                className={cn(
                                  "p-0 cursor-pointer hover:bg-muted/60",
                                  isCategorySelected && "ring-2 ring-inset ring-primary/30",
                                )}
                                onClick={() => openDrawer(member.userId, cat.slug)}
                              >
                                <MatrixCell
                                  starCounts={{
                                    gold: row.gold,
                                    silver: row.silver,
                                    bronze: row.bronze,
                                  }}
                                  total={row.total}
                                />
                              </td>
                            );
                          })}
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2.5 border-t">
                <TierLegend />
              </div>
            </div>
          </>
        )}
      </div>

      {drawerSelection != null && activeTeamId != null && (
        <MemberProgressDrawer
          teamId={activeTeamId}
          userId={drawerSelection.userId}
          initialExpandedCategory={drawerSelection.categorySlug}
          onClose={() => setDrawerSelection(null)}
        />
      )}
    </MainLayout>
  );
}

function SummaryCard({
  label,
  icon,
  value,
  delta,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  delta?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
        {icon}
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums">
        {value}
        {delta && (
          <span className="ml-2 text-xs font-semibold text-success">{delta}</span>
        )}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function TierCount({ level, count }: { level: 1 | 2 | 3; count: number }) {
  const display = resolveRewardTierDisplay({ starLevel: level });
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="h-3.5 w-3.5" style={{ fill: display.color, color: display.color }} />
      {count}
    </span>
  );
}
