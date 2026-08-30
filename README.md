# SAPUDOM Structure Analysis V1.46.1

## Whole Model Solve / Selected Member Display Fix

V1.46.1 preserves the V1.46 Whole Model Analysis → RC Design integration and fixes the 3D result viewing semantics.

- **Analyze 3D always solves the complete structural model.** Global stiffness K and load vector F are assembled from every 3D node/member, including restraints, diaphragm constraints, member loads, and nodal loads.
- **Selected Member is now display-only.** Clicking M32 does not isolate M32 and does not trigger a separate solve. It only hides the other result diagrams.
- Selected-member diagrams retain the **Whole Model diagram scale**, so switching from Whole Model to M32 cannot visually re-normalize the force diagram and suggest an isolated-member analysis.
- The result legend explicitly reports **Analysis Source: WHOLE MODEL SOLUTION** and **Display Filter: Selected Member Mxx**.
- Member end forces and RC design demand remain the forces recovered for that member from the same Whole Model displacement solution.

### Test
1. Analyze the 3D model.
2. Show Moment M2 with `Whole Model`.
3. Click M32 / select `Selected Member (Display Only)`.
4. Only M32 should remain visible, but its diagram shape/magnitude and scale relative to the Whole Model solution must be unchanged.
5. Switch back to Whole Model; no re-analysis should occur and the result set must be identical.
