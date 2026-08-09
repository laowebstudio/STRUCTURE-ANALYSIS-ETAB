# SAPUDOM Structure Analysis V1.30

V1.30 adds an independent 3D building workflow while protecting the tested 2D system.

## 3D workflow
Open **3D Frame** → **3D Building** → define X/Y bays and widths, stories and heights → generate the building → assign 3D loads in **3D Model Data** → **Analyze 3D** → review N, V2, V3, T, M2, M3 diagrams and interactive results.

## 2D protection
The V1.30 3D Building Generator writes only to the separate `model3d` data structure. It does not generate, replace, or edit the existing 2D model.
