import { describe, it, expect } from "vitest";
import { getTableColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "../db.ts";
import {
  rewardTiers,
  userContentTierAwards,
  activityLog,
  gamificationContent,
  pointTransactions,
} from "@heybray/gamification/schema";
import { contentClassificationLinks } from "@heybray/taxonomy/schema";

/**
 * Fix 3b (docs/phase-2-remediation.md): the repo's drizzle snapshot chain only
 * covers migration 0000, so `drizzle-kit generate` was never a valid "no diff"
 * gate here. This test replaces it: it compares each canonical drizzle table
 * definition against the physically-migrated columns in the test DB.
 */

type ColumnShape = { type: string; nullable: boolean };

/** Collapse drizzle/pg type spellings to a comparable base type. */
function canonicalType(raw: string): string {
  const t = raw.toLowerCase();
  if (/^(serial|bigserial|smallserial)/.test(t)) return "integer";
  if (/^(integer|int4|int8|int2|int|bigint|smallint)/.test(t)) return "integer";
  if (/^(numeric|decimal)/.test(t)) return "numeric";
  if (/^timestamp/.test(t)) return "timestamp";
  if (/^bool/.test(t)) return "boolean";
  if (/^(text|varchar|char|character)/.test(t)) return "text";
  if (/^json/.test(t)) return "json";
  return t;
}

function drizzleColumns(table: PgTable): Map<string, ColumnShape> {
  const cols = getTableColumns(table);
  const map = new Map<string, ColumnShape>();
  for (const key of Object.keys(cols)) {
    const col = cols[key as keyof typeof cols];
    map.set(col.name, {
      type: canonicalType(col.getSQLType()),
      nullable: !col.notNull,
    });
  }
  return map;
}

async function physicalColumns(tableName: string): Promise<Map<string, ColumnShape>> {
  const result = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `);
  const rows = result.rows as Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>;
  const map = new Map<string, ColumnShape>();
  for (const row of rows) {
    map.set(row.column_name, {
      type: canonicalType(row.data_type),
      nullable: row.is_nullable === "YES",
    });
  }
  return map;
}

async function assertExactParity(tableName: string, table: PgTable): Promise<void> {
  const drizzle = drizzleColumns(table);
  const physical = await physicalColumns(tableName);

  expect(physical.size).toBeGreaterThan(0);
  expect([...physical.keys()].sort()).toEqual([...drizzle.keys()].sort());

  for (const [column, shape] of drizzle) {
    expect(physical.get(column), `${tableName}.${column}`).toEqual(shape);
  }
}

describe("schema parity (drizzle defs vs migrated DB)", () => {
  const exactTables: Array<[string, PgTable]> = [
    ["reward_tiers", rewardTiers],
    ["user_content_tier_awards", userContentTierAwards],
    ["activity_log", activityLog],
    ["gamification_content", gamificationContent],
    ["content_classification_links", contentClassificationLinks],
    ["point_transactions", pointTransactions],
  ];

  for (const [tableName, table] of exactTables) {
    it(`${tableName} columns exactly match the drizzle definition`, async () => {
      await assertExactParity(tableName, table);
    });
  }
});
