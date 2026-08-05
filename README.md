# SAPUDOM Structure Analysis V1.6

ต่อจาก V1.5.2 Fix2 Stable

## New in V1.6
- Node loads: Global Fx, Fy and Mz
- Member point load in local y
- Uniform distributed load (UDL)
- Trapezoidal/triangular distributed load
- Concentrated member moment
- Loads separated by Load Case and included in Load Combinations
- Equivalent nodal-load formulation in the matrix-stiffness solver
- Member loads saved in JSON and Supabase model JSON

## Sign convention
- Node Fx/Fy use global axes.
- Member distributed and point loads use the member local y axis. For a horizontal member from left to right, negative means downward.
- Positive member moment follows the local positive rotation convention.

No new Supabase SQL is required.
