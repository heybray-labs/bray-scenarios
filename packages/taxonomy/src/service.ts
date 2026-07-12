import { db } from "@heybray/server-kit";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  classificationDimensions,
  classificationOptions,
  slugifyLabel,
  labelFromSlug,
  IMPORT_AUTO_DIMENSIONS,
  IMPORT_PROMPT_DIMENSIONS,
  type ClassificationDimensionWithOptions,
  type MissingImportClassificationOption,
  type RoleplayClassificationInput,
  type RoleplayClassifications,
} from "./schema/classifications.ts";
import { classificationLinks as roleplayClassificationLinks } from "./schema/links-registry.ts";
import {
  assertValidOptionDisplay,
  DIMENSION_DISPLAY_DEFAULTS,
  FALLBACK_OPTION_DISPLAY,
  resolveOptionDisplay,
} from "./schema/display.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function emptyClassifications(): RoleplayClassifications {
  return { category: null, audienceLevel: null, duration: null, tags: [] };
}

function toOptionRef(
  slug: string,
  label: string,
  color: string | null,
  icon: string | null,
  dimensionSlug: string,
) {
  const display = resolveOptionDisplay({ color, icon }, dimensionSlug);
  return { slug, label, color: display.color, icon: display.icon };
}

function mapLinksToClassifications(
  rows: Array<{
    dimensionSlug: string;
    optionSlug: string;
    optionLabel: string;
    optionColor: string | null;
    optionIcon: string | null;
  }>,
): RoleplayClassifications {
  const result = emptyClassifications();
  for (const row of rows) {
    const entry = toOptionRef(
      row.optionSlug,
      row.optionLabel,
      row.optionColor,
      row.optionIcon,
      row.dimensionSlug,
    );
    switch (row.dimensionSlug) {
      case "category":
        result.category = entry;
        break;
      case "audience_level":
        result.audienceLevel = entry;
        break;
      case "duration":
        result.duration = entry;
        break;
      case "tags":
        result.tags.push(entry);
        break;
    }
  }
  return result;
}

function mapOptionRow(
  opt: {
    id: number;
    dimensionId: number;
    slug: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
    color: string | null;
    icon: string | null;
    usageCount: number | bigint;
  },
  dimensionSlug: string,
): ClassificationDimensionWithOptions["options"][number] {
  const display = resolveOptionDisplay(opt, dimensionSlug);
  return {
    id: opt.id,
    slug: opt.slug,
    label: opt.label,
    sortOrder: opt.sortOrder,
    isActive: opt.isActive,
    color: display.color,
    icon: display.icon,
    usageCount: Number(opt.usageCount),
  };
}

export class ClassificationService {
  private async loadDimensionsWithOptions(includeInactive: boolean) {
    const dimensions = await db
      .select()
      .from(classificationDimensions)
      .orderBy(asc(classificationDimensions.sortOrder), asc(classificationDimensions.name));

    const options = await db
      .select({
        id: classificationOptions.id,
        dimensionId: classificationOptions.dimensionId,
        slug: classificationOptions.slug,
        label: classificationOptions.label,
        sortOrder: classificationOptions.sortOrder,
        isActive: classificationOptions.isActive,
        color: classificationOptions.color,
        icon: classificationOptions.icon,
        usageCount: count(roleplayClassificationLinks.roleplayId),
      })
      .from(classificationOptions)
      .leftJoin(
        roleplayClassificationLinks,
        eq(roleplayClassificationLinks.optionId, classificationOptions.id),
      )
      .where(includeInactive ? undefined : eq(classificationOptions.isActive, true))
      .groupBy(classificationOptions.id)
      .orderBy(asc(classificationOptions.sortOrder), asc(classificationOptions.label));

    const dimSlugById = new Map(dimensions.map((d) => [d.id, d.slug]));
    const optionsByDimension = new Map<number, ClassificationDimensionWithOptions["options"]>();

    for (const opt of options) {
      const dimSlug = dimSlugById.get(opt.dimensionId) ?? "";
      const list = optionsByDimension.get(opt.dimensionId) ?? [];
      list.push(mapOptionRow(opt, dimSlug));
      optionsByDimension.set(opt.dimensionId, list);
    }

    return dimensions.map((dim) => ({
      id: dim.id,
      slug: dim.slug,
      name: dim.name,
      cardinality: dim.cardinality,
      sortOrder: dim.sortOrder,
      options: optionsByDimension.get(dim.id) ?? [],
    }));
  }

  async getDimensionsWithOptions(includeInactive = false): Promise<ClassificationDimensionWithOptions[]> {
    return this.loadDimensionsWithOptions(includeInactive);
  }

