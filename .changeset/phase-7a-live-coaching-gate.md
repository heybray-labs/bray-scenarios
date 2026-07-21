---
"@heybray/scenarios-server": patch
"@heybray/scenarios-client": patch
---

Gate live coaching settings writes behind `scenarios.coaching.live` (inert under OSS allow-all) and wrap the builder toggle in `FeatureGate`; pass optional `contentType` on star-map attempt drill-in paths.
