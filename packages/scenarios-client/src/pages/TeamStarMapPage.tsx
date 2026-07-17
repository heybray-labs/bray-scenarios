import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "../components/AppLayout";
import { Button } from "@heybray/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import { MemberProgressDrawer } from "@heybray/gamification-react/teams/TeamStarMapComponents";
import { StarMapSummaryCards } from "@heybray/gamification-react/teams/StarMapSummaryCards";
import { StarMapTable } from "@heybray/gamification-react/teams/StarMapTable";
import {
  ALL_TEAMS_ID,
  type DrawerSelection,
  type SortColumn,
  type SortDirection,
  type StarMapData,
  type TeamSummary,
} from "@heybray/gamification-react/teams/star-map-types";
import { compareMembers } from "@heybray/gamification-react/teams/star-map-utils";
import { ScenarioListRow } from "../components/roleplays/ScenarioListRow";
import { PermissionDeniedScreen } from "@heybray/react/errors";
import { useAuth } from "@heybray/react/hooks/use-auth";
import { apiRequest } from "@heybray/react/lib/queryClient";
import { HttpError } from "@heybray/react/lib/http-error";
import {
  ChevronDown,
  Loader2,
  Users,
} from "lucide-react";

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
      <AppLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      </AppLayout>
    );
  }

  if (teamsError instanceof HttpError && teamsError.status === 403) {
    return (
      <AppLayout>
        <PermissionDeniedScreen />
      </AppLayout>
    );
  }

  const noTeams = !isAdmin && !teamsData?.teams.length;

  return (
    <AppLayout>
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
            <StarMapSummaryCards teamSummary={starMap.teamSummary} />
            <StarMapTable
              starMap={starMap}
              filteredMembers={filteredMembers}
              search={search}
              onSearchChange={setSearch}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              drawerSelection={drawerSelection}
              onOpenDrawer={openDrawer}
            />
          </>
        )}
      </div>

      {drawerSelection != null && activeTeamId != null && (
        <MemberProgressDrawer
          teamId={activeTeamId}
          userId={drawerSelection.userId}
          initialExpandedCategory={drawerSelection.categorySlug}
          onClose={() => setDrawerSelection(null)}
          ContentListRowComponent={ScenarioListRow}
        />
      )}
    </AppLayout>
  );
}