  async getDimensionsWithAllOptions(): Promise<ClassificationDimensionWithOptions[]> {
    return this.loadDimensionsWithOptions(true);
  }

  async getClassificationsForRoleplays(roleplayIds: number[]): Promise<Map<number, RoleplayClassifications>> {
    const result = new Map<number, RoleplayClassifications>();
    if (!roleplayIds.length) return result;

    for (const id of roleplayIds) {
      result.set(id, emptyClassifications());
    }

    const rows = await db
      .select({
        roleplayId: roleplayClassificationLinks.roleplayId,
        dimensionSlug: classificationDimensions.slug,
        optionSlug: classificationOptions.slug,
        optionLabel: classificationOptions.label,
        optionColor: classificationOptions.color,
        optionIcon: classificationOptions.icon,
      })
      .from(roleplayClassificationLinks)
      .innerJoin(
        classificationOptions,
        eq(classificationOptions.id, roleplayClassificationLinks.optionId),
      )
      .innerJoin(
        classificationDimensions,
        eq(classificationDimensions.id, classificationOptions.dimensionId),
      )
      .where(inArray(roleplayClassificationLinks.roleplayId, roleplayIds))
      .orderBy(asc(classificationOptions.sortOrder));

    for (const row of rows) {
      const current = result.get(row.roleplayId) ?? emptyClassifications();
      const mapped = mapLinksToClassifications([
        {
          dimensionSlug: row.dimensionSlug,
          optionSlug: row.optionSlug,
          optionLabel: row.optionLabel,
          optionColor: row.optionColor,
          optionIcon: row.optionIcon,
        },
      ]);
      if (mapped.category) current.category = mapped.category;
      if (mapped.audienceLevel) current.audienceLevel = mapped.audienceLevel;
      if (mapped.duration) current.duration = mapped.duration;
      if (mapped.tags.length) current.tags.push(...mapped.tags);
      result.set(row.roleplayId, current);
    }

    return result;
  }

  async getClassificationsForRoleplay(roleplayId: number): Promise<RoleplayClassifications> {
    const map = await this.getClassificationsForRoleplays([roleplayId]);
    return map.get(roleplayId) ?? emptyClassifications();
  }

  async setRoleplayClassifications(
    roleplayId: number,
    input: RoleplayClassificationInput,
    tx: DbTx | typeof db = db,
  ) {
    const slugMap: Record<string, string | string[] | null | undefined> = {
      category: input.category,
      audience_level: input.audienceLevel,
      duration: input.duration,
      tags: input.tags,
    };

    const dimensions = await tx.select().from(classificationDimensions);
    const dimBySlug = new Map(dimensions.map((d) => [d.slug, d]));

    const optionIds: number[] = [];

    for (const [dimSlug, value] of Object.entries(slugMap)) {
      const dimension = dimBySlug.get(dimSlug);
      if (!dimension) continue;

      const slugs = Array.isArray(value)
        ? value.filter(Boolean)
        : value
          ? [value]
          : [];

      if (dimension.cardinality === "single" && slugs.length > 1) {
        throw new Error(`Dimension "${dimSlug}" allows only one value`);
      }

      for (const slug of slugs) {
        const [option] = await tx
          .select()
          .from(classificationOptions)
          .where(
            and(
              eq(classificationOptions.dimensionId, dimension.id),
              eq(classificationOptions.slug, slug),
              eq(classificationOptions.isActive, true),
            ),
          )
          .limit(1);
        if (!option) {
          throw new Error(`Unknown classification option "${slug}" for dimension "${dimSlug}"`);
        }
        optionIds.push(option.id);
      }
    }

    await tx
      .delete(roleplayClassificationLinks)
      .where(eq(roleplayClassificationLinks.roleplayId, roleplayId));

    if (optionIds.length) {
      await tx.insert(roleplayClassificationLinks).values(
        optionIds.map((optionId) => ({ roleplayId, optionId })),
      );
    }
  }

  async resolveImportClassifications(
    input: RoleplayClassificationInput,
  ): Promise<RoleplayClassificationInput> {
    const dimensions = await this.getDimensionsWithAllOptions();
    const resolve = (dimSlug: string, slug: string | null | undefined) => {
      if (!slug) return null;
      const dim = dimensions.find((d) => d.slug === dimSlug);
      const opt = dim?.options.find((o) => o.slug === slug && o.isActive);
      if (!opt) {
        throw new Error(`Unknown ${dimSlug} value "${slug}" in import`);
      }
      return slug;
    };

    const tags = (input.tags ?? []).map((tag) => {
      const dim = dimensions.find((d) => d.slug === "tags");
      const opt = dim?.options.find((o) => o.slug === tag && o.isActive);
      if (!opt) {
        throw new Error(`Unknown tag "${tag}" in import`);
      }
      return tag;
    });

    return {
      category: resolve("category", input.category),
      audienceLevel: resolve("audience_level", input.audienceLevel),
      duration: resolve("duration", input.duration),
      tags,
    };
  }

