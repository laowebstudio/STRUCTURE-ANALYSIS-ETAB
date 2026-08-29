# SAPUDOM Structure Analysis V1.42.2

## True Section Cut Rebar Rendering
End-i / End-j now show a true midspan cross-section with longitudinal bars rendered as circles at their actual calculation-linked layer coordinates. This fixes the V1.42.1 issue where 90° hook tails obscured the 6+3 arrangement in end views.

# SAPUDOM Structure Analysis V1.42

## 3D RC Rebar Visualization Foundation

V1.42 continues directly from V1.41.6.2. It adds a read-only, calculation-linked 3D rebar viewer for RC beams while protecting the tested analysis and RC design logic.

### What is visualized
- Concrete beam envelope (semi-transparent)
- Bottom longitudinal reinforcement from the actual RC design result
- Automatic multi-layer arrangement (for example 9Ø20 = 6+3)
- Stirrups using the current designed/provided spacing
- 90° anchorage hooks at i/j when selected by the development verification

### Viewer controls
Drag to rotate, mouse wheel to zoom, Fit, Isometric, and visibility toggles for Concrete / Stirrups / Main Bars.

### Scope
This is the foundation phase toward a full RC reinforcement BIM/detailing model. Top reinforcement, columns, beam-column joints, slabs, splice staggering and full-building reinforcement are future phases.
