# SAPUDOM Structure Analysis V1.18

2D Frame Analysis • Matrix Stiffness Method

## V1.18 — Cloud parity
Cloud Save/Load now serializes the same complete project snapshot used by JSON Save/Load. Generated Self Weight and other generated/member loads are preserved with the model. Saving with the same project name replaces the latest Cloud copy so the user does not accidentally open an older duplicate. The Cloud list shows saved time, Member count and Self Weight count, and Cloud Open verifies generated-load counts after restore.

## Self Weight compatibility
Legacy members that do not contain an embedded `weight` value can resolve weight from the current Section Database by section ID/name or A/I matching. A material-based fallback is retained for older projects.

## V1.18 Result Envelope
- Max/Min Axial N, Shear V and Moment M across Load Combinations.
- Critical governing Combination labels.
- Maximum displacement envelope.
- Envelope CSV export.

## Compatibility
Preserves JSON, CSV, Supabase Cloud, Building Center, Load Center, Modeling Tools, Check Model, Load Cases/Combinations, Materials, Sections, Member Release/Internal Hinge and the existing 2D solver.

No Supabase SQL migration is required from the existing `structure_projects` setup.


## V1.18 — Load Visualization + Diagram Accuracy
- Global X / Global Y / Local Y member-load arrows now follow their true directions.
- Self Weight on columns is drawn vertically in Global Y instead of as a false horizontal local arrow.
- Added independent Load labels toggle.
- Axial, Shear and Moment diagrams are sampled along each member and include distributed, point and moment loads.
- UDL produces linear Shear and curved (parabolic) Moment diagrams.
- Point loads create Shear jumps and Moment slope changes; applied moments create Moment jumps.
- Result Min/Max and Result Envelope now include internal member extrema, not only end forces.
- JSON/Cloud/Self Weight/Load Combination compatibility is preserved from V1.16.1 Fix.
