# CHANGELOG

## V1.16 Fix
- Fixed Self Weight Generator reporting all members as missing section weight when legacy member records did not carry a `weight` field.
- Load Center now resolves section weight from the current Section Database by ID or name, with A/I compatibility matching for older JSON projects.
- Added safe fallback weight derivation from member area and material type for legacy projects.
- Preserved manual loads, JSON/Cloud compatibility, Result Envelope, Check Model, Building Center, and solver behavior.

# CHANGELOG

## V1.16
- Added Result Envelope engine.
- Added automatic analysis of all Load Combinations for envelope generation.
- Added member N/V/M minimum and maximum envelopes.
- Added governing Critical Combination labels.
- Added global maximum displacement envelope.
- Added envelope CSV export.
- Added click-to-highlight member from envelope table.
- Preserved V1.15.1 modeling, validation, loads, JSON, Cloud and solver behavior.
