# SAPUDOM Structure Analysis V1.9

## Building Generator & Story Manager

V1.9 extends V1.8.1 Fix and keeps the existing solver, diagrams, loads, load cases/combinations, JSON, CSV, libraries, multi-assign, and Supabase Cloud.

### New
- Generate regular 2D building frames from Stories and Bays.
- Individual story heights and bay widths using comma-separated values.
- Automatic Node, Beam, Column, and base Support creation.
- Automatic beam/column Material and Section assignment.
- Story metadata saved in JSON and Cloud model data.
- Story Manager with one-click member selection by story.
- Grid/elevation metadata for future Plan/3D expansion.

### Example
- Stories: 5
- Bays: 3
- Story heights: `3.5`
- Bay widths: `6`

Press **Building** then **Generate Building**.

No new Supabase SQL is required.
