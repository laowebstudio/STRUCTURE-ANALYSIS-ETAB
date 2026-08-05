# SAPUDOM Structure Analysis V1.4.2

V1.4.1 remains the stable analysis-core baseline. V1.4.2 adds result visualization without changing the existing Supabase schema.

## New in V1.4.2
- Adjustable deformed-shape scale
- Axial force diagram (N)
- Shear force diagram (V)
- Bending moment diagram (M)
- Optional value labels on diagrams
- Global Min/Max result summary
- Click a Member or result-table row to inspect its end forces
- Export analysis results to CSV
- Existing JSON and Supabase Cloud Save/Open retained

## Supabase
No new SQL migration is required. Keep the existing `supabase-config.js` and `supabase-setup.sql` from the working repository.

## Scope / limitations
Linear elastic 2D frame analysis with nodal loads. Diagram interpolation is based on member end forces; distributed member loads and nonlinear analysis are not included yet.
