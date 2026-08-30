# V1.46.1 — Whole Model Solve / Selected Member Display Fix

- Locked 3D solver semantics to Whole Model analysis.
- Converted Selected Member to a pure visualization filter.
- Preserved Whole Model diagram scaling while a member is selected.
- Added explicit Analysis Source / Display Filter information to result legend.
- Updated viewer status text so member selection cannot be mistaken for member-only analysis.

# Changelog

## V1.45.2 — Rebar Viewer Live Solver Results Fix
- Fixed stale RC/Rebar Viewer demand after Advanced Member Loads.
- RC design envelope now includes a fresh direct solve of the active 3D Load Pattern in addition to governing load combinations.
- Opening 3D RC Rebar Viewer automatically rebuilds the selected member design from the live solver path.
- Updated synchronization/version feedback in RC Design and Rebar Viewer.
