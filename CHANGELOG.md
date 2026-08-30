# V1.46.1.1 — RC Beam Station-Based Auto Design + Economical Reinforcement Zoning

- Added full-member station force recovery from the current Whole Model solution path.
- Added station envelopes for P/N, V2, V3, T, M2 and M3 across load combinations, load cases and the active load pattern.
- RC beam flexural demand now reads station envelopes instead of relying only on member end-force envelopes.
- Added positive-moment bottom-bar zoning and negative-moment top-bar zoning.
- Added station-based stirrup zoning and removed the automatic `Midspan Vu = 25% of end shear` assumption.
- Added station-by-station shear verification against the local provided stirrup zone.
- Added independent top-flexure verification.
- Added development-length extension to extra-bar cut-off zones.
- Added configurable station count and Economical Zoning controls in RC Beam Design.
- Added governing-station, reinforcement-zone and indicative steel-saving trace to RC Beam Design Details.
- Updated browser cache version to `app.js?v=1.46.1.1`.

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
