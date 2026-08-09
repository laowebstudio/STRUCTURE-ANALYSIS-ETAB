# V1.25.1 Fix

- Fixed RC Beam design demand transfer: Mu now uses the maximum absolute internal bending moment sampled along each member, including UDL/point/member-load effects, instead of only member end moments.
- Preserved V1.24 Steel Design behavior and V1.25 RC Beam Phase 1 calculations.
- Updated demand helper consistency for sampled N/V/M values.

# Changelog

## V1.25
- Added RC Beam Design Phase 1.
- Updated RC standard selector to ACI CODE-318-25.
- Added rectangular RC beam flexural demand/capacity workflow.
- Added As(required), As(min), tension-controlled screening and automatic reinforcement suggestion.
- Added phiMn, D/C, PASS/FAIL/WARNING and RC Calculation Trace.
- Added RC Beam CSV export.
- Preserved V1.24 Steel Column + Beam-Column design and the V1.19 analysis core.
- Section Orientation / Rotate 90 degrees intentionally deferred to V1.26.

# Changelog

## V1.24
- Added Steel Column + Beam-Column Design phase.
- Added KL/rx and KL/ry calculation and governing buckling axis.
- Added Fex/Fey trace and governing compression strength context.
- Added explicit H1 interaction branch description in Calculation Details.
- Updated Design Center/result labels and CSV filename.
- Preserved V1.23 Steel Phase 3 flexure/LTB/local-buckling logic and stable analysis core.
