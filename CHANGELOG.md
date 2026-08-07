# CHANGELOG

## V1.16.1 Fix
- Cloud Save/Load now uses the same full project snapshot schema as JSON Save/Load.
- Saving to Cloud replaces the latest project with the same name instead of creating confusing stale duplicates.
- Cloud project list now shows updated time, Member count, and stored Self Weight count.
- Cloud Open verifies generated-load counts after restore and warns if data changed.
- Preserves generated Self Weight, manual loads, Load Cases, Load Combinations, Materials, Sections, Releases/Hinges, Building data, layers, and view state.
- Keeps the V1.16 Fix section-weight compatibility repair: legacy members can resolve section weight from Section Database ID/name or A/I matching, with material-based fallback.
- Result Envelope, Check Model, Building Center, Modeling Tools, JSON, CSV, and solver behavior are preserved.

## V1.16
- Added Result Envelope engine.
- Added automatic analysis of all Load Combinations for envelope generation.
- Added member N/V/M minimum and maximum envelopes.
- Added governing Critical Combination labels.
- Added global maximum displacement envelope.
- Added envelope CSV export.
- Added click-to-highlight member from envelope table.
