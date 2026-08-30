## V1.47.1.3 — Accurate WebGL Member Picking + Selection Mapping Fix

This release continues from V1.47.1.2 and fixes the selection mismatch in the True Solid Physical Model. Physical-mode clicks now use a camera ray through the cursor and intersect the actual oriented solid volume of every Beam/Column. The nearest visible hit maps directly to the original `m3.members` object and Member ID.

### What changed
- WebGL 3D ray picking in Physical Model.
- Same camera projection/view matrix for render and selection.
- Oriented bounding-box intersection for real member width/depth/length.
- Correct nearest-visible-member selection when members overlap on screen.
- CSS mouse coordinates are normalized from `getBoundingClientRect()`; no erroneous double Retina/DPR scaling.
- Physical Object ↔ Member ID ↔ Analysis Member remains 1:1.
- Analysis Model hit-testing is kept separate to protect the existing analysis workflow.

RC Beam Design remains frozen at V1.46.1.2. Slab FEM is still deferred until the Physical Building workflow passes verification.
