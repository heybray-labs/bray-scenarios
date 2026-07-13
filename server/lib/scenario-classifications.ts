import {
  classificationService,
  type ContentClassifications,
  type ContentClassificationInput,
  type ClassificationOptionRef,
  type RoleplayClassifications,
  type RoleplayClassificationInput,
  type MissingImportClassificationOption,
} from "@heybray/taxonomy";
import { db } from "../db.ts";

/**
 * App-side adapter mapping the generic, dimension-driven taxonomy service onto
 * the roleplay-shaped `{ category, audienceLevel, duration, tags }` payload the
 * client and controllers use. This is where the app's knowledge of its own
 * dimension set lives — the taxonomy package itself is dimension-agnostic.
 */

export const SCENARIO_CONTENT_TYPE = "scenario";

/** Roleplay field ↔ classification dimension slug. */
const CATEGORY = "category";
const AUDIENCE_LEVEL = "audience_level";
const DURATION = "duration";
const TAGS = "tags";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function asRef(value: ContentClassifications[string] | undefined): ClassificationOptionRef | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asRefs(value: ContentClassifications[string] | undefined): ClassificationOptionRef[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toRoleplayClassifications(generic: ContentClassifications): RoleplayClassifications {
  return {
    category: asRef(generic[CATEGORY]),
    audienceLevel: asRef(generic[AUDIENCE_LEVEL]),
    duration: asRef(generic[DURATION]),
    tags: asRefs(generic[TAGS]),
  };
}

function toContentInput(input: RoleplayClassificationInput): ContentClassificationInput {
  return {
    [CATEGORY]: input.category ?? null,
    [AUDIENCE_LEVEL]: input.audienceLevel ?? null,
    [DURATION]: input.duration ?? null,
    [TAGS]: input.tags ?? [],
  };
}

function fromContentInput(input: ContentClassificationInput): RoleplayClassificationInput {
  const single = (value: ContentClassificationInput[string]): string | null =>
    Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  const many = (value: ContentClassificationInput[string]): string[] =>
    Array.isArray(value) ? value : value ? [value] : [];
  return {
    category: single(input[CATEGORY]),
    audienceLevel: single(input[AUDIENCE_LEVEL]),
    duration: single(input[DURATION]),
    tags: many(input[TAGS]),
  };
}

export async function getRoleplayClassifications(
  roleplayId: number,
): Promise<RoleplayClassifications> {
  const generic = await classificationService.getContentClassification(
    SCENARIO_CONTENT_TYPE,
    roleplayId,
  );
  return toRoleplayClassifications(generic);
}

export async function getClassificationsForRoleplays(
  roleplayIds: number[],
): Promise<Map<number, RoleplayClassifications>> {
  const generic = await classificationService.getContentClassifications(
    SCENARIO_CONTENT_TYPE,
    roleplayIds,
  );
  const result = new Map<number, RoleplayClassifications>();
  for (const id of roleplayIds) {
    result.set(id, toRoleplayClassifications(generic.get(id) ?? {}));
  }
  return result;
}

export async function setRoleplayClassifications(
  roleplayId: number,
  input: RoleplayClassificationInput,
  tx?: DbTx,
): Promise<void> {
  await classificationService.setContentClassifications(
    SCENARIO_CONTENT_TYPE,
    roleplayId,
    toContentInput(input),
    tx,
  );
}

export async function resolveImportClassifications(
  input: RoleplayClassificationInput,
): Promise<RoleplayClassificationInput> {
  const resolved = await classificationService.resolveImportClassifications(toContentInput(input));
  return fromContentInput(resolved);
}

export async function findMissingImportOptions(
  inputs: RoleplayClassificationInput[],
  dimensionSlugs?: readonly string[],
): Promise<MissingImportClassificationOption[]> {
  return classificationService.findMissingImportOptions(
    inputs.map(toContentInput),
    dimensionSlugs,
  );
}

export async function ensureAutoImportTags(
  inputs: RoleplayClassificationInput[],
): Promise<number> {
  return classificationService.ensureAutoImportTags(inputs.map(toContentInput));
}

export async function ensurePromptImportOptions(
  inputs: RoleplayClassificationInput[],
): Promise<number> {
  return classificationService.ensurePromptImportOptions(inputs.map(toContentInput));
}
