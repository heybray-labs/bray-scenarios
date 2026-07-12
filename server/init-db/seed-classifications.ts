import { db } from "../db.ts";
import {
  classificationDimensions,
  classificationOptions,
  slugifyLabel,
  DIMENSION_DISPLAY_DEFAULTS,
  FALLBACK_OPTION_DISPLAY,
  type ClassificationOptionDisplay,
} from "@heybray/taxonomy/schema";
import { and, eq } from "drizzle-orm";
import { createLogger } from "@heybray/server-kit";

const log = createLogger("seed-classifications");

type SeedOption = {
  label: string;
  slug: string;
  color: string;
  icon: string;
};

export const TAXONOMY_DIMENSIONS = [
  { slug: "category", name: "Category", cardinality: "single", sortOrder: 0 },
  { slug: "tags", name: "Tags", cardinality: "multi", sortOrder: 1 },
  { slug: "audience_level", name: "Audience Level", cardinality: "single", sortOrder: 2 },
  { slug: "duration", name: "Duration", cardinality: "single", sortOrder: 3 },
] as const;

export const CATEGORY_OPTIONS: SeedOption[] = [
  { label: "Customer Service", slug: "customer-service", color: "#0891b2", icon: "headset" },
  { label: "Leadership", slug: "leadership", color: "#7c3aed", icon: "crown" },
  { label: "Management", slug: "management", color: "#2563eb", icon: "users" },
  { label: "Sales", slug: "sales", color: "#059669", icon: "trending-up" },
  { label: "Healthcare", slug: "healthcare", color: "#dc2626", icon: "heart-pulse" },
  { label: "HR", slug: "hr", color: "#9333ea", icon: "user-cog" },
  { label: "Recruitment", slug: "recruitment", color: "#ca8a04", icon: "user-plus" },
  { label: "Customer Success", slug: "customer-success", color: "#0d9488", icon: "handshake" },
];

export const AUDIENCE_LEVEL_OPTIONS: SeedOption[] = [
  { label: "Individual Contributor", slug: "individual-contributor", color: "#64748b", icon: "user" },
  { label: "Manager", slug: "manager", color: "#2563eb", icon: "users" },
  { label: "Senior Leader", slug: "senior-leader", color: "#7c3aed", icon: "building-2" },
  { label: "All Levels", slug: "all-levels", color: "#6b7280", icon: "layers" },
];

export const DURATION_OPTIONS: SeedOption[] = [
  { label: "Quick (~5–10 min)", slug: "quick", color: "#f59e0b", icon: "zap" },
  { label: "Standard (~10–20 min)", slug: "standard", color: "#3b82f6", icon: "clock" },
  { label: "Extended (20+ min)", slug: "extended", color: "#6366f1", icon: "hourglass" },
];

const TAG_DISPLAY: Record<string, ClassificationOptionDisplay> = {
  "de-escalation": { color: "#ef4444", icon: "shield" },
  empathy: { color: "#ec4899", icon: "heart" },
  retail: { color: "#f97316", icon: "shopping-bag" },
  negotiation: { color: "#8b5cf6", icon: "scale" },
  career: { color: "#0ea5e9", icon: "briefcase" },
  "self-advocacy": { color: "#14b8a6", icon: "megaphone" },
  communication: { color: "#3b82f6", icon: "message-circle" },
  leadership: { color: "#7c3aed", icon: "sparkles" },
  "change-management": { color: "#6366f1", icon: "repeat" },
  prospecting: { color: "#059669", icon: "target" },
  B2B: { color: "#0284c7", icon: "building-2" },
  "objection-handling": { color: "#dc2626", icon: "shield" },
  "bedside-manner": { color: "#e11d48", icon: "heart-pulse" },
  feedback: { color: "#f59e0b", icon: "messages-square" },
  management: { color: "#2563eb", icon: "users" },
  development: { color: "#10b981", icon: "graduation-cap" },
  "conflict-resolution": { color: "#b45309", icon: "git-branch" },
  mediation: { color: "#7c3aed", icon: "handshake" },
  teamwork: { color: "#0891b2", icon: "users" },
  upselling: { color: "#059669", icon: "trending-up" },
  SaaS: { color: "#4f46e5", icon: "cloud" },
  "customer-success": { color: "#0d9488", icon: "star" },
  hiring: { color: "#ca8a04", icon: "user-plus" },
  "employer-brand": { color: "#db2777", icon: "sparkles" },
  interviewing: { color: "#9333ea", icon: "messages-square" },
  "account-management": { color: "#0369a1", icon: "briefcase" },
  trust: { color: "#059669", icon: "handshake" },
};

