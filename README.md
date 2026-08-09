# SAPUDOM Structure Analysis V1.26.3 Fix

Hotfix for V1.26 Deformed Shape reporting. The Deformed legend now reports maximum member-interior displacement and location, enabling direct 0° vs 90° section-orientation verification.


## V1.26.3 Fix — Member-specific Max Displacement
- Deformed Shape legend now reports Max displacement and Location for the single selected Member.
- Selecting M1 and M2 no longer repeats the whole-model maximum.
- With no single Member selected, the legend continues to show the whole-model maximum.
- Section Orientation 0°/90°, RC Beam Design, Steel Design, JSON/Cloud behavior are preserved.

### V1.27.1 Fix
This release changes only the top-toolbar and 3D Frame Center presentation/layout. The verified V1.26.3 2D calculation behavior is not modified.
