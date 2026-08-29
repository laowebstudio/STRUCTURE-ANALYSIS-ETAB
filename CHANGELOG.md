## V1.45 — Advanced Member Loads
- Upgraded the existing 3D Loads panel from UDL-only assignment to UDL / Point / Trapezoidal / Member Moment.
- Added Single Member targeting for direct member-specific loading.
- Point and trapezoidal loads support Global X / Y / Z direction and x/L positioning.
- Member Moment supports Local 1 / Local 2 / Local 3 axis and x/L positioning.
- Added consistent equivalent nodal load vectors for all new load types in the 3D frame solver.
- Updated load audit / no-load detection and 3D workspace load visualization.
- Preserved V1.44.1 RC Beam Reinforcement Zoning and Demand-Linked Stirrup Zoning logic.

## V1.44.1 — Demand-Linked Stirrup Zoning Fix
- Fixed Auto stirrup zones staying visually uniform when d/2 controlled all zones.
- Added demand-triggered conservative support-zone densification when Vu > phiVc.
- Midspan retains local demand spacing.
- Viewer now shows zone Vu and active support cap.
- Manual mode unchanged.

## V1.44 — Beam Reinforcement Zoning
- Added Support-i / Midspan / Support-j stirrup zones linked to shear envelope demand.
- Added Support-i / Midspan / Support-j top reinforcement zones linked to negative end-moment envelope demand.
- 3D Rebar Viewer now renders variable stirrup spacing and zoned top bars.
- End-i / End-j section cuts now show the selected support-zone top reinforcement.
- Construction drawing elevation shows top support zones and variable stirrups.
- Preserved V1.43.1 cage-fit and clear-spacing safety logic.

## V1.43 — Top Reinforcement + Full Beam Rebar Cage

- Added Top Ø, Top Mode and Top Bars inputs to RC Beam Design.
- Added automatic two-bar top cage mode and manual top-bar count mode.
- Added top bar arrangement / physical fit check.
- Added top longitudinal bars to the 3D RC Rebar Viewer.
- Added independent Top bars visibility control.
- Added top bars to End-i / End-j true section cuts.
- Added top bars to RC Beam Detailing Drawing and section views.
- Preserved V1.42.2 camera controls and true section-cut renderer.
- Preserved V1.41.6.2 bottom RC design and development/anchorage/lap logic.
