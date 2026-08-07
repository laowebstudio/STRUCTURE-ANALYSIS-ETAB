# SAPUDOM Structure Analysis V1.14 Fix

V1.14 Fix adds **Structural Model Validation & Diagnostics** on top of V1.13. Use **✓ Check Model** before Analyze to identify model integrity problems and locate them directly on the canvas.

## V1.14 Fix diagnostics

- Duplicate/coincident Nodes
- Disconnected/orphan Nodes
- Missing Node references and zero-length/duplicate Members
- Invalid E, A, I and missing Material/Section references
- Missing/insufficient Supports
- **Base Support consistency check:** warns when a connected base-level Node loses its Support while other base supports remain
- **Global stiffness rank check:** detects rigid-body motion / mechanisms before Analyze using the assembled stiffness matrix
- Disconnected structural components
- Release/Internal Hinge review
- Invalid Member Load positions/types and unknown Load Cases
- Invalid Load Combination references
- Critical / Warning / Info classification
- One-click **Locate** and **Analyze Now** when safe

No Supabase SQL change is required. Existing JSON/Cloud projects remain compatible.

# SAPUDOM Structure Analysis V1.13

Based on V1.12 Fix. V1.13 adds a collapsible Analysis Results workspace while preserving the engineering solver and all existing project features.

## New in V1.13
- Show/Hide Analysis Results at any time without re-analyzing.
- Canvas/model area expands immediately when results are hidden.
- Results remain in memory and return unchanged when shown again.
- Model Space button temporarily hides side panels and results for maximum canvas area.
- Keyboard shortcut `R` toggles the Results panel; `Esc` exits Model Space.
- Results panel preference is remembered in the browser.
- JSON, Cloud, Building Center, Modeling Tools, Loads, Load Combinations, Release/Hinge and diagrams are preserved.

No Supabase SQL change is required.
