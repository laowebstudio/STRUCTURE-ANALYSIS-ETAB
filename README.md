## V1.47.1.2 — WebGL True Solid Physical Model Engine

- True WebGL physical renderer with depth buffering and perspective camera.
- Solid Beam, Column, Slab and Footing geometry generated from the same structural model data.
- Concrete face lighting, edge lines and ground grid.
- Analysis renderer and solver remain protected; RC Beam stays frozen.

# V1.47.1.1 — Realistic Physical Building Geometry & Rendering

Physical rendering upgrade from V1.47.1.

# V1.47.1 — True Physical Building Model

True physical 3D rendering layer linked to the existing whole-building analysis model. RC Design remains frozen and slab shell FEM is intentionally deferred.

# SAPUDOM Structure Analysis V1.47

## Full Building Structural Model & Analysis

V1.47 continues from V1.46.1.2 while freezing the RC-beam detailing prototype. The 3D workspace now supports a physical full-building model with beams, columns, floor slabs and isolated footings.

### Implemented in V1.47
- Physical 3D Beam + Column + Slab + Foundation model
- Whole-building 12x12 space-frame stiffness solve using all frame nodes/members
- Rigid diaphragm support retained
- Slab area-load panels with solver-linked gravity transfer to perimeter beams
- DL and LL slab load transfer included automatically in the same 3D load system
- Foundation objects mapped to solved support reactions
- Result tabs for Slab Load Path and Foundation reactions
- Physical floor/footing rendering in the integrated 3D workspace
- JSON persistence through the existing model3d project snapshot
- RC Beam design remains available but marked Frozen from the V1.46.1.2 prototype

### Engineering boundary
The V1.47 slab model is a physical load-transfer panel model. It does **not** claim shell/plate bending FEM or slab reinforcement design. Foundation objects report frame support demands; soil-structure interaction and footing design are not yet claimed. These are deliberate boundaries so numerical results are not presented as capabilities the engine does not yet possess.
