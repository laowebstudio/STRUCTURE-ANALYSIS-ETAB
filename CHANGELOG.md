# SAPUDOM Structure Analysis — V1.26.3 Fix

## Member-specific Result Min/Max
- Axial N, Shear V and Moment M legends now show Min/Max for the single selected Member.
- Clicking M1, M2, etc. updates the diagram legend scope immediately.
- With no single Member selected, diagrams continue to show Whole Model Min/Max.
- Diagram scaling remains based on the whole model to avoid misleading visual scale jumps between selections.
- V1.26.2 member-specific Deformed Max Displacement is preserved.
- Section Orientation 0°/90°, RC Beam Design, Steel Design, JSON/Cloud and existing analysis features are preserved.

# SAPUDOM Structure Analysis — V1.26.3 Fix

## Fixed
- Deformed Shape Max displacement / Location is now Member-specific when exactly one Member is selected.
- The legend refreshes immediately when Member selection changes.
- Whole-model maximum remains available when no single Member is selected.

## Preserved
- Section Orientation / Rotate Section 90°
- V1.26.1 member-interior displacement interpolation
- V1.25.2 RC Beam demand + JSON load visualization fixes
- Steel / Beam-Column Design V1.24 behavior

# SAPUDOM Structure Analysis — V1.26.3 Fix

## Fixed
- Deformed Shape legend now shows **Max displacement (mm)** and its location.
- Maximum displacement now checks the interior of each frame member using cubic Hermite interpolation, instead of relying only on nodal translations.
- This fixes simply-supported beam cases where support Uy = 0 but the beam deflects between supports.

## Preserved
- V1.26 Section Orientation / Rotate Section 90°.
- V1.25.2 RC Beam Design Phase 1 and V1.24 Steel Design.
- JSON / Cloud / Load Manager / combinations.

## V1.27 — 3D Frame Phase 1
- Added isolated 3D Frame Center without changing the verified 2D solver.
- 3D Nodes use X/Y/Z coordinates and 6 DOF per node (Ux, Uy, Uz, Rx, Ry, Rz).
- Added 3D member connectivity, member length, support/restraint assignment and Fx/Fy/Fz/Mx/My/Mz nodal load data.
- Added interactive 3D viewport (orbit, zoom, fit), sample 3D frame and model validation.
- 3D model is included in JSON Save/Open persistence.
- Full 12x12 3D space-frame stiffness solver and 3D result diagrams are intentionally reserved for Phase 2.

## V1.27.1 Fix — 3D UI Layout
- UI/CSS-only regression-safe fix based on V1.27 Phase 1.
- Top toolbar actions redistributed so the + New button and neighboring actions are not clipped.
- 3D Frame Center widened and rebalanced for desktop screens.
- 6-DOF restraint controls (Ux/Uy/Uz/Rx/Ry/Rz) now use stable 3-column cards and no longer clip or drift.
- Node/member/load inputs receive consistent spacing and readable widths.
- 3D viewport/control proportions improved with responsive breakpoints.
- Verified 2D calculation engine from V1.26.3 Fix intentionally untouched.
