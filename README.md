# SAPUDOM Structure Analysis V1.12

พัฒนาต่อจาก V1.11.2 Fix โดยคง Solver และระบบเดิมทั้งหมด

## ฟังก์ชันใหม่
- Modeling Tools Center
- เลือก All / Beam / Column / Brace / Invert
- Linear Copy ด้วย dx, dy และจำนวนครั้ง
- Move Selection
- Rotate รอบจุดศูนย์กลาง Selection
- Mirror แนวตั้ง/แนวนอน
- Divide Member เป็นส่วนเท่า ๆ กัน
- Merge Coincident Nodes ตาม tolerance
- Layer visibility: Member, Node, Load, Support, Label
- Undo/Redo สำหรับการแก้โมเดล

## Compatibility
JSON, Cloud, CSV, Building Center, Story Manager, Loads, Load Combination, Material/Section, Release, Internal Hinge และ Diagram ยังทำงานร่วมกันได้

## หมายเหตุ
เพื่อป้องกันการย้ายโหลดผิดตำแหน่ง ระบบจะไม่อนุญาต Divide Member ที่มี Member Load จนกว่าจะลบหรือย้ายโหลดก่อน
