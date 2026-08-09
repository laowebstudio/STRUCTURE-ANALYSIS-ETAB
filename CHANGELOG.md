# V1.30 — Independent 3D Building Workspace

- Based directly on V1.29.1 Fix stable 3D diagram build.
- 2D workspace and 3D workspace are now visually separated: when 3D is active, 2D side panels are hidden and the 3D workspace owns the full work area.
- Added **3D Building Generator** inside the 3D workspace only.
- Generates independent 3D Nodes, Columns, Beam-X and Beam-Y from X/Y grids and story data.
- Supports separate bay widths in X/Y, story heights, fixed base supports, and beam/column 3D section properties.
- Generated data writes only to `state.model3d`; it does not modify 2D `state.nodes`, `state.members`, 2D loads, results, RC/Steel design, or the existing 2D Building Center.
- Existing V1.29.1 3D solver, diagrams, local axes, fullscreen and interactive results remain unchanged.
