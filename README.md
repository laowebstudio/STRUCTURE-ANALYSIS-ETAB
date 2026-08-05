# SAPUDOM Structure Analysis V1.8.1 Fix

พัฒนาต่อจาก V1.8 โดยแก้ระบบ Assign Material/Section ให้เขียนค่าลง Member จริงและแสดงผลทันที

## จุดที่แก้
- Apply to Selected อัปเดต `materialId`, `sectionId`, `E`, `A`, `I`, `Iy`, `J` และน้ำหนักของ Member จริง
- แผงด้านขวาและ Selection Info แสดง Material/Section ที่ Member ใช้อยู่จริง
- รองรับการ Assign หลาย Member และคง Selection หลัง Apply
- แสดงข้อความยืนยันจำนวน Member ที่อัปเดตสำเร็จ
- Custom Material และ Section เก็บถาวรใน localStorage ของเว็บไซต์
- เปิด Project JSON/Cloud แล้วรวม Library ที่สร้างเองกลับมาโดยไม่ลบข้อมูลเดิม
- เพิ่ม Export/Import Material Library
- คง Solver, Load Case, Load Combination, Member Load, Diagram, JSON, CSV และ Supabase Cloud

ไม่ต้องรัน Supabase SQL ใหม่
