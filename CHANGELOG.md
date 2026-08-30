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
