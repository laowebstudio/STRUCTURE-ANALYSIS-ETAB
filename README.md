# SAPUDOM Structure Analysis V1.16 Fix

Based on V1.15.1.

## V1.16 — Result Envelope & Critical Combination
- Full existing Load Combination Manager retained.
- New Result Envelope for all defined Load Combinations (falls back to Load Cases when no combinations exist).
- Max/Min Axial, Shear and Moment for every member.
- Shows the critical case/combination that governs each extreme.
- Global maximum absolute displacement with governing analysis.
- Click an envelope row to select/highlight that member on the model.
- Export envelope results to CSV.
- Analysis results are cached per Case/Combination and remain compatible with existing result display.
- Existing JSON, Cloud, Building Center, Load Center, Modeling Tools, Check Model, Release/Hinge and 2D solver are retained.

No Supabase schema change is required.


## V1.16 Fix — Self Weight compatibility
- Fixed Load Center reading `0 kN/m` for legacy Members even when the Section Database contains a valid Weight.
- Section lookup now supports Section ID, Section name, and legacy A/I matching.
- If an old project has no stored section weight, the app can derive weight/length from `A × unit weight` (Concrete 24 kN/m³, Steel 78.5 kN/m³).
- Manual loads are not modified by this compatibility fix.
