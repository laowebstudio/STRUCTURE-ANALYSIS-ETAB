# SAPUDOM Structure Analysis V1.28.1 Fix

## 3D Workspace Auto Refresh

Built from V1.28. This fix keeps the verified 2D engine unchanged and fixes synchronization between **3D Model Data** and the integrated 3D workspace.

- Load 3D Sample refreshes the main 3D workspace immediately.
- Add 3D Node refreshes and fits the main 3D workspace immediately.
- Add 3D Member refreshes and fits the main 3D workspace immediately.
- Apply Node Data refreshes the main 3D workspace.
- Closing the 3D Model Data window triggers a final redraw + fit.
- No 2D solver/design logic changes.
- Existing V1.28 Phase 2 3D solver remains intact.


## V1.28.2 Fix — 3D Node State + Load Visualization
- Preserves the selected 3D Node after Apply Node Data and 3D UI refresh.
- Draws nodal load arrows/labels in both 3D Model Data and the integrated 3D Workspace.
- Keeps the V1.28.1 auto-refresh bridge.
- 2D calculation engine and 3D solver calculation logic are unchanged.