  async findMissingImportOptions(
    inputs: RoleplayClassificationInput[],
    dimensionSlugs: readonly string[] = [
      ...IMPORT_PROMPT_DIMENSIONS,
      ...IMPORT_AUTO_DIMENSIONS,
    ],
  ): Promise<MissingImportClassificationOption[]> {
    const dimensions = await this.getDimensionsWithAllOptions();
    const missing = new Map<string, MissingImportClassificationOption>();
    const allowed = new Set(dimensionSlugs);

    const noteMissing = (dimSlug: string, slug: string | null | undefined) => {
      if (!slug || !allowed.has(dimSlug)) return;
      const dim = dimensions.find((d) => d.slug === dimSlug);
      if (!dim) return;

      const option = dim.options.find((o) => o.slug === slug);
      if (option?.isActive) return;

      const key = `${dimSlug}:${slug}`;
      if (missing.has(key)) return;

      missing.set(key, {
        dimensionSlug: dimSlug,
        dimensionName: dim.name,
        slug,
        suggestedLabel: option?.label ?? labelFromSlug(slug),
      });
    };

    for (const input of inputs) {
      noteMissing("category", input.category);
      noteMissing("audience_level", input.audienceLevel);
      noteMissing("duration", input.duration);
      for (const tag of input.tags ?? []) {
        noteMissing("tags", tag);
      }
    }

    return Array.from(missing.values()).sort((a, b) => {
      const dim = a.dimensionName.localeCompare(b.dimensionName);
      if (dim !== 0) return dim;
      return a.suggestedLabel.localeCompare(b.suggestedLabel);
    });
  }

  async ensureAutoImportTags(inputs: RoleplayClassificationInput[]): Promise<number> {
    const missingTags = await this.findMissingImportOptions(inputs, IMPORT_AUTO_DIMENSIONS);
    if (!missingTags.length) return 0;
    return this.ensureImportOptions(missingTags);
  }

  async ensurePromptImportOptions(inputs: RoleplayClassificationInput[]): Promise<number> {
    const missing = await this.findMissingImportOptions(inputs, IMPORT_PROMPT_DIMENSIONS);
    if (!missing.length) return 0;
    return this.ensureImportOptions(missing);
  }

  async ensureImportOptions(options: MissingImportClassificationOption[]): Promise<number> {
    let created = 0;

    for (const option of options) {
      const [dimension] = await db
        .select()
        .from(classificationDimensions)
        .where(eq(classificationDimensions.slug, option.dimensionSlug))
        .limit(1);
      if (!dimension) continue;

      const [existing] = await db
        .select()
        .from(classificationOptions)
        .where(
          and(
            eq(classificationOptions.dimensionId, dimension.id),
            eq(classificationOptions.slug, option.slug),
          ),
        )
        .limit(1);

      if (existing) {
        if (!existing.isActive) {
          await this.updateOption(existing.id, { isActive: true });
        }
        continue;
      }

      await this.createOption({
        dimensionSlug: option.dimensionSlug,
        slug: option.slug,
        label: option.suggestedLabel,
      });
      created += 1;
    }

    return created;
  }

  async createOption(params: {
    dimensionSlug: string;
    label: string;
    slug?: string;
    color?: string;
    icon?: string;
  }) {
    const [dimension] = await db
      .select()
      .from(classificationDimensions)
      .where(eq(classificationDimensions.slug, params.dimensionSlug))
      .limit(1);
    if (!dimension) {
      throw new Error(`Unknown dimension "${params.dimensionSlug}"`);
    }

    const slug = params.slug?.trim() || slugifyLabel(params.label);
    if (!slug) {
      throw new Error("Option slug is required");
    }

    const dimDefault = DIMENSION_DISPLAY_DEFAULTS[params.dimensionSlug] ?? FALLBACK_OPTION_DISPLAY;
    const display = assertValidOptionDisplay({
      color: params.color ?? dimDefault.color,
      icon: params.icon ?? dimDefault.icon,
    });

    const [existing] = await db
      .select()
      .from(classificationOptions)
      .where(
        and(
          eq(classificationOptions.dimensionId, dimension.id),
          eq(classificationOptions.slug, slug),
        ),
      )
      .limit(1);
    if (existing) {
      throw new Error(`Option slug "${slug}" already exists in ${params.dimensionSlug}`);
    }

    const [maxOrder] = await db
      .select({ max: sql<number>`coalesce(max(${classificationOptions.sortOrder}), -1)` })
      .from(classificationOptions)
      .where(eq(classificationOptions.dimensionId, dimension.id));

    const [created] = await db
      .insert(classificationOptions)
      .values({
        dimensionId: dimension.id,
        slug,
        label: params.label.trim(),
        sortOrder: Number(maxOrder?.max ?? -1) + 1,
        isActive: true,
        color: display.color,
        icon: display.icon,
      })
      .returning();

    return created;
  }

