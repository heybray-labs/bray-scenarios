export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

type UserLike = {
  profile?: { firstName?: string | null; lastName?: string | null } | null;
  email?: string | null;
};

export function initialsFromUser(user: UserLike | null | undefined): string {
  const fromProfile = [user?.profile?.firstName?.[0], user?.profile?.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();
  if (fromProfile) return fromProfile;
  return user?.email?.[0]?.toUpperCase() || "?";
}
