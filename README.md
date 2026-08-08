# SAPUDOM Structure Analysis V1.23 — Steel Design Phase 3

Built from the tested V1.22 baseline.

## V1.23 additions
- Traceable Steel Design calculation details per member.
- Explicit governing labels: Yielding, Inelastic LTB, Elastic LTB, Flange Local Buckling.
- Shows Sx, Zx, Mp, flange/web slenderness limits, Lb/Lp/Lr/Cb, Mn branches, φMn and D/C path.
- Keeps unsupported slender-flange and noncompact/slender-web cases as WARNING rather than inventing capacity.
- CSV filename/version updated to V1.23.

## Preserved
V1.22 analysis solver, diagrams, load combinations, JSON/Cloud workflow, section/material assignment and design persistence are preserved.

## Engineering scope
This remains a verification/design aid. Supported Phase 3 flexure scope is doubly-symmetric Steel I strong-axis behavior covered by the implemented paths. Unsupported Chapter F cases are intentionally reported as WARNING and require independent engineering review.
