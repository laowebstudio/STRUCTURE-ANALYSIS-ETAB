# V1.28.1 Fix — 3D Workspace Auto Refresh

## Fixed
- Main integrated 3D viewport no longer requires switching 3D → 2D → 3D after editing model data.
- Added a live refresh bridge from the 3D Model Data editor to the main 3D workspace.
- `Load 3D Sample`, `Add Node`, `Add Member`, and `Apply Node Data` now redraw the integrated viewport immediately.
- Closing 3D Model Data performs a final redraw and Fit.

## Preserved
- V1.28 integrated 3D workspace and Phase 2 solver.
- V1.27.1 3D model-data workflow.
- Verified 2D engine, Deformed/Axial/Shear/Moment, RC Design, Steel Design, JSON/Cloud logic.
