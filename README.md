# SAPUDOM Structure Analysis V1.45 — Advanced Member Loads

V1.45 continues directly from V1.44.1 and adds advanced member loading inside the existing **3D Loads** panel. The 3D frame solver now accepts UDL, Point Load, Trapezoidal Load and Member Moment assignments, including single-member targeting for asymmetric load tests and practical structural analysis.

Key additions: Point Load magnitude + x/L position; Trapezoidal w1/w2 + start/end x/L; Member Moment about Local 1/2/3 + x/L position; solver-consistent equivalent nodal loads; load audit support; and 3D load visualization. Existing V1.44.1 demand-linked stirrup zoning remains available for verification against asymmetric loads.

# SAPUDOM Structure Analysis V1.44.1 — Demand-Linked Stirrup Zoning Fix

V1.44.1 fixes the V1.44 Auto stirrup-zoning case where Support-i / Midspan / Support-j could all display the same spacing even after end shear increased. The local shear calculation is retained, and support zones that require meaningful stirrup contribution now receive a conservative support-detailing spacing cap, while midspan retains the normal local-demand spacing.

The 3D Rebar Viewer now reports zone Vu values and the active support cap, making the zoning traceable during testing. Manual stirrup spacing is unchanged. The support densification cap is a conservative detailing-assist rule; full station-by-station shear envelopes and project-specific seismic detailing remain outside current code verification.

# SAPUDOM Structure Analysis V1.44 — Beam Reinforcement Zoning

V1.44 continues from V1.43.1 and adds calculation-linked beam reinforcement zoning. Automatic top reinforcement is now split into Support-i / Midspan / Support-j zones using negative end-moment envelope demand. Automatic stirrups are split into Support-i / Midspan / Support-j zones using end shear envelope demand, so stirrups can be denser near supports and wider in the middle when demand permits.

The V1.43.1 cage-fit / clear-spacing checks remain active. Bottom flexure, shear verification, development/anchorage/lap, 3D cage viewing, and End-i/End-j section cuts remain available. Support-zone cut-off lengths are still detailing-assist; full station-by-station moment/shear envelope, top anchorage/development, seismic detailing, torsion, serviceability, and splice staggering are not yet code-verified.

# SAPUDOM Structure Analysis V1.43

## Top Reinforcement + Full Beam Rebar Cage

V1.43 extends the verified V1.42.2 beam 3D rebar viewer into a full beam reinforcement cage. The viewer now renders bottom longitudinal reinforcement, top longitudinal cage bars, stirrups and the selected bottom-bar anchorage solution together.

Top reinforcement can be set to **Auto**, which provides two continuous construction bars for the current foundation phase, or **Manual**, which allows a user-specified top bar count and diameter. The same geometric bar-fit engine checks whether the top bars physically fit the beam section.

The End-i and End-j true section cuts show both bottom and top layers. The 2D RC beam detailing drawing is also linked to the top cage input.

Important: V1.43 does not yet claim code-verified top negative-moment design, top development/anchorage, curtailment, seismic joint detailing, torsion, or serviceability. The existing bottom flexural / shear / detailing / development logic remains protected.
