# SAPUDOM Structure Analysis V1.32

## 3D Global Equilibrium & Analysis Summary

V1.32 is built directly from the verified V1.31.1 Fix base. It adds a read-only global equilibrium verification layer to the independent 3D workspace without changing the verified 2D engine or the V1.31.1 3D stiffness-solver path.

### Added
- 3D Analysis Results → Summary now shows Applied, Reaction and Residual for Fx, Fy, Fz, Mx, My and Mz.
- Global moments are reported about Global Origin (0,0,0), including r × F contributions from equivalent nodal loads.
- Per-component PASS/CHECK status plus overall PASS/WARNING.
- Active 3D Load Pattern is shown in the equilibrium panel.
- Existing Nodes / Members / Total DOF / Max Translation summary remains.

### Protected
- 2D analysis engine and 2D workspace.
- V1.31 3D Building Load System.
- V1.31.1 true M2/M3 UDL moment curves.
- Existing 3D stiffness matrix, displacements, reactions and member-end-force calculations.

### Equilibrium convention
Residual = Applied + Reaction. A component passes when |Residual| <= max(1e-6, 1e-6 × component scale).


### V1.41.6
- Automatic Anchorage Solution: straight development is checked first; when unavailable, a standard 90° hook design-assist solution is evaluated and reported at member i/j ends.
- Automatic Rebar Arrangement Verification: multi-layer bars are arranged by available beam width, horizontal/vertical clear spacing is verified, and the steel centroid/effective depth is recalculated.
- Flexure is rechecked using centroid-aware effective depth; bar quantity can increase automatically if multi-layer placement reduces capacity.
- RC Beam Drawing now reports/draws the selected anchorage method and allows verified multi-layer layouts to PASS.

### V1.41.5.1
- Professional RC Beam Drawing readability redesign.
- Automatic tension lap-splice Class A/B eligibility verification.
- New Bars Spliced (%) input; Class A requires As(prov)/As(req) >= 2.0 and <=50% bars spliced.

### V1.41.5
RC Beam Design now includes straight tension-bar development length, anchorage-at-i/j and optional Class A/B lap-splice verification. Hooked anchorage, seismic detailing, top reinforcement design, torsion/serviceability and splice-location/staggering remain outside this version and require engineer review.


### V1.41.6.1 Fix
- Adds an explicit full-depth reinforcement cage check: required vertical depth includes bottom/top cover, stirrup diameter, every longitudinal bar layer, and every required vertical clear spacing.
- `verticalFitPass` can only pass when `requiredVerticalDepth <= member depth`.
- RC Beam Drawing sections now plot reinforcement from real section geometry and calculated layer-center locations instead of a fixed pixel pitch.
- Prevents visually overflowing reinforcement layers in the drawing when the physical arrangement fits; genuine vertical-fit failures are labelled `VERTICAL FIT FAIL`.
- Overall `DESIGN VERIFIED` remains blocked whenever detailing fails.
