# Changelog

## V1.11.2 Fix
- Fixed Internal Hinge producing a singular global stiffness matrix.
- Excluded only intentionally inactive hinge rotational DOFs from the reduced system.
- Preserved translational stability checks so real mechanisms still report Matrix singular.
- Added internal hinge metadata and analysis summary count for inactive hinge rotations.
- Retained backward compatibility with V1.11.1 project JSON and existing Supabase model data.
