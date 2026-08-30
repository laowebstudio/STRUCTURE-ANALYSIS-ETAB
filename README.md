# SAPUDOM Structure Analysis V1.46.3.2

## Reinforcement Zoning Consistency Fix

This build keeps the V1.46.3.1 Whole Model → Strength Combination → Station Envelope RC-design flow and makes final reinforcement zoning auditable and consistent between RC Design Details and the 3D Rebar Viewer.

### Main fixes
- Support-i and Support-j top reinforcement are sized independently from their own negative station moments.
- Multi-layer top steel is rechecked with its actual centroid/effective depth; Auto mode adds bars until the zone capacity passes.
- Details reports As(req), As(min), As(provided), Mu/φMn and status for both support zones.
- Final stirrup zones are checked against their own local Vu and displayed with φVn and DCR.
- The former single `Use Ø...@...` shear line is now identified as the base demand-spacing reference; final detailing is the zone table.
- Overall PASS now requires final top-zone and final stirrup-zone checks to pass.

See `V1.46.3.2-FIX-NOTES.txt` for details.
