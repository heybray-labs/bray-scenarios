/**
 * Re-export shim. The roleplay domain schema moved into
 * @heybray/scenarios-server during the Phase 6A extraction. This thin
 * re-export keeps the historical `@shared`/`shared/` path resolvable for the
 * server test suite and the drizzle-kit schema glob, with identical table
 * identity (same objects, re-exported).
 */
export * from "@heybray/scenarios-server/schema/roleplay-core";
