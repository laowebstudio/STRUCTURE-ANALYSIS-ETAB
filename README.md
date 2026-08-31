# SAPUDOM Structure Analysis V1.47.2.2 — Full Model Regeneration + Analysis Result Reset Integrity Fix

This release fixes stale 3D analysis data after regenerating a building with **Replace current 3D geometry**. Geometry, IDs, selections and all derived analysis/design result caches are reset before the new model is built. The Slab Shell/Plate FEM and Easy Slab Input workflow from V1.47.2.1 remain in place.

## Integrity guarantee
After regeneration, Analysis Results are unavailable until **Analyze 3D** is run again. Story Forces, Reactions, Member End Forces, Slab FEM and Foundation results then come only from the current regenerated model.

# SAPUDOM Structure Analysis V1.47.2.1
## Easy Slab Input + Validation Fix

This release continues from V1.47.2 Slab Shell/Plate Analysis Engine and makes slab input safer and easier to understand.

### Easy slab input
- Enter Superimposed DL and LL as **positive magnitudes**.
- SAPUDOM applies gravity in **Global -Z** automatically.
- Live preview shows slab self-weight, Total DL, and LL before generation.
- Story-height entries automatically match the selected number of stories.

### Validation
- Slab thickness: 80-500 mm
- Concrete E: 10,000-60,000 MPa
- 0 <= Poisson ratio < 0.5
- Positive concrete unit weight
- DL and LL cannot be negative

### FEM
The V1.47.2 Q4 shell/plate FEM remains in place. This release changes input handling and gravity sign convention; it does not add RC slab design or foundation design.
