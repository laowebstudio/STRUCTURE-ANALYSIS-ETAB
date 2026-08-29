# SAPUDOM Structure Analysis V1.45.2

## Rebar Viewer Live Solver Results Fix
This build continues V1.45.1 and fixes the remaining synchronization path between Advanced 3D Member Loads, the live 3D solver, RC Beam Design, and the 3D RC Rebar Viewer.

### Verification
Use M28 with the existing UDL and an asymmetric Point Load near end j. Run **Analyze 3D**, open **RC Beam Design**, then **3D Rebar Viewer**. The displayed `Vu`, Top zones, and Stirrup zones must be rebuilt from the current live solver result rather than the previous RC design object.

V1.44.1 demand-linked stirrup zoning and V1.43.1 cage-fit/clear-spacing checks remain included.
