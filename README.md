# SAPUDOM Structure Analysis V1.29.1 Fix

## 3D Diagram Readability + Member Local Axes

Built directly from V1.29. The 2D calculation engine and V1.29 3D solver are kept unchanged.

New UI behavior:
- Diagram scope: Selected Member / Whole Model
- Click a member directly in the 3D viewport to select it and show only that member's diagram
- Results-table member locate automatically switches to Selected Member diagram mode
- Optional Local 1-2-3 axes display for members
- Selected-member Min/Max legend
- Keeps Diagram Scale, Values, Fullscreen, Results Viewer, node/member locate, and 2D↔3D workflow

M2 and M3 remain separate because a 3D frame member bends about its two local transverse axes (local 2 and local 3). T is torsion about local 1.
