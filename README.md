# SAPUDOM Structure Analysis V1.46.1.1

## RC Beam Station-Based Auto Design + Economical Reinforcement Zoning

V1.46.1.1 is developed directly from V1.46.1 and preserves its Whole Model solve / Selected Member display-only behavior.

### New RC beam workflow
- Whole Model Analysis → Load Cases / Combinations → station force recovery → station envelope → automatic RC beam design.
- Configurable 21–101 stations per beam (default 41).
- Station envelopes for P/N, V2, V3, T, M2 and M3 with governing analysis trace.
- Bottom and top longitudinal reinforcement are zoned from positive/negative station moment demand.
- Automatic stirrup spacing is zoned from the actual station shear envelope; the previous assumed midspan shear is not used for auto zoning.
- Every station is checked against the reinforcement zone actually provided there.
- Extra longitudinal reinforcement zones are extended by calculated development length.
- Economical zoning compares zoned longitudinal steel against uniform maximum reinforcement and reports an indicative reduction.

### Protected V1.46.1 behavior
- Analyze 3D always solves the complete structural model.
- Selected Member remains a display filter only and never isolates/re-solves the member.
- Whole Model diagram scaling semantics remain protected.

### Engineering scope
Torsion reinforcement design, seismic special-frame detailing, serviceability/crack control, splice staggering and final construction BBS optimization are not completed in this version. Final construction design requires independent project-specific code verification.

See `V1.46.1.1-NOTES.txt` for the detailed test checklist.

---

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
