# V1.28.4 Fix — 3D Force Direction + Scrollable Results + Fullscreen Model

- Fixed 3D nodal force arrows so Fx/Fy/Fz follow the projected **global X/Y/Z axes** and preserve positive/negative sign while rotating the view.
- Applied the same global-axis force rendering in 3D Model Data and the integrated 3D Workspace.
- Added a projected X/Y/Z axis indicator in the integrated 3D viewport.
- Fixed 3D Analysis Results scrolling with an independent scroll region, sticky tabs/header behavior, and horizontal scrolling for wide Member End Forces tables.
- Added **Fullscreen Model** / **Exit Fullscreen** mode. Fullscreen hides side/result clutter while keeping 3D controls and result-mode buttons available.
- 2D analysis/design logic and the V1.28.x 3D numerical solver were not changed.
