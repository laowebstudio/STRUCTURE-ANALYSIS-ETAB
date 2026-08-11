# SAPUDOM Structure Analysis V1.31.1 Fix

## True 3D Moment Diagram Curves

- Keeps the verified V1.31 3D Building Load System and solver path.
- Does not modify the verified 2D calculation engine.
- Moment M2/M3 diagrams now sample 31 stations per member.
- Constant UDL adds the correct quadratic (parabolic) component between solved member-end moments.
- M3 curvature uses local qy; M2 curvature uses local qz with the program local-axis sign convention.
- Diagram end values remain exactly the solved member-end values.
- Legend Min/Max now includes interior-station extrema, not only member ends.
- Moment labels show interior Min/Max to reduce clutter.
- Axial, shear and torsion rendering behavior remains unchanged except for the shared sampled renderer.
