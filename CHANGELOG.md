# SAPUDOM Structure Analysis — V1.26.1 Fix

## Fixed
- Deformed Shape legend now shows **Max displacement (mm)** and its location.
- Maximum displacement now checks the interior of each frame member using cubic Hermite interpolation, instead of relying only on nodal translations.
- This fixes simply-supported beam cases where support Uy = 0 but the beam deflects between supports.

## Preserved
- V1.26 Section Orientation / Rotate Section 90°.
- V1.25.2 RC Beam Design Phase 1 and V1.24 Steel Design.
- JSON / Cloud / Load Manager / combinations.
