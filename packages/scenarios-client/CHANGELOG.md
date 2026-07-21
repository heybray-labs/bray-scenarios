# @heybray/scenarios-client

## 0.1.5

### Patch Changes

- f7b48cd: Gate live coaching settings writes behind `scenarios.coaching.live` (inert under OSS allow-all) and wrap the builder toggle in `FeatureGate`; pass optional `contentType` on star-map attempt drill-in paths.

## 0.1.4

### Patch Changes

- eb617dc: Enforce publish eligibility against the admin model allowlist; seed demo AI allowlist defaults; fix card publish/unpublish UX and browse cache updates; add API coverage for configured-but-unallowlisted drafts.

## 0.1.3

### Patch Changes

- Block publishing scenarios without persona and grader AI configured; surface publish failures via client error toasts.

## 0.1.2

### Patch Changes

- 6c712fc: Export `PackageLayoutProvider` so composed shells can disable in-package AppLayout and supply outer chrome.

## 0.1.0

### Minor Changes

- Initial publish of mountable Scenarios feature packages (Phase 6A Step 3).
