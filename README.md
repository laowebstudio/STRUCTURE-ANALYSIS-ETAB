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

### V1.41.5
RC Beam Design now includes straight tension-bar development length, anchorage-at-i/j and optional Class A/B lap-splice verification. Hooked anchorage, seismic detailing, top reinforcement design, torsion/serviceability and splice-location/staggering remain outside this version and require engineer review.
