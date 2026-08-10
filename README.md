# SAPUDOM Structure Analysis V1.31 — 3D Building Load System

Built directly from V1.30.2 Fix Stable. The verified 2D workspace and 2D analysis/design engines are not modified.

## V1.31
- Independent **3D Loads** center in the 3D workspace.
- Load Patterns: DL, LL, RL, WX, WY plus user-created custom patterns.
- Story filter: All Stories or individual story/roof.
- Beam filters: All Beams, Beam-X, Beam-Y.
- Uniform distributed load (UDL) assignment in Global X/Y/Z.
- Load visualization directly on the 3D model.
- Load Summary with assigned member count and Σ(wL).
- Active 3D Load Pattern selector in the workspace.
- Analyze 3D solves the active pattern using solver-consistent equivalent nodal loading and includes fixed-end effects in member end forces.
- JSON persistence uses the existing model3d snapshot path.

## Protected systems
- 2D workspace / 2D solver
- RC Beam Design
- Steel Design
- Existing V1.30.2 Building Generator / Base Support / Validation
- Existing 3D diagrams, fullscreen and Interactive Results Viewer

## V1.31 scope boundary
V1.31 focuses on story-based UDL workflow. 3D member Point, Trapezoidal and Member Moment load assignment are reserved for the next load-system phase.
