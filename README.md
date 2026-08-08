# SAPUDOM Structure Analysis V1.22 — Steel Design Phase 2

Built from the tested V1.21 Fix baseline.

## V1.22 additions
- AISC 360-22 LRFD Steel I strong-axis flexure capacity
- Yielding / lateral-torsional buckling (LTB) using Lb, Lp, Lr and user Cb
- Flange/web width-thickness compactness screening
- Axial + flexural demand/capacity interaction for the 2D frame workflow
- Detailed member design dialog (click Member ID)
- Expanded Steel Design CSV export
- Design properties and results continue to travel with JSON/Cloud model data

## Scope / engineering limitation
V1.22 Phase 2 supports doubly-symmetric Steel I sections for strong-axis flexure. Noncompact/slender web cases and slender-flange cases are flagged WARNING rather than being treated as fully implemented Chapter F cases. Cb defaults to 1.0 and must be set by the engineer when a different value is justified. This software remains a verification/design aid and does not replace independent engineering review.
