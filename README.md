
## V1.46.3.1 — RC Beam Design Dialog Runtime Fix
- Forced browser/GitHub Pages cache refresh with `app.js?v=1.46.3.1`.
- Guarded RC Beam Design button/dialog runtime path; no silent failure.
- Defensive RC design table rendering for incomplete/non-finite result rows.
- Keeps V1.46.3 Whole Model / Strength Combination / 41-station envelope calculation policy unchanged.
# SAPUDOM Structure Analysis V1.46.3

## Station Demand Runtime + Trace Integrity Fix

V1.46.3 continues from V1.46.2 and fixes the station-demand runtime and trace integrity issues found during retesting.

### Main fixes
- Fixed the `MposMid` runtime initialization error in RC Beam Design.
- Added Load Combination classification: **Strength / Service / Other**.
- RC Strength Design governing envelope uses **Strength combinations only**.
- Service and Other combinations remain available for analysis but cannot govern Strength RC design.
- P/N and T now use the same 41-station whole-model envelope used by M2/M3 and V2/V3.
- RC Details reports axis, x/L, signed value, and governing combination for Mu+, Mu− support zones, Vu, Pu, and Tu.
- Whole Model solution remains the source; selecting a member only filters display.

### Design-assist limits
Station reconstruction, reinforcement zoning, anchorage assistance, and trace reporting are engineering-assist features. Full torsion interaction, axial-flexure interaction, seismic detailing, serviceability, and project-code verification still require engineer review.
