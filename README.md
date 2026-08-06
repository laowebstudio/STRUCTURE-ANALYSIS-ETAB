# SAPUDOM Structure Analysis V1.11.1 Fix

Fixes Story Manager selection in V1.11. Clicking **Select** now closes Building Center, switches to Select mode, highlights all members belonging to that story, zooms to the selected story, and shows a visible confirmation banner and selected-member count. A geometry-based fallback also supports older JSON files whose members do not contain a `story` field.

All V1.11 features remain available: Building Generator, Typical Floor, Floor/Wall Loads, solver, releases/hinges, diagrams, JSON, CSV, and Supabase Cloud. No Supabase SQL migration is required.
