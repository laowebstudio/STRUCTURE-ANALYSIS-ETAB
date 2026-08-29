## V1.45.1 — Advanced Loads → RC Design Synchronization Fix

- Fixed stale RC Beam Design demand after adding Point / Trapezoidal / Member Moment loads in 3D Loads.
- Advanced-load assign/clear now invalidates governing envelope and RC derived results.
- Analyze 3D marks the newest solution and clears any pre-solve envelope cache.
- RC Beam Design always regenerates the governing load-combination envelope from current member loads before design.
- Preserves RC design inputs/member overrides while refreshing only derived demand/results.
- Keeps V1.45 Advanced Member Loads and V1.44.1 demand-linked stirrup zoning.
