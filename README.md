# SAPUDOM Structure Analysis V1.31.1 Fix

This release is a focused visualization fix based on V1.31. The 2D workspace and verified 3D solver/building-load workflow are protected.

The key change is true curved 3D bending-moment diagrams for members carrying constant UDL. M2 and M3 are evaluated at 31 stations, preserving solved i/j end moments while adding the physically required quadratic UDL term. This makes UDL moment diagrams parabolic rather than straight-sided polygons.

Suggested verification: Analyze a simple member with a constant UDL, switch to Selected Member, then inspect M2/M3. The applicable bending diagram should be curved, endpoint values should match Member End Forces, and the legend should report an interior extremum when it governs.
