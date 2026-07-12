/** Display metadata for classification options (shared client + server). */

export type ClassificationOptionDisplay = {
  color: string;
  icon: string;
};

export type ClassificationOptionRef = {
  slug: string;
  label: string;
  color: string | null;
  icon: string | null;
};

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const ICON_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Curated Lucide icons available in the admin picker (kebab-case). */
export const CLASSIFICATION_ICON_OPTIONS = [
  "tag",
  "tags",
  "folder",
  "users",
  "user",
  "user-plus",
  "user-cog",
  "building-2",
  "layers",
  "clock",
  "timer",
  "zap",
  "hourglass",
  "headset",
  "heart",
  "heart-pulse",
  "shield",
  "scale",
  "message-circle",
  "messages-square",
  "handshake",
  "trending-up",
  "shopping-bag",
  "briefcase",
  "target",
  "sparkles",
  "star",
  "book-open",
  "graduation-cap",
  "lightbulb",
  "git-branch",
  "repeat",
  "crown",
  "megaphone",
  "cloud",
] as const;

export type ClassificationIconName = (typeof CLASSIFICATION_ICON_OPTIONS)[number];

export const DIMENSION_DISPLAY_DEFAULTS: Record<string, ClassificationOptionDisplay> = {
  category: { color: "#6366f1", icon: "folder" },
  tags: { color: "#64748b", icon: "tag" },
  audience_level: { color: "#3b82f6", icon: "users" },
  duration: { color: "#f59e0b", icon: "clock" },
};

export const FALLBACK_OPTION_DISPLAY: ClassificationOptionDisplay = {
  color: "#64748b",
  icon: "tag",
};

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function normalizeIconName(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const trimmed = value.trim().toLowerCase();
  if (!ICON_NAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function resolveOptionDisplay(
  option: { color?: string | null; icon?: string | null },
  dimensionSlug?: string,
): ClassificationOptionDisplay {
  const color =
    normalizeHexColor(option.color) ??
    (dimensionSlug ? DIMENSION_DISPLAY_DEFAULTS[dimensionSlug]?.color : undefined) ??
    FALLBACK_OPTION_DISPLAY.color;
  const icon =
    normalizeIconName(option.icon) ??
    (dimensionSlug ? DIMENSION_DISPLAY_DEFAULTS[dimensionSlug]?.icon : undefined) ??
    FALLBACK_OPTION_DISPLAY.icon;
  return { color, icon };
}

export function assertValidOptionDisplay(display: {
  color?: string | null;
  icon?: string | null;
}): ClassificationOptionDisplay {
  const color = normalizeHexColor(display.color);
  const icon = normalizeIconName(display.icon);
  if (display.color != null && display.color !== "" && !color) {
    throw new Error("Color must be a 6-digit hex value (e.g. #3b82f6)");
  }
  if (display.icon != null && display.icon !== "" && !icon) {
    throw new Error("Icon must be a lowercase kebab-case Lucide name (e.g. users)");
  }
  if (!color || !icon) {
    throw new Error("Color and icon are required");
  }
  return { color, icon };
}
