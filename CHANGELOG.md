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
