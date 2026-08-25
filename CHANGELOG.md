# V1.35.1 Fix.1 Fix — Diaphragm Apply Feedback
- Added story-based rigid diaphragm constraints for 3D analysis.
- Uses transformation method for Ux/Uy/Rz rigid-floor kinematics.
- Diaphragm OFF by default for V1.34 regression compatibility.

# SAPUDOM Structure Analysis V1.32

## Added — 3D Global Equilibrium & Analysis Summary
- Added six-component global equilibrium verification: Fx, Fy, Fz, Mx, My, Mz.
- Added Applied / Reaction / Residual table in 3D Analysis Results → Summary.
- Added overall PASS/WARNING and per-component PASS/CHECK badges.
- Global moment check includes direct nodal moments and r × F about global origin.
- Active load pattern shown in the verification panel.

## Protected
- No changes to verified 2D solver/workspace.
- No change to V1.31.1 3D stiffness solution equations.
- No change to true 3D M2/M3 UDL curve renderer except version labeling.

## V1.39.1 Fix — Load Case Result Switching
- Connected active 3D load pattern explicitly to the solver input path.
- Added load audit and persisted nodal-load compatibility.
- Added NO LOAD status to prevent zero-load equilibrium from appearing as a meaningful PASS.
