# Changelog

## V1.14 Fix
- Fixed Check Model support diagnostics.
- Added warning `UNSUPPORTED_BASE_NODE` when a connected base-level joint has Support = none while other base supports exist.
- Added load-independent global stiffness matrix rank check before analysis.
- Added critical `UNSTABLE_STIFFNESS` diagnostic for insufficient restraints, mechanisms, or incompatible releases/hinges.
- Upgraded very low restraint count from Warning to Critical.
- Kept Locate, Analyze Now, JSON, Cloud, Building Center, Modeling Tools, Release/Hinge and solver compatibility.
- No Supabase SQL changes required.

## V1.13
- Added collapsible Analysis Results panel.
- Added clear Show/Hide Results button with visual state.
- Expanded the model canvas automatically while results are hidden.
- Added Model Space mode for a larger modeling/diagram workspace.
- Added keyboard shortcut R for Results and Esc to exit Model Space.
- Preserved calculated results while the panel is hidden.
- Kept V1.12 Fix modeling tools and project compatibility.
