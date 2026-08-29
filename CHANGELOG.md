# V1.42 — 3D RC Rebar Visualization Foundation
- Added calculation-linked interactive 3D RC beam rebar viewer.
- Main bars, layer arrangement, stirrups, cover envelope and 90° hooks are driven by current RC Beam Design results.
- Added viewer launch buttons in Design Details and Construction Drawing.
- Read-only visualization protects V1.41.6.2 design calculations and existing analysis engines.

## V1.41.5.1 — Drawing Readability + Automatic Lap Class Verification
- Redesigned Final RC Beam Drawing for construction readability: larger elevation/sections, layer callouts, anchorage dimensions, compact bar/detail schedule, and simplified title block.
- Added Bars Spliced (%) input and automatic Class A eligibility check. Requested Class A is automatically downgraded to Class B unless As(provided)/As(required) >= 2.0 and bars spliced <= 50%.
- Calculation trace remains in RC Beam Design Details instead of crowding the drawing sheet.

# V1.35.1 Fix.1 Fix — Diaphragm Apply Feedback
- Added story-based rigid diaphragm constraints for 3D analysis.
- Uses transformation method for Ux/Uy/Rz rigid-floor kinematics.
- Diaphragm OFF by default for V1.34 regression compatibility.

# SAPUDOM Structure Analysis V1.32

## Added — 3D Global Equilibrium & Analysis Summary
- Added six-component global equilibrium verification: Fx, Fy, Fz, Mx, My, Mz.
- Added Applied / Reaction / Residual table in 3D Analysis Results → Summary.
- Added overall PASS/WARNING and per-component PASS/CHECK badges.
- Global moment check includes direct nodal moments and r × F about global origin.
- Active load pattern shown in the verification panel.

## Protected
- No changes to verified 2D solver/workspace.
- No change to V1.31.1 3D stiffness solution equations.
- No change to true 3D M2/M3 UDL curve renderer except version labeling.

## V1.39.1 Fix.1 Fix — Load Case Result Switching
- Connected active 3D load pattern explicitly to the solver input path.
- Added load audit and persisted nodal-load compatibility.
- Added NO LOAD status to prevent zero-load equilibrium from appearing as a meaningful PASS.

## V1.41.5 — Development / Anchorage / Lap Splice Verification
- Added ACI 318-25-style straight tension development length calculation.
- Added casting, coating, concrete density, Ktr, i/j anchorage and optional lap splice inputs.
- Added Class A/B lap splice verification and development trace in Details.
- Added Dev/Splice status to the main beam table and professional drawing.
- Overall beam PASS now also requires development/anchorage/lap verification to pass.


## V1.41.6.1 Fix
- Fixed RC beam section drawing overflow for high layer counts by scaling bar coordinates from actual section geometry.
- Added explicit full-depth cage verification and exposed required/available vertical depth in detailing data.
- Genuine cage-depth overflow now returns `VERTICAL FIT FAIL` and blocks `DESIGN VERIFIED`.
