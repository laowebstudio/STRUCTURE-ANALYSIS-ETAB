# V1.31 — 3D Building Load System

- Based directly on V1.30.2 Fix Stable.
- Added independent 3D Load Patterns and Story Load Assignment.
- Added Beam-X / Beam-Y filters and Global X/Y/Z UDL directions.
- Added 3D load visualization and Load Summary.
- Added active load-pattern selector in the 3D workspace.
- Added consistent equivalent member-load vectors to the existing 3D solver without changing the 2D engine.
- Member end forces subtract the element equivalent load vector so UDL fixed-end effects are represented.
- Existing 3D Building Generator, support persistence, validation, diagrams and results viewer retained.

# V1.30 — Independent 3D Building Workspace

- Based directly on V1.29.1 Fix stable 3D diagram build.
- 2D workspace and 3D workspace are now visually separated: when 3D is active, 2D side panels are hidden and the 3D workspace owns the full work area.
- Added **3D Building Generator** inside the 3D workspace only.
- Generates independent 3D Nodes, Columns, Beam-X and Beam-Y from X/Y grids and story data.
- Supports separate bay widths in X/Y, story heights, fixed base supports, and beam/column 3D section properties.
- Generated data writes only to `state.model3d`; it does not modify 2D `state.nodes`, `state.members`, 2D loads, results, RC/Steel design, or the existing 2D Building Center.
- Existing V1.29.1 3D solver, diagrams, local axes, fullscreen and interactive results remain unchanged.

## V1.30.1 Fix — 3D Building Base Support Persistence
- Fixed 3D Building Generator base supports not appearing in 3D Model Data.
- Fixed selected Node support/load controls not hydrating on initial Model Data open/refresh.
- Fixed base restraint persistence for generated buildings: base nodes store Ux/Uy/Uz/Rx/Ry/Rz = Fixed.
- Added compatibility repair for V1.30 generated 3D building models with Fixed Base metadata.
- Scope limited to state.model3d; verified 2D workspace/engine is untouched.


## V1.30.2 Fix — 3D Model Validation Feedback
- Added visible validation status inside 3D Model Data.
- Success shows Nodes, Members, restrained Nodes, restrained DOF, and Ready to Analyze.
- Warnings/errors are shown in the same panel instead of relying on a hidden workspace toast.
- No changes to the 2D engine, 3D solver, 3D Building Generator calculations, or support persistence logic.
