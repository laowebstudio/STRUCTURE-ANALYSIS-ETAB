# SAPUDOM Structure Analysis V1.15 Fix

V1.15 builds on **V1.14 Fix** and adds an **Automatic Load Generator / Load Center** while keeping the validated 2D frame solver unchanged.

## New in V1.15 Fix
- Automatic member **Self Weight** from section weight (kN/m), applied in Global Y.
- Generate for all members or only selected members.
- Generated self weight is tagged, replaceable and removable without deleting manual loads.
- Generated Load Summary for Self Weight / Floor Load / Wall Load.
- Total member dead weight estimate and missing-weight diagnostics.
- Quick creation of SDL, WL and EQ load cases.
- Load-combination templates as starting points (engineer must verify against the governing code).
- Direct links to Building Loads, Check Model and Analyze.
- JSON/Cloud preserve generated loads because they are stored with member load data.

## Compatibility
V1.14 Fix projects remain openable. Building Center, Story Manager, Modeling Tools, Check Model, JSON, CSV, Supabase Cloud, Member Release/Internal Hinge, Load Cases/Combinations and N/V/M/Deformed diagrams remain available. No Supabase SQL change is required.

## Important engineering note
Combination templates in V1.15 are convenience starting points, not a declaration of compliance with any specific building code. Verify factors, load definitions and governing combinations for each project.


## Professional Menu UI
- ETABS-inspired File/Edit/View/Define/Draw/Select/Assign/Analyze/Display/Tools/Help menu bar.
- Compact quick-access icon toolbar.
- Existing commands retain their original IDs and logic; the change is UI/navigation only.
- Fixes top-header overlap on MacBook and narrower screens.
