# SAPUDOM Structure Analysis V1.25.2 Fix

RC Beam Design Phase 1 based on V1.25.1 Fix, with JSON/Cloud load-visualization synchronization repaired.

## V1.25.2 Fix
When a saved project is opened, the program now re-synchronizes the active load case, Node Load mirrors, canvas Loads layer and load-label visibility. This fixes the case where Load Manager showed restored member loads but the model canvas showed no load arrows.

## Preserved
- V1.25.1 internal RC beam moment-demand transfer
- V1.24 Steel Column / Beam-Column Design
- Load Cases / Combinations
- JSON / Cloud persistence
- Analysis diagrams and Load Manager

## Quick regression test
1. Create or open a model containing a Member Load and/or Node Load.
2. Save JSON.
3. Create a new project or refresh.
4. Open the JSON.
5. Confirm load arrows are immediately visible in Model View.
6. Confirm Load Manager shows the same loads.
7. Analyze and confirm forces/reactions match the pre-save result.
