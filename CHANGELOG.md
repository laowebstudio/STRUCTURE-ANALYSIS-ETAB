# V1.25.2 Fix

## Fixed
- Fixed JSON/Cloud restore where Member/Node loads could remain in model data and Load Manager but not appear on the canvas.
- Rebuilds active Node Load mirrors after restore and re-syncs the active Load Case.
- Merges missing layer defaults during restore.
- When an opened JSON/Cloud project contains loads in the active case, the Loads layer and load labels are restored visible so arrows are immediately shown.
- Preserves the V1.25.1 RC Beam internal-moment demand fix.
- Preserves V1.24 Steel Column / Beam-Column design.

## Regression target
After JSON open: Model View load arrows, Load Manager rows, active Load Case, analysis loads, and RC design demand must refer to the same restored model state.
