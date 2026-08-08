# SAPUDOM Structure Analysis V1.25

## V1.25 — RC Beam Design Phase 1

Built from the tested V1.24 Steel Column + Beam-Column baseline.

### New in V1.25
- RC Beam Design results inside Design Center.
- ACI CODE-318-25 selected as the RC design standard.
- Phase 1 scope: nonprestressed, singly reinforced rectangular beams in flexure.
- Uses analysis/envelope moment demand (Mu).
- Calculates effective depth d, As required, As minimum, tension-controlled screening, automatic bar suggestion, Mn, phiMn and demand/capacity ratio.
- RC Beam Calculation Trace for transparent review.
- RC Beam CSV export.
- RC design properties persist with existing JSON/Cloud model snapshots.
- Existing V1.24 Steel Design is preserved.

### Phase 1 limitations
This release does not yet claim complete RC design coverage. Shear, torsion, development/splices, serviceability/deflection, seismic detailing, T/L beams, doubly reinforced beams, and RC columns are reserved for later releases. Unsupported conditions are flagged rather than guessed.

### Planned next version
V1.26: Section Orientation / Rotate Section 90 degrees, as reserved in the roadmap.
