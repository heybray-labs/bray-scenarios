import { Avatar, AvatarFallback } from "@heybray/ui/components/avatar";
import { Input } from "@heybray/ui/components/input";
import { CategoryMasteryBar } from "@/components/points/CategoryMasteryBar";
import { TierLegend } from "@/components/teams/TeamStarMapComponents";
import { cn } from "@heybray/ui/utils";
import { ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import type { DrawerSelection, SortColumn, SortDirection, StarMapData, StarMapMember } from "./star-map-types";
import { formatRelativeDate } from "./star-map-utils";

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

type StarMapTableProps = {
  starMap: StarMapData;
  filteredMembers: StarMapMember[];
  search: string;
  onSearchChange: (value: string) => void;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  drawerSelection: DrawerSelection | null;
  onOpenDrawer: (userId: number, categorySlug: string | null) => void;
};

export function StarMapTable({
  starMap,
  filteredMembers,
  search,
  onSearchChange,
  sortColumn,
  sortDirection,
  onSort,
  drawerSelection,
  onOpenDrawer,
}: StarMapTableProps) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2 border rounded-md px-2.5 py-1.5 text-sm text-muted-foreground min-w-[11rem]">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
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
                onSort={onSort}
              />
              <SortableHeader
                label="Summary"
                column="summary"
                align="right"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={onSort}
              />
              <SortableHeader
                label="All Categories"
                column="all"
                align="center"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={onSort}
              />
              {starMap.categories.map((cat) => (
                <SortableHeader
                  key={cat.slug}
                  label={cat.label}
                  column={cat.slug}
                  align="center"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={onSort}
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
                  <FooterCell members={starMap.members} categorySlug="all" />
                </td>
                {starMap.categories.map((cat) => (
                  <td key={cat.slug} className="p-0">
                    <FooterCell members={starMap.members} categorySlug={cat.slug} />
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
                      onClick={() => onOpenDrawer(member.userId, null)}
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
                      onClick={() => onOpenDrawer(member.userId, null)}
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
                      onClick={() => onOpenDrawer(member.userId, null)}
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
                          onClick={() => onOpenDrawer(member.userId, cat.slug)}
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
  );
}
