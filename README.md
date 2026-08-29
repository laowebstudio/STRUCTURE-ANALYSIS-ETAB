# SAPUDOM Structure Analysis V1.45.1 — Advanced Loads → RC Design Synchronization Fix

V1.45.1 continues directly from V1.45. The Advanced Member Loads system remains inside **3D Loads** (UDL, Point Load, Trapezoidal Load, Member Moment), while this fix synchronizes those latest loads with RC Beam Design.

## Synchronization fix

- Every Advanced Member Load assignment or filtered clear invalidates the derived 3D envelope / RC design cache.
- Every **Analyze 3D** marks the current 3D result as fresh and invalidates any older governing envelope.
- **RC Beam Design no longer reuses a cached V1.40 envelope.** It regenerates the governing load-combination envelope on every design/recalculate pass.
- Top support reinforcement zones and Support-i / Midspan / Support-j stirrup zones therefore read current end moments and shears after Point / Trapezoidal / Member Moment changes.
- RC defaults and per-member overrides remain preserved while only stale derived results are cleared.

## Regression target

For M28, add or duplicate a Point Load near j (for example x/L = 0.90), run **Analyze 3D**, then reopen **RC Beam Design → 3D Rebar Viewer**. The displayed support `Vu`, top zones and stirrup zones must update from the latest solver/load-combination results rather than retaining the previous values.

V1.44.1 demand-linked stirrup zoning and V1.43.1 cage-fit / clear-spacing logic are retained.
