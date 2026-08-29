# SAPUDOM Structure Analysis V1.43

## Top Reinforcement + Full Beam Rebar Cage

V1.43 extends the verified V1.42.2 beam 3D rebar viewer into a full beam reinforcement cage. The viewer now renders bottom longitudinal reinforcement, top longitudinal cage bars, stirrups and the selected bottom-bar anchorage solution together.

Top reinforcement can be set to **Auto**, which provides two continuous construction bars for the current foundation phase, or **Manual**, which allows a user-specified top bar count and diameter. The same geometric bar-fit engine checks whether the top bars physically fit the beam section.

The End-i and End-j true section cuts show both bottom and top layers. The 2D RC beam detailing drawing is also linked to the top cage input.

Important: V1.43 does not yet claim code-verified top negative-moment design, top development/anchorage, curtailment, seismic joint detailing, torsion, or serviceability. The existing bottom flexural / shear / detailing / development logic remains protected.
