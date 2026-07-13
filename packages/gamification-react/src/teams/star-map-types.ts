export type ContentHistoryItem = {
  contentId: number;
  title: string;
  coverImageMediaId: number | null;
  starLevel: number;
  bestScore: number | null;
  lastAttemptAt: string | null;
  attemptCount: number;
};

export type TeamSummary = {
  id: number;
  name: string;
  managerId: number | null;
  managerName: string | null;
  memberCount: number;
};

export type StarMapMember = {
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

export type StarMapData = {
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

export type SortColumn = "member" | "summary" | "all" | string;
export type SortDirection = "asc" | "desc";

export type DrawerSelection = {
  userId: number;
  categorySlug: string | null;
};

export const ALL_TEAMS_ID = "all" as const;
