# SAPUDOM Structure Analysis V1.6.1

2D frame analysis web application in Lao. V1.6.1 upgrades Member Load entry without removing the V1.6 solver, JSON, CSV, Supabase Cloud, load combinations or diagrams.

## Member Load workflow
1. Choose **Member Load** from the left toolbar.
2. Click a member.
3. Choose UDL, Point, Trapezoidal or Moment from the dropdown.
4. Enter direction, magnitude and position, review the preview, then Apply.
5. Use the table in the same dialog to Edit, Duplicate or Delete loads.

## Deployment
Upload all files to the root of a GitHub Pages repository. Keep your existing `.git` folder when replacing an older version. No new Supabase SQL migration is required.