const TAG_SLUGS = [
  "de-escalation",
  "empathy",
  "retail",
  "negotiation",
  "career",
  "self-advocacy",
  "communication",
  "leadership",
  "change-management",
  "prospecting",
  "B2B",
  "objection-handling",
  "bedside-manner",
  "feedback",
  "management",
  "development",
  "conflict-resolution",
  "mediation",
  "teamwork",
  "upselling",
  "SaaS",
  "customer-success",
  "hiring",
  "employer-brand",
  "interviewing",
  "account-management",
  "trust",
];

export const TAG_OPTIONS: SeedOption[] = TAG_SLUGS.map((slug) => {
  const display = TAG_DISPLAY[slug] ?? FALLBACK_OPTION_DISPLAY;
  return {
    slug,
    label: slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    color: display.color,
    icon: display.icon,
  };
});

const OPTION_SETS: Record<string, SeedOption[]> = {
  category: CATEGORY_OPTIONS,
  tags: TAG_OPTIONS,
  audience_level: AUDIENCE_LEVEL_OPTIONS,
  duration: DURATION_OPTIONS,
};

function defaultDisplayForDimension(dimensionSlug: string): ClassificationOptionDisplay {
  return DIMENSION_DISPLAY_DEFAULTS[dimensionSlug] ?? FALLBACK_OPTION_DISPLAY;
}

export async function seedClassifications() {
  const dimensionIds = new Map<string, number>();

  for (const dim of TAXONOMY_DIMENSIONS) {
    const [existing] = await db
      .select()
      .from(classificationDimensions)
      .where(eq(classificationDimensions.slug, dim.slug))
      .limit(1);

    if (existing) {
      dimensionIds.set(dim.slug, existing.id);
      continue;
    }

    const [created] = await db
      .insert(classificationDimensions)
      .values(dim)
      .returning();
    dimensionIds.set(dim.slug, created.id);
    log.info("Created classification dimension", { slug: dim.slug });
  }

  for (const [dimSlug, options] of Object.entries(OPTION_SETS)) {
    const dimensionId = dimensionIds.get(dimSlug);
    if (!dimensionId) continue;

    const dimDefault = defaultDisplayForDimension(dimSlug);

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const slug = opt.slug || slugifyLabel(opt.label);
      const color = opt.color ?? dimDefault.color;
      const icon = opt.icon ?? dimDefault.icon;

      const [existing] = await db
        .select()
        .from(classificationOptions)
        .where(
          and(
            eq(classificationOptions.dimensionId, dimensionId),
            eq(classificationOptions.slug, slug),
          ),
        )
        .limit(1);

      if (existing) {
        if (!existing.color || !existing.icon) {
          await db
            .update(classificationOptions)
            .set({ color: existing.color ?? color, icon: existing.icon ?? icon })
            .where(eq(classificationOptions.id, existing.id));
        }
        continue;
      }

      await db.insert(classificationOptions).values({
        dimensionId,
        slug,
        label: opt.label,
        sortOrder: i,
        isActive: true,
        color,
        icon,
      });
    }
  }

  log.info("Classification taxonomy seeded");
}

export function categoryLabelToSlug(label: string): string {
  const match = CATEGORY_OPTIONS.find(
    (opt) => opt.label.toLowerCase() === label.toLowerCase(),
  );
  return match?.slug ?? slugifyLabel(label);
}
