# SAPUDOM Structure Analysis V1.4.1

Core analysis release developed from the user's working V1.2 project for ຊັບອຸດົມ Construction.

## V1.4.1 additions
- Stronger model validation before analysis
- Checks disconnected nodes and invalid E, A, I values
- Improved singular-matrix detection using scale-aware pivot tolerance
- Free and restrained DOF summary
- Solver residual shown after analysis
- Global force-equilibrium summary
- Joint displacement, support reaction and member-end-force tables retained
- Existing JSON and Supabase Cloud workflows retained

## Supported analysis
- Linear elastic 2D frame element
- Three DOF per node: Ux, Uy, Rz
- Fixed, pin and vertical roller supports
- Nodal Fx, Fy and Mz data model (current UI enters Fy)
- Matrix Stiffness Method

## Supabase
No new database migration is required for V1.4.1. Keep the existing `supabase-config.js` and tables from the working version.

## GitHub Pages
Extract the ZIP and copy every file inside the project folder into the repository root. Keep the repository's `.git` folder.

## Engineering limitation
This release is for educational verification. It does not include member distributed loads, end releases, P-Delta, dynamic analysis, shell elements or design-code checks. Independently verify results before professional use.
