import type { SortColumn, SortDirection, StarMapMember } from "./star-map-types";

export function formatRelativeDate(iso: string | null): string {
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

export function memberMedalCounts(
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

export function compareMedalCounts(
  a: { gold: number; silver: number; bronze: number },
  b: { gold: number; silver: number; bronze: number },
): number {
  if (a.gold !== b.gold) return a.gold - b.gold;
  if (a.silver !== b.silver) return a.silver - b.silver;
  return a.bronze - b.bronze;
}

export function compareMembers(
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
