# SAPUDOM Structure Analysis V1.11.2 Fix

แก้ปัญหา Internal Hinge ทำให้เกิด `Matrix singular` หลัง Split Member

## สิ่งที่แก้
- สร้าง Node ของ Internal Hinge พร้อมสถานะ `internalHinge`
- ตรวจหา rotational DOF (Rz) ที่ถูกปล่อยโมเมนต์จาก Member ทุกด้าน
- นำเฉพาะ Rz ที่ไม่ทำงานออกจากสมการ Global Stiffness ก่อน Solve
- ไม่ซ่อนกลไกจากการเลื่อนตัว X/Y; หากโครงสร้างไม่เสถียรจริงยังแจ้ง Matrix singular
- Member Release, Building Center, Story Manager, Floor/Wall Loads, JSON, CSV และ Cloud ยังคงทำงานเหมือนเดิม
- ไม่ต้องแก้ Supabase SQL

## วิธีทดสอบ
1. เลือก Member ที่ไม่มี Member Load
2. เปิด Member Release / Hinge
3. กำหนด Internal Hinge 50%
4. กด Split Member + Add Hinge
5. กด Analyze
6. เปิด Moment Diagram และตรวจว่าโมเมนต์ตรง Hinge ใกล้ 0
