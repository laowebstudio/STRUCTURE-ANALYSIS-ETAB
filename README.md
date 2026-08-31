# SAPUDOM Structure Analysis V1.47.2.3 — Slab FEM Bending Moment + Shear Force Recovery Fix

This release continues from V1.47.2.2 and fixes the T2 slab-force recovery failure in which a symmetric one-bay slab could show vertical deflection while recovered M11/M22/M12 and V13/V23 were zero.

## FEM recovery change
Each structural slab bay now contains a solver-internal **2×2 Q4 Mindlin bending patch**. The internal bending DOFs are statically condensed to the same four frame corner joints used by the whole-building model. After the global solve, SAPUDOM back-substitutes the internal slab DOFs and recovers plate moments and transverse shears from the internal sub-elements.

Reported slab results:
- center deflection `w`
- `M11`, `M22`, `M12` in kN·m/m
- `V13`, `V23` in kN/m

V1.47.2.2 full-model regeneration and stale-result reset integrity remains active. Easy positive gravity input from V1.47.2.1 also remains active.

## Important engineering limitation
V1.47.2.3 is still a development FEM. The new recovery fixes the zero-force regression and provides internal curvature/shear fields, but it is **not yet approved for RC slab design or construction use**. Mesh-convergence and independent plate benchmarks must pass before design integration.

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
