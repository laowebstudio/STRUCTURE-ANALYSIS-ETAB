# SAPUDOM Structure Analysis V1.16

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
