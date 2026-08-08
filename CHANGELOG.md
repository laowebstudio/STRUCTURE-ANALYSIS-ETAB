## V1.20.1 Fix — Design Material Persistence
- Fixed Design Material reverting to Steel after Assign.
- Design Center now reloads stored properties from the selected Member(s).
- Added visible assignment confirmation for selected Members.
- Preserves V1.19 analysis solver and V1.20 Design Foundation behavior.

## V1.19 — Analysis Verification & Validation
- Added Verification Center with three classic closed-form solver benchmarks.
- Added current-model global equilibrium and residual diagnostics.
- Benchmarks: axial bar, cantilever tip load, simply-supported UDL beam.
- Preserves V1.18.2 Load Assignment & Management, JSON/Cloud persistence, Self Weight and Result Envelope.

## V1.19
- Fix JSON round-trip persistence for Load Manager MANUAL member loads.
- Preserve case/type/direction/magnitude/position/source fields.
- Add saved/restored member-load count verification.

# V1.19

- Fixed Load Assignment Manager **Locate** action.
- Locate now closes the manager, highlights the requested object, and pans/zooms the canvas to it.
- Supports both Node and Member rows.
- Solver and load calculation logic unchanged.

# V1.18
- Added Load Assignment Manager with filters, locate/delete, multi-member UDL/Point/Moment assignment, copy-to-selected, select-loaded-members, clear-by-filter, and load summary.
- Preserves V1.17.1 solver, diagram accuracy, JSON/Cloud, self weight and envelope behavior.

# V1.17.1 Fix

- Automatically hides Load labels in Axial N, Shear V and Moment M result views to prevent overlap.
- Restores the user's Load labels preference when returning to Model view.
- Keeps load arrows visible so load direction remains visually traceable.

# V1.17.1 Fix

- Load Visualization direction fix for GLOBAL_X, GLOBAL_Y and LOCAL_Y.
- Self Weight arrows on vertical columns now display in Global Y.
- Added Load labels visibility toggle.
- Accurate sampled N/V/M diagrams along members.
- Curved parabolic Moment diagram under UDL and linear Shear diagram under UDL.
- Point-load shear jumps and applied-moment diagram jumps.
- Result Envelope now checks internal member extrema.
- Preserves V1.16.1 Fix Cloud/JSON generated-load snapshot behavior.

# CHANGELOG

## V1.17.1 Fix
- Cloud Save/Load now uses the same full project snapshot schema as JSON Save/Load.
- Saving to Cloud replaces the latest project with the same name instead of creating confusing stale duplicates.
- Cloud project list now shows updated time, Member count, and stored Self Weight count.
- Cloud Open verifies generated-load counts after restore and warns if data changed.
- Preserves generated Self Weight, manual loads, Load Cases, Load Combinations, Materials, Sections, Releases/Hinges, Building data, layers, and view state.
- Keeps the V1.17.1 Fix Fix section-weight compatibility repair: legacy members can resolve section weight from Section Database ID/name or A/I matching, with material-based fallback.
- Result Envelope, Check Model, Building Center, Modeling Tools, JSON, CSV, and solver behavior are preserved.

## V1.17.1 Fix
- Added Result Envelope engine.
- Added automatic analysis of all Load Combinations for envelope generation.
- Added member N/V/M minimum and maximum envelopes.
- Added governing Critical Combination labels.
- Added global maximum displacement envelope.
- Added envelope CSV export.
- Added click-to-highlight member from envelope table.

## V1.20 — Design Foundation
- Added Design Center.
- Added AISC/ACI design setup and design method selectors.
- Added Beam/Column/Brace/Other member design classification.
- Added Steel/Concrete design properties and multi-member assignment.
- Added design demand/result interface sourced from analysis results.
- Added JSON/Cloud persistence for design setup and member design properties.
- Added Design Setup CSV export.
- V1.19 solver and verification logic preserved.
