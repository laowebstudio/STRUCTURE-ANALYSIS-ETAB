# V1.47.2.2 — Full Model Regeneration + Analysis Result Reset Integrity Fix

- Added complete 3D model + analysis result reset on replacement regeneration.
- Clears stale Story/Reaction/Member/Slab result state and derived load-case/combination/envelope caches.
- Resets Node/Member IDs to 1 for a replacement model.
- Added pre-solve geometry integrity validation.
- Integrated 3D Results UI now disables stale results immediately after geometry changes.
- Preserves V1.47.2.1 Easy Slab Input and V1.47.2 Q4 shell/plate FEM behavior.

## V1.47.2 — Slab Shell/Plate Analysis Engine
- Added solver-linked Q4 shell/plate slab stiffness.
- Added membrane + Mindlin bending/shear formulation.
- Added direct slab area loading and optional slab self-weight.
- Removed legacy tributary slab UDLs from analysis to avoid double loading.
- Added slab w / M11 / M22 / M12 / V13 / V23 results.
- Added simplified slab input fields to 3D Building Generator.
- Preserved V1.47.1.3 WebGL physical model and accurate member picking.
- RC Design remains frozen.

## V1.47.1.3 — Accurate WebGL Member Picking + Selection Mapping Fix

- Fixed wrong-member selection in WebGL Physical Model.
- Replaced projected 2D nearest-member hit test with true 3D camera-ray picking.
- Added oriented solid member intersection using the same geometry dimensions and beam offset as the renderer.
- Selects the nearest visible intersection when several members overlap in the viewport.
- Selection maps directly to the original model Member ID and Whole Model result display filter.
- Picking remains correct after orbit, pitch, zoom, Fit, resize and fullscreen because camera matrices are rebuilt from current view state.
- Protected Analysis Model selection path and Whole Model solver.

## V1.47.1.2 — WebGL True Solid Physical Model Engine

- True WebGL physical renderer with depth buffering and perspective camera.
- Solid Beam, Column, Slab and Footing geometry generated from the same structural model data.
- Concrete face lighting, edge lines and ground grid.
- Analysis renderer and solver remain protected; RC Beam stays frozen.

# V1.47.1.1 — Realistic Physical Building Geometry & Rendering

- Upgraded physical member renderer to projected solid prisms.
- Improved concrete face shading, slab/footing depth cues and viewport rendering.

# V1.47.1 — True Physical Building Model

True physical 3D rendering layer linked to the existing whole-building analysis model. RC Design remains frozen and slab shell FEM is intentionally deferred.

# Changelog

## V1.47 — Full Building Structural Model & Analysis
- Froze RC Beam Detailing development at V1.46.1.2.
- Upgraded 3D Building Generator to create Beam, Column, Slab and Foundation physical objects.
- Added slab panel DL/LL inputs and automatic solver-linked tributary load transfer.
- Added physical slab and isolated-footing rendering to the main 3D workspace.
- Added Slab Load Path result tab with transferred load totals and panel schedule.
- Added Foundation result tab mapping Whole Building support reactions to each footing.
- Preserved Whole Model solve guarantee: display member selection never changes analysis assembly.
- Preserved Load Cases, Load Combinations, Envelope, Story Response, Story Forces and Diaphragm workflows.
- Updated browser cache token and UI version labels to V1.47.

### Explicit limitation
Slabs are tributary load-transfer panels in V1.47, not shell/plate bending finite elements. Footings are physical demand objects, not soil-foundation FE elements.

## V1.47.2.1 — Easy Slab Input + Validation Fix
- Changed slab DL/LL entry to positive downward magnitudes.
- Solver applies slab gravity loads internally in Global -Z.
- Added live self-weight / Total DL / LL preview.
- Added slab thickness, material, Poisson ratio, unit-weight, and load validation.
- Story-height list now auto-synchronizes with Number of stories.
- Kept V1.47.2 Q4 shell/plate FEM and whole-building solver architecture.