  async updateOption(
    optionId: number,
    updates: { label?: string; isActive?: boolean; color?: string; icon?: string },
  ) {
    const [existing] = await db
      .select()
      .from(classificationOptions)
      .where(eq(classificationOptions.id, optionId))
      .limit(1);
    if (!existing) {
      throw new Error("Option not found");
    }

    const patch: Partial<typeof existing> = {};
    if (updates.label !== undefined) {
      const label = updates.label.trim();
      if (!label) throw new Error("Label is required");
      patch.label = label;
    }
    if (updates.isActive !== undefined) {
      patch.isActive = updates.isActive;
    }
    if (updates.color !== undefined || updates.icon !== undefined) {
      const display = assertValidOptionDisplay({
        color: updates.color ?? existing.color,
        icon: updates.icon ?? existing.icon,
      });
      patch.color = display.color;
      patch.icon = display.icon;
    }

    const [updated] = await db
      .update(classificationOptions)
      .set(patch)
      .where(eq(classificationOptions.id, optionId))
      .returning();

    return updated;
  }

  async reorderOption(optionId: number, direction: "up" | "down") {
    const [option] = await db
      .select()
      .from(classificationOptions)
      .where(eq(classificationOptions.id, optionId))
      .limit(1);
    if (!option) throw new Error("Option not found");

    const siblings = await db
      .select()
      .from(classificationOptions)
      .where(eq(classificationOptions.dimensionId, option.dimensionId))
      .orderBy(asc(classificationOptions.sortOrder), asc(classificationOptions.label));

    const index = siblings.findIndex((s) => s.id === optionId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= siblings.length) {
      return option;
    }

    const other = siblings[swapIndex];
    await db.transaction(async (tx) => {
      await tx
        .update(classificationOptions)
        .set({ sortOrder: other.sortOrder })
        .where(eq(classificationOptions.id, option.id));
      await tx
        .update(classificationOptions)
        .set({ sortOrder: option.sortOrder })
        .where(eq(classificationOptions.id, other.id));
    });

    const [updated] = await db
      .select()
      .from(classificationOptions)
      .where(eq(classificationOptions.id, optionId))
      .limit(1);
    return updated!;
  }

  async reorderOptions(dimensionSlug: string, orderedOptionIds: number[]) {
    const [dimension] = await db
      .select()
      .from(classificationDimensions)
      .where(eq(classificationDimensions.slug, dimensionSlug))
      .limit(1);
    if (!dimension) {
      throw new Error(`Unknown dimension "${dimensionSlug}"`);
    }

    const siblings = await db
      .select({ id: classificationOptions.id })
      .from(classificationOptions)
      .where(eq(classificationOptions.dimensionId, dimension.id))
      .orderBy(asc(classificationOptions.sortOrder), asc(classificationOptions.label));

    const siblingIds = siblings.map((s) => s.id);
    if (orderedOptionIds.length !== siblingIds.length) {
      throw new Error("Reorder must include every option in the dimension");
    }

    const seen = new Set<number>();
    for (const id of orderedOptionIds) {
      if (!siblingIds.includes(id)) {
        throw new Error(`Option ${id} does not belong to dimension "${dimensionSlug}"`);
      }
      if (seen.has(id)) {
        throw new Error("Duplicate option id in reorder payload");
      }
      seen.add(id);
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedOptionIds.length; i++) {
        await tx
          .update(classificationOptions)
          .set({ sortOrder: i })
          .where(eq(classificationOptions.id, orderedOptionIds[i]));
      }
    });
  }

  async deleteOption(optionId: number) {
    const [usage] = await db
      .select({ count: count() })
      .from(roleplayClassificationLinks)
      .where(eq(roleplayClassificationLinks.optionId, optionId));
    if (Number(usage?.count ?? 0) > 0) {
      throw new Error("Cannot delete an option that is in use by scenarios");
    }

    await db.delete(classificationOptions).where(eq(classificationOptions.id, optionId));
  }

  async getOptionUsageCount(optionId: number): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(roleplayClassificationLinks)
      .where(eq(roleplayClassificationLinks.optionId, optionId));
    return Number(row?.count ?? 0);
  }
}

export const classificationService = new ClassificationService();
