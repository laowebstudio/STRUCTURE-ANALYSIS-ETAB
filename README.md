# SAPUDOM Structure Analysis V1.46.1.2

## Practical RC Beam Detailing + Constructability Optimization

V1.46.1.2 is developed from V1.46.1.1 and preserves the Whole Model solve and station-envelope RC beam design path.

### Added in V1.46.1.2
- Practical longitudinal bar-diameter optimization using common beam bar sizes (16, 20, 25, 28, 32 mm) with penalties for excessive bar count and multi-layer congestion.
- Two continuous longitudinal base bars are maintained through the beam in Auto Practical mode.
- Additional longitudinal bars are created only where station moment demand requires them.
- Extra-bar zones are extended by development length and a practical minimum zone length, rounded to 50 mm detailing increments.
- Adjacent/overlapping short extra zones are merged to avoid impractical reinforcement stair-steps.
- 3D Rebar Viewer now distinguishes continuous bars from extra zoned bars instead of drawing the governing maximum cage continuously for the full beam.
- Practical Detailing can be enabled/disabled in the RC Beam Design Center.
- Existing station-by-station moment and shear verification remains active.

### Design-use warning
This software is a design-assist tool. Construction drawings still require project-specific engineering review for support geometry, seismic detailing, torsion, serviceability, splice locations, anchorage, local code requirements and final bar bending schedule.

See `V1.46.1.2-NOTES.txt` for the test checklist.
